package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// DevCacheService manages developer tool caches.
type DevCacheService struct{}

func NewDevCacheService() *DevCacheService { return &DevCacheService{} }

// DevCacheTool describes one developer tool's cache state.
type DevCacheTool struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Available bool   `json:"available"`
	SizeBytes int64  `json:"size_bytes"`
}

// DevCacheResult is the result of cleaning one tool's cache.
type DevCacheResult struct {
	ID      string `json:"id"`
	Success bool   `json:"success"`
	Freed   string `json:"freed"`
	Error   string `json:"error"`
}

var devCacheTools = []struct {
	id       string
	name     string
	bin      string
	cleanCmd []string
}{
	{"npm", "npm", "npm", []string{"npm", "cache", "clean", "--force"}},
	{"pnpm", "pnpm", "pnpm", []string{"pnpm", "store", "prune"}},
	{"yarn", "Yarn", "yarn", []string{"yarn", "cache", "clean"}},
	{"homebrew", "Homebrew", "brew", []string{"brew", "cleanup", "--prune=all"}},
	{"pip", "pip / pip3", "pip3", []string{"pip3", "cache", "purge"}},
	{"cargo", "Cargo", "cargo", []string{"cargo", "cache", "--autoclean"}},
	{"go", "Go module cache", "go", []string{"go", "clean", "-modcache"}},
}

// GetDevCaches returns availability and estimated size for each tool cache.
func (d *DevCacheService) GetDevCaches() []DevCacheTool {
	home, _ := os.UserHomeDir()
	result := make([]DevCacheTool, 0, len(devCacheTools))

	for _, t := range devCacheTools {
		_, err := exec.LookPath(t.bin)
		available := err == nil

		var size int64
		switch t.id {
		case "npm":
			size = duSize(filepath.Join(home, ".npm", "_cacache"))
		case "pnpm":
			if out, err := exec.Command("pnpm", "store", "path").Output(); err == nil {
				size = duSize(strings.TrimSpace(string(out)))
			}
		case "yarn":
			if out, err := exec.Command("yarn", "cache", "dir").Output(); err == nil {
				size = duSize(strings.TrimSpace(string(out)))
			}
		case "homebrew":
			if out, err := exec.Command("brew", "--cache").Output(); err == nil {
				size = duSize(strings.TrimSpace(string(out)))
			}
		case "pip":
			size = duSize(filepath.Join(home, "Library", "Caches", "pip"))
		case "cargo":
			size = duSize(filepath.Join(home, ".cargo", "registry"))
		case "go":
			if out, err := exec.Command("go", "env", "GOPATH").Output(); err == nil {
				gopath := strings.TrimSpace(string(out))
				size = duSize(filepath.Join(gopath, "pkg", "mod"))
			}
		}

		result = append(result, DevCacheTool{
			ID:        t.id,
			Name:      t.name,
			Available: available,
			SizeBytes: size,
		})
	}
	return result
}

// CleanDevCaches cleans caches for the given tool IDs.
// Only hardcoded commands are executed — no user input reaches exec.Command.
func (d *DevCacheService) CleanDevCaches(ids []string) []DevCacheResult {
	idSet := make(map[string]bool, len(ids))
	for _, id := range ids {
		idSet[id] = true
	}

	var results []DevCacheResult
	for _, t := range devCacheTools {
		if !idSet[t.id] {
			continue
		}
		_, err := exec.LookPath(t.bin)
		if err != nil {
			results = append(results, DevCacheResult{ID: t.id, Error: t.bin + " not installed"})
			continue
		}

		// #nosec G204 — hardcoded commands only, no user input
		cmd := exec.CommandContext(context.Background(), t.cleanCmd[0], t.cleanCmd[1:]...)
		out, cmdErr := cmd.CombinedOutput()
		if cmdErr != nil {
			results = append(results, DevCacheResult{ID: t.id, Error: strings.TrimSpace(string(out))})
			continue
		}

		results = append(results, DevCacheResult{ID: t.id, Success: true, Freed: fmt.Sprintf("Cleaned with %s", t.bin)})
	}
	return results
}
