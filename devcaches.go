package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
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

// CacheTarget describes a detectable cache item for Browser/AI/App cleanup.
type CacheTarget struct {
	ID                string `json:"id"`
	Name              string `json:"name"`
	Category          string `json:"category"` // "browser" | "ai" | "app"
	Exists            bool   `json:"exists"`
	SizeMB            int64  `json:"size_mb"`
	SafetyLevel       string `json:"safety_level"` // "safe" | "caution" | "manual"
	Unavailable       bool   `json:"unavailable"`
	UnavailableReason string `json:"unavailable_reason"`
}

// macOSMajorVersion returns the macOS major version (e.g. 14 for Sonoma).
func macOSMajorVersion() int {
	out, err := exec.Command("sw_vers", "-productVersion").Output()
	if err != nil {
		return 0
	}
	parts := strings.SplitN(strings.TrimSpace(string(out)), ".", 2)
	if len(parts) == 0 {
		return 0
	}
	major := 0
	fmt.Sscanf(parts[0], "%d", &major)
	return major
}

// sumDirSizes returns the total size in MB across all given paths.
func sumDirSizes(paths []string) int64 {
	var total int64
	for _, p := range paths {
		total += duSize(p)
	}
	return total / (1024 * 1024)
}

// anyExists returns true if at least one of the given paths exists on disk.
func anyExists(paths []string) bool {
	for _, p := range paths {
		if _, err := os.Stat(p); err == nil {
			return true
		}
	}
	return false
}

// globDirs returns all directories matching name inside root, up to maxDepth levels deep.
func globDirs(root, name string, maxDepth int) []string {
	var found []string
	_ = filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return filepath.SkipDir
		}
		rel, _ := filepath.Rel(root, path)
		depth := len(strings.Split(rel, string(os.PathSeparator)))
		if depth > maxDepth {
			return filepath.SkipDir
		}
		if d.IsDir() && d.Name() == name {
			found = append(found, path)
			return filepath.SkipDir
		}
		return nil
	})
	return found
}

