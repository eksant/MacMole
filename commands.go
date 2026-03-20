package main

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

var ansiEscape = regexp.MustCompile(`\x1B\[[0-9;]*[a-zA-Z]|\x1B[()][AB012]`)

func stripANSI(s string) string {
	return strings.TrimSpace(ansiEscape.ReplaceAllString(s, ""))
}

// CommandService runs Mole shell commands and streams output to the frontend.
type CommandService struct {
	ctx    context.Context
	moPath string // resolved path to the `mo` binary
}

func NewCommandService() *CommandService {
	return &CommandService{}
}

func (c *CommandService) setContext(ctx context.Context) {
	c.ctx = ctx
	c.moPath = findMoBinary()

	// If mo is not installed, trigger a silent background install.
	if c.moPath == "" {
		go c.autoInstallMo()
	}
}

// findMoBinary locates the `mo` CLI binary from known Homebrew paths or PATH.
func findMoBinary() string {
	candidates := []string{
		"/opt/homebrew/bin/mo",
		"/usr/local/bin/mo",
	}
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	if p, err := exec.LookPath("mo"); err == nil {
		return p
	}
	return ""
}

// autoInstallMo runs `brew install mole` silently in the background.
// Progress is communicated to the frontend via Wails events.
func (c *CommandService) autoInstallMo() {
	// Check brew is available first.
	brewPath, err := exec.LookPath("brew")
	if err != nil {
		runtime.EventsEmit(c.ctx, "mo:install_failed", "Homebrew not found. Install Homebrew first: https://brew.sh")
		return
	}

	runtime.EventsEmit(c.ctx, "mo:installing", "Installing Mole CLI in background...")

	cmd := exec.CommandContext(c.ctx, brewPath, "install", "mole")
	// Suppress all brew output — this is intentionally silent.
	cmd.Stdout = nil
	cmd.Stderr = nil

	if err := cmd.Run(); err != nil {
		runtime.EventsEmit(c.ctx, "mo:install_failed", "brew install mole failed: "+err.Error())
		return
	}

	// Re-discover the binary after install.
	c.moPath = findMoBinary()
	if c.moPath != "" {
		runtime.EventsEmit(c.ctx, "mo:ready", "Mole CLI installed at "+c.moPath)
	} else {
		runtime.EventsEmit(c.ctx, "mo:install_failed", "Install finished but mo binary not found.")
	}
}

// CommandResult holds the exit status and combined output of a command.
type CommandResult struct {
	Success bool   `json:"success"`
	Output  string `json:"output"`
	Error   string `json:"error"`
}

// IsMoInstalled reports whether the `mo` CLI is available.
func (c *CommandService) IsMoInstalled() bool {
	return c.moPath != ""
}

// RunClean runs `mo clean`, optionally with --dry-run.
func (c *CommandService) RunClean(dryRun bool) CommandResult {
	args := []string{"clean"}
	if dryRun {
		args = append(args, "--dry-run")
	}
	return c.runMo(args...)
}

// RunOptimize runs `mo optimize`, optionally with --dry-run.
func (c *CommandService) RunOptimize(dryRun bool) CommandResult {
	args := []string{"optimize"}
	if dryRun {
		args = append(args, "--dry-run")
	}
	return c.runMo(args...)
}

// RunAll runs `mo clean` then `mo optimize` in sequence, streaming output for both.
// A phase-separator event is emitted between the two stages.
func (c *CommandService) RunAll(dryRun bool) CommandResult {
	runtime.EventsEmit(c.ctx, "command:phase", "--- Deep Clean ---")
	clean := c.RunClean(dryRun)

	runtime.EventsEmit(c.ctx, "command:phase", "--- System Optimize ---")
	opt := c.RunOptimize(dryRun)

	return CommandResult{
		Success: clean.Success && opt.Success,
		Output:  clean.Output + "\n" + opt.Output,
		Error:   clean.Error + opt.Error,
	}
}

// RunPurge runs `mo purge`, optionally with --dry-run.
func (c *CommandService) RunPurge(dryRun bool) CommandResult {
	args := []string{"purge"}
	if dryRun {
		args = append(args, "--dry-run")
	}
	return c.runMo(args...)
}

// RunInstall runs `mo install`, cleaning up installer leftovers (pkg, dmg, zip).
func (c *CommandService) RunInstall(dryRun bool) CommandResult {
	args := []string{"install"}
	if dryRun {
		args = append(args, "--dry-run")
	}
	return c.runMo(args...)
}

// runMo executes a `mo` subcommand, streaming stdout line-by-line via Wails events.
// Only hardcoded string slices are passed as args — no user input reaches exec.Command.
func (c *CommandService) runMo(args ...string) CommandResult {
	if c.moPath == "" {
		return CommandResult{
			Success: false,
			Error:   "Mole CLI is being installed, please wait...",
		}
	}

	// #nosec G204 — moPath is resolved from known Homebrew paths, args are hardcoded.
	cmd := exec.CommandContext(c.ctx, c.moPath, args...)
	cmd.Env = append(os.Environ(), "NO_COLOR=1", "TERM=dumb")

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return CommandResult{Success: false, Error: err.Error()}
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return CommandResult{Success: false, Error: err.Error()}
	}

	if err := cmd.Start(); err != nil {
		return CommandResult{Success: false, Error: err.Error()}
	}

	var outputLines []string

	// Stream stdout line-by-line to the frontend.
	scanner := bufio.NewScanner(stdout)
	for scanner.Scan() {
		line := stripANSI(scanner.Text())
		if line == "" {
			continue
		}
		outputLines = append(outputLines, line)
		runtime.EventsEmit(c.ctx, "command:output", line)
	}

	// Collect stderr (not streamed — returned in result).
	var errLines []string
	errScanner := bufio.NewScanner(stderr)
	for errScanner.Scan() {
		errLines = append(errLines, errScanner.Text())
	}

	runErr := cmd.Wait()
	result := CommandResult{
		Success: runErr == nil,
		Output:  strings.Join(outputLines, "\n"),
	}
	if runErr != nil {
		result.Error = fmt.Sprintf("%v\n%s", runErr, strings.Join(errLines, "\n"))
	}
	return result
}

// GetDiskAnalysis returns metadata for top-level Mac directories.
// Paths are derived from os.UserHomeDir() — no user-supplied input.
func (c *CommandService) GetDiskAnalysis() []DiskEntry {
	home, _ := os.UserHomeDir()
	roots := []string{
		home,
		filepath.Join(home, "Library"),
		"/Applications",
		"/Library",
	}

	var entries []DiskEntry
	for _, root := range roots {
		info, err := os.Stat(root)
		if err != nil || !info.IsDir() {
			continue
		}
		entries = append(entries, DiskEntry{
			Name:  filepath.Base(root),
			Path:  root,
			IsDir: true,
		})
	}
	return entries
}

// DiskEntry is a lightweight file/directory record for the frontend.
type DiskEntry struct {
	Name  string `json:"name"`
	Path  string `json:"path"`
	Size  int64  `json:"size"`
	IsDir bool   `json:"is_dir"`
}
