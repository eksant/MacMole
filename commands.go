package main

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

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

// GetDiskAnalysis returns metadata for top-level Mac directories with real sizes.
// Paths are derived from os.UserHomeDir() — no user-supplied input.
func (c *CommandService) GetDiskAnalysis() []DiskEntry {
	home := safeHome()
	if home == "" {
		return nil
	}
	roots := []string{
		home,
		filepath.Join(home, "Library"),
		"/Applications",
		"/Library",
	}

	var entries []DiskEntry
	var mu sync.Mutex
	var wg sync.WaitGroup

	for _, root := range roots {
		info, err := os.Stat(root)
		if err != nil || !info.IsDir() {
			continue
		}
		wg.Add(1)
		go func(path string) {
			defer wg.Done()
			sz := duSize(path)
			mu.Lock()
			entries = append(entries, DiskEntry{
				Name:  filepath.Base(path),
				Path:  path,
				Size:  sz,
				IsDir: true,
			})
			mu.Unlock()
		}(root)
	}
	wg.Wait()
	return entries
}

// DiskEntry is a lightweight file/directory record for the frontend.
type DiskEntry struct {
	Name  string `json:"name"`
	Path  string `json:"path"`
	Size  int64  `json:"size"`
	IsDir bool   `json:"is_dir"`
}

// AppEntry represents an application found in /Applications.
type AppEntry struct {
	Name     string `json:"name"`
	Path     string `json:"path"`
	Size     int64  `json:"size"`
	BundleID string `json:"bundle_id"`
}

// LogEntry represents a log file or directory under ~/Library/Logs.
type LogEntry struct {
	Name    string `json:"name"`
	Path    string `json:"path"`
	Size    int64  `json:"size"`
	ModTime int64  `json:"mod_time"`
	IsDir   bool   `json:"is_dir"`
}

// NodeModulesEntry represents a node_modules directory found during a scan.
type NodeModulesEntry struct {
	ProjectName string `json:"project_name"`
	ProjectPath string `json:"project_path"`
	Path        string `json:"path"`
	Size        int64  `json:"size"`
	ModTime     int64  `json:"mod_time"`
}

// duSize runs `du -sk <path>` and returns the size in bytes.
func duSize(path string) int64 {
	out, err := exec.Command("du", "-sk", path).Output()
	if err != nil {
		return 0
	}
	parts := strings.Fields(string(out))
	if len(parts) == 0 {
		return 0
	}
	kb, _ := strconv.ParseInt(parts[0], 10, 64)
	return kb * 1024
}

// ── App Uninstaller ──────────────────────────────────────────────────────────

// ScanApps lists .app bundles in /Applications with their sizes and bundle IDs.
func (c *CommandService) ScanApps() []AppEntry {
	entries, _ := os.ReadDir("/Applications")
	var apps []AppEntry
	var mu sync.Mutex
	sem := make(chan struct{}, 8)
	var wg sync.WaitGroup

	for _, e := range entries {
		if !e.IsDir() || !strings.HasSuffix(e.Name(), ".app") {
			continue
		}
		appPath := filepath.Join("/Applications", e.Name())
		wg.Add(1)
		go func(path, name string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			size := duSize(path)
			bundleID := readBundleID(path)
			mu.Lock()
			apps = append(apps, AppEntry{
				Name:     strings.TrimSuffix(name, ".app"),
				Path:     path,
				Size:     size,
				BundleID: bundleID,
			})
			mu.Unlock()
		}(appPath, e.Name())
	}
	wg.Wait()
	return apps
}

func readBundleID(appPath string) string {
	plistPath := filepath.Join(appPath, "Contents", "Info.plist")
	data, err := os.ReadFile(plistPath)
	if err != nil {
		return ""
	}
	idx := strings.Index(string(data), "CFBundleIdentifier")
	if idx == -1 {
		return ""
	}
	rest := string(data[idx+len("CFBundleIdentifier"):])
	start := strings.Index(rest, "<string>")
	end := strings.Index(rest, "</string>")
	if start == -1 || end == -1 || end <= start {
		return ""
	}
	return strings.TrimSpace(rest[start+8 : end])
}