// dockerStatus checks if the Docker binary exists and daemon is running.
// Returns (installed, running).
func dockerStatus() (bool, bool) {
	if _, err := exec.LookPath("docker"); err != nil {
		return false, false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	err := exec.CommandContext(ctx, "docker", "info").Run()
	return true, err == nil
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

// GetBrowserCaches returns detected browser cache targets on this Mac.
func (d *DevCacheService) GetBrowserCaches() []CacheTarget {
	home := safeHome()
	if home == "" {
		return nil
	}
	appSupport := filepath.Join(home, "Library", "Application Support")
	caches := filepath.Join(home, "Library", "Caches")

	chromeBase := filepath.Join(appSupport, "Google", "Chrome")
	arcBase := filepath.Join(appSupport, "Arc")
	braveBase := filepath.Join(appSupport, "BraveSoftware", "Brave-Browser")

	chromeGPU := append(
		globDirs(chromeBase, "GPUCache", 4),
		append(globDirs(chromeBase, "DawnWebGPUCache", 4),
			append(globDirs(chromeBase, "DawnGraphiteCache", 4),
				globDirs(chromeBase, "GraphiteDawnCache", 4)...)...)...)
	arcGPU := append(
		globDirs(arcBase, "GPUCache", 5),
		append(globDirs(arcBase, "GrShaderCache", 5),
			append(globDirs(arcBase, "ShaderCache", 5),
				globDirs(arcBase, "DawnWebGPUCache", 5)...)...)...)
	braveGPU := append(
		globDirs(braveBase, "GPUCache", 4),
		append(globDirs(braveBase, "DawnWebGPUCache", 4),
			globDirs(braveBase, "DawnGraphiteCache", 4)...)...)

	playwrightPaths := []string{
		filepath.Join(caches, "ms-playwright"),
		filepath.Join(caches, "ms-playwright-mcp"),
		filepath.Join(caches, "ms-playwright-go"),
	}

	targets := []struct {
		id    string
		name  string
		level string
		paths []string
	}{
		{"chrome_ai_model", "Chrome AI Model", "safe", []string{
			filepath.Join(chromeBase, "OptGuideOnDeviceModel"),
			filepath.Join(chromeBase, "WasmTtsEngine"),
		}},
		{"chrome_gpu_cache", "Chrome GPU Cache", "safe", chromeGPU},
		{"arc_service_worker", "Arc Service Worker Cache", "safe", []string{
			filepath.Join(arcBase, "User Data", "Default", "Service Worker", "CacheStorage"),
			filepath.Join(arcBase, "User Data", "Default", "Service Worker", "ScriptCache"),
			filepath.Join(arcBase, "User Data", "Default", "Shared Dictionary", "cache"),
		}},
		{"arc_gpu_cache", "Arc GPU Cache", "safe", arcGPU},
		{"brave_gpu_cache", "Brave GPU Cache", "safe", braveGPU},
		{"playwright_browsers", "Playwright Browsers", "safe", playwrightPaths},
	}

	result := make([]CacheTarget, 0, len(targets))
	for _, t := range targets {
		ct := CacheTarget{
			ID:          t.id,
			Name:        t.name,
			Category:    "browser",
			SafetyLevel: t.level,
		}
		ct.Exists = anyExists(t.paths)
		if ct.Exists {
			ct.SizeMB = sumDirSizes(t.paths)
		}
		result = append(result, ct)
	}
	return result
}

// CleanBrowserCaches removes the selected browser cache targets by ID.
func (d *DevCacheService) CleanBrowserCaches(ids []string) []DevCacheResult {
	home := safeHome()
	if home == "" {
		return nil
	}
	idSet := make(map[string]bool, len(ids))
	for _, id := range ids {
		idSet[id] = true
	}

	appSupport := filepath.Join(home, "Library", "Application Support")
	caches := filepath.Join(home, "Library", "Caches")
	chromeBase := filepath.Join(appSupport, "Google", "Chrome")
	arcBase := filepath.Join(appSupport, "Arc")
	braveBase := filepath.Join(appSupport, "BraveSoftware", "Brave-Browser")

	type entry struct {
		id    string
		paths []string
	}
	plan := []entry{
		{"chrome_ai_model", []string{
			filepath.Join(chromeBase, "OptGuideOnDeviceModel"),
			filepath.Join(chromeBase, "WasmTtsEngine"),
		}},
		{"chrome_gpu_cache", append(
			globDirs(chromeBase, "GPUCache", 4),
			append(globDirs(chromeBase, "DawnWebGPUCache", 4),
				append(globDirs(chromeBase, "DawnGraphiteCache", 4),
					globDirs(chromeBase, "GraphiteDawnCache", 4)...)...)...)},
		{"arc_service_worker", []string{
			filepath.Join(arcBase, "User Data", "Default", "Service Worker", "CacheStorage"),
			filepath.Join(arcBase, "User Data", "Default", "Service Worker", "ScriptCache"),
			filepath.Join(arcBase, "User Data", "Default", "Shared Dictionary", "cache"),
		}},
		{"arc_gpu_cache", append(
			globDirs(arcBase, "GPUCache", 5),
			append(globDirs(arcBase, "GrShaderCache", 5),
				append(globDirs(arcBase, "ShaderCache", 5),
					globDirs(arcBase, "DawnWebGPUCache", 5)...)...)...)},
		{"brave_gpu_cache", append(
			globDirs(braveBase, "GPUCache", 4),
			append(globDirs(braveBase, "DawnWebGPUCache", 4),
				globDirs(braveBase, "DawnGraphiteCache", 4)...)...)},
		{"playwright_browsers", []string{
			filepath.Join(caches, "ms-playwright"),
			filepath.Join(caches, "ms-playwright-mcp"),
			filepath.Join(caches, "ms-playwright-go"),
		}},
	}

	var results []DevCacheResult
	for _, e := range plan {
		if !idSet[e.id] {
			continue
		}
		var errs []string
		var freedBytes int64
		for _, p := range e.paths {
			if _, err := os.Stat(p); os.IsNotExist(err) {
				continue
			}
			freedBytes += duSize(p)
			if err := os.RemoveAll(p); err != nil {
				errs = append(errs, err.Error())
			}
		}
		if len(errs) > 0 {
			results = append(results, DevCacheResult{ID: e.id, Error: strings.Join(errs, "; ")})
		} else {
			mb := freedBytes / (1024 * 1024)
			results = append(results, DevCacheResult{ID: e.id, Success: true, Freed: fmt.Sprintf("%d MB", mb)})
		}
	}
	return results
}