// DeleteApps removes the given .app paths and their associated user-data files.
// Paths must be under /Applications to be accepted.
func (c *CommandService) DeleteApps(paths []string) CommandResult {
	home := safeHome()
	if home == "" {
		return CommandResult{Success: false, Error: "could not determine home directory"}
	}
	var freed int64
	var removed []string

	for _, p := range paths {
		if !strings.HasPrefix(p, "/Applications/") {
			continue
		}
		appName := strings.TrimSuffix(filepath.Base(p), ".app")
		bundleID := readBundleID(p)

		candidates := []string{p}
		if appName != "" {
			candidates = append(candidates,
				filepath.Join(home, "Library", "Application Support", appName),
				filepath.Join(home, "Library", "Logs", appName),
			)
		}
		if bundleID != "" {
			candidates = append(candidates,
				filepath.Join(home, "Library", "Caches", bundleID),
				filepath.Join(home, "Library", "Preferences", bundleID+".plist"),
			)
		}

		for _, target := range candidates {
			info, err := os.Stat(target)
			if err != nil {
				continue
			}
			var sz int64
			if info.IsDir() {
				sz = duSize(target)
			} else {
				sz = info.Size()
			}
			if err := os.RemoveAll(target); err == nil {
				freed += sz
				removed = append(removed, target)
			}
		}
	}

	if len(removed) == 0 {
		return CommandResult{Success: false, Error: "Nothing removed — check permissions."}
	}
	return CommandResult{
		Success: true,
		Output:  fmt.Sprintf("Removed %d item(s). Freed %s.", len(removed), fmtBytes(freed)),
	}
}

// ── Log Cleaner ──────────────────────────────────────────────────────────────

// ScanLogs returns top-level entries under ~/Library/Logs with sizes.
func (c *CommandService) ScanLogs() []LogEntry {
	home := safeHome()
	if home == "" {
		return nil
	}
	logsDir := filepath.Join(home, "Library", "Logs")

	entries, err := os.ReadDir(logsDir)
	if err != nil {
		return nil
	}

	var logs []LogEntry
	var mu sync.Mutex
	sem := make(chan struct{}, 8)
	var wg sync.WaitGroup

	for _, e := range entries {
		info, err := e.Info()
		if err != nil {
			continue
		}
		fullPath := filepath.Join(logsDir, e.Name())
		wg.Add(1)
		go func(path, name string, isDir bool, mt time.Time) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			var sz int64
			if isDir {
				sz = duSize(path)
			} else {
				info2, err := os.Stat(path)
				if err == nil {
					sz = info2.Size()
				}
			}
			mu.Lock()
			logs = append(logs, LogEntry{
				Name:    name,
				Path:    path,
				Size:    sz,
				ModTime: mt.Unix(),
				IsDir:   isDir,
			})
			mu.Unlock()
		}(fullPath, e.Name(), e.IsDir(), info.ModTime())
	}
	wg.Wait()
	return logs
}

// DeleteLogs removes the given paths, which must all be under ~/Library/Logs.
func (c *CommandService) DeleteLogs(paths []string) CommandResult {
	home := safeHome()
	if home == "" {
		return CommandResult{Success: false, Error: "could not determine home directory"}
	}
	logsRoot := filepath.Join(home, "Library", "Logs")
	var freed int64
	var count int

	for _, p := range paths {
		if !strings.HasPrefix(p, logsRoot+"/") && p != logsRoot {
			continue // safety: reject paths outside ~/Library/Logs
		}
		info, err := os.Stat(p)
		if err != nil {
			continue
		}
		var sz int64
		if info.IsDir() {
			sz = duSize(p)
		} else {
			sz = info.Size()
		}
		if err := os.RemoveAll(p); err == nil {
			freed += sz
			count++
		}
	}

	if count == 0 {
		return CommandResult{Success: false, Error: "Nothing removed — check permissions."}
	}
	return CommandResult{
		Success: true,
		Output:  fmt.Sprintf("Removed %d item(s). Freed %s.", count, fmtBytes(freed)),
	}
}

// ── Node Modules Cleaner ─────────────────────────────────────────────────────

// ScanNodeModules finds node_modules directories under common development roots.
func (c *CommandService) ScanNodeModules() []NodeModulesEntry {
	home := safeHome()
	if home == "" {
		return nil
	}
	roots := []string{
		filepath.Join(home, "Projects"),
		filepath.Join(home, "Developer"),
		filepath.Join(home, "Documents"),
		filepath.Join(home, "Desktop"),
		home,
	}

	var results []NodeModulesEntry
	var mu sync.Mutex
	sem := make(chan struct{}, 8)
	var wg sync.WaitGroup
	seen := make(map[string]bool)

	var walk func(dir string, depth int)
	walk = func(dir string, depth int) {
		if depth > 4 {
			return
		}
		entries, err := os.ReadDir(dir)
		if err != nil {
			return
		}
		for _, e := range entries {
			if !e.IsDir() {
				continue
			}
			name := e.Name()
			// Skip hidden dirs and node_modules subtrees.
			if strings.HasPrefix(name, ".") {
				continue
			}
			fullPath := filepath.Join(dir, name)
			if name == "node_modules" {
				mu.Lock()
				if seen[fullPath] {
					mu.Unlock()
					continue
				}
				seen[fullPath] = true
				mu.Unlock()

				info, err := e.Info()
				if err != nil {
					continue
				}
				projectPath := dir
				projectName := filepath.Base(dir)

				wg.Add(1)
				go func(path, proj, projPath string, mt time.Time) {
					defer wg.Done()
					sem <- struct{}{}
					defer func() { <-sem }()

					sz := duSize(path)
					mu.Lock()
					results = append(results, NodeModulesEntry{
						ProjectName: proj,
						ProjectPath: projPath,
						Path:        path,
						Size:        sz,
						ModTime:     mt.Unix(),
					})
					mu.Unlock()
				}(fullPath, projectName, projectPath, info.ModTime())
				// Don't recurse into node_modules itself.
				continue
			}
			walk(fullPath, depth+1)
		}
	}

	for _, root := range roots {
		if _, err := os.Stat(root); err == nil {
			walk(root, 0)
		}
	}
	wg.Wait()
	return results
}

// DeleteNodeModules removes the given node_modules paths.
// Each path must end with "/node_modules" as a safety check.
func (c *CommandService) DeleteNodeModules(paths []string) CommandResult {
	var freed int64
	var count int

	for _, p := range paths {
		if filepath.Base(p) != "node_modules" {
			continue // safety: only delete actual node_modules dirs
		}
		sz := duSize(p)
		if err := os.RemoveAll(p); err == nil {
			freed += sz
			count++
		}
	}

	if count == 0 {
		return CommandResult{Success: false, Error: "Nothing removed — check permissions."}
	}
	return CommandResult{
		Success: true,
		Output:  fmt.Sprintf("Removed %d node_modules director%s. Freed %s.", count, map[bool]string{true: "y", false: "ies"}[count == 1], fmtBytes(freed)),
	}
}

// fmtBytes formats a byte count as human-readable string.
func fmtBytes(b int64) string {
	const (
		GB = 1 << 30
		MB = 1 << 20
		KB = 1 << 10
	)
	switch {
	case b >= GB:
		return fmt.Sprintf("%.1f GB", float64(b)/GB)
	case b >= MB:
		return fmt.Sprintf("%.1f MB", float64(b)/MB)
	case b >= KB:
		return fmt.Sprintf("%.0f KB", float64(b)/KB)
	default:
		return fmt.Sprintf("%d B", b)
	}
}

// safeHome returns the current user's home directory, or "" if unavailable.
func safeHome() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return home
}
