# MacMole Cleanup Expansion + i18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Browser / AI & Editors / App Caches selective-cleanup tabs to Cleanup.tsx backed by 6 new Go methods on DevCacheService, and add full EN/ID i18n with a flag language switcher in the Sidebar.

**Architecture:** Extend `devcaches.go` with `CacheTarget` struct + 6 new exported methods. Run `wails generate module` to regenerate JS bindings. Add `react-i18next` with per-page locale files under `frontend/src/locales/`. Migrate all 14 existing pages to `useTranslation()`. Transform `Cleanup.tsx` to add 3 selective-cleanup tabs (Browser / AI & Editors / App Caches) alongside the existing Deep Clean / Optimize / Purge tabs.

**Tech Stack:** Go 1.21+, Wails v2, React 18, TypeScript 5, react-i18next, shadcn/ui, Tailwind CSS  
**Helpers available (defined in `commands.go`):** `duSize(path string) int64`, `safeHome() string`

---

### Task 1: Config — .gitignore, CLAUDE.md, cleanup-scan skill

**Files:**
- Modify: `.gitignore`
- Modify: `CLAUDE.md`
- Create: `.claude/commands/cleanup-scan.md`

- [ ] **Step 1: Add entries to .gitignore**

Append to `.gitignore` (after the Go build artifacts section):

```gitignore
# SQLite user data (runtime, not repo)
*.db
*.db-shm
*.db-wal

# Go profiling artifacts
*.prof

# i18n compiled output (if ever generated)
frontend/src/locales/**/*.js
```

- [ ] **Step 2: Update CLAUDE.md — add i18n rules + new skill entry**

In the `## Skills` section, add:
```markdown
- `/cleanup-scan` — Scan storage and report cleanup opportunities (no deletions)
```

Add a new `## i18n Rules` section after Critical Rules:
```markdown
## i18n Rules

- All UI strings via `useTranslation()` hook — no hardcoded strings in JSX
- Translation files: `frontend/src/locales/{en,id}/<page>.json`
- Key format: `<page>.<section>.<key>` (e.g. `cleanup.browser.targets.chrome_ai_model.name`)
- When adding any new UI text: add both EN and ID strings before committing
- Safety/description strings for cleanup targets: `cleanup.<category>.targets.<id>.{name,description,safetyNote,recoverNote}`
```

- [ ] **Step 3: Create `.claude/commands/cleanup-scan.md`**

```markdown
---
description: Scan this Mac's storage and report what can be safely cleaned
---

Run a full storage scan and output a categorized summary table. Covers: Docker,
Homebrew, npm/node_modules, browser caches (Chrome/Arc/Brave), Playwright,
Python caches (pyinstaller/uv), Claude/AI caches (vm_bundles, sessions),
VSCode old extensions, and Go module cache.

## Steps

1. Check disk usage overview:
\`\`\`bash
df -h / | tail -1
\`\`\`

2. Scan major categories in parallel and output a markdown table with columns:
   Category | Item | Size | Safe to Delete?

3. Do NOT execute any deletions — this is a scan-only operation.

## What to scan
- Docker: `docker system df`
- Browser caches: `~/Library/Application Support/{Google/Chrome,Arc,BraveSoftware}/`
- Playwright: `~/Library/Caches/ms-playwright*`
- Claude: `~/Library/Application Support/Claude/vm_bundles`
- VSCode: `~/.vscode/extensions/.obsolete`
- Go module cache: `~/go/pkg/mod`
- uv/pyinstaller: `~/.cache/uv`, `~/Library/Application Support/pyinstaller`
- Homebrew: `brew --cache`
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore CLAUDE.md .claude/commands/cleanup-scan.md
git commit -m "chore: update gitignore, CLAUDE.md i18n rules, add cleanup-scan skill"
```

---

### Task 2: Backend — CacheTarget struct + utilities

**Files:**
- Modify: `devcaches.go`

- [ ] **Step 1: Add `CacheTarget` and `CleanResult` structs to `devcaches.go`**

Add immediately after the existing `DevCacheResult` struct:

```go
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
```

- [ ] **Step 2: Add macOS version utility**

Add after the structs:

```go
// macOSMajorVersion returns the macOS major version (e.g. 14 for Sonoma).
// Darwin kernel version = macOS version + 9 (Darwin 23 = macOS 14).
// Returns 0 on error.
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
```

- [ ] **Step 3: Add `sumDirSizes` helper for scanning multiple paths**

```go
// sumDirSizes returns the total size in MB across all given paths.
// Missing paths are skipped silently.
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

// globDirs returns all directories matching the given name inside root, up to maxDepth levels deep.
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
```

- [ ] **Step 4: Add `dockerStatus` helper**

```go
// dockerStatus checks if the Docker binary is installed and daemon is running.
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
```

Add `"time"` to imports in `devcaches.go`.

- [ ] **Step 5: Verify Go compiles**

```bash
go build ./...
```

Expected: no output (clean build).

---

### Task 3: Backend — Browser cache methods

**Files:**
- Modify: `devcaches.go`

- [ ] **Step 1: Add `GetBrowserCaches()`**

```go
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

	// GPU cache dirs shared across Chrome/Arc/Brave profiles
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
```

- [ ] **Step 2: Add `CleanBrowserCaches()`**

```go
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
```

- [ ] **Step 3: Verify build**

```bash
go build ./...
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add devcaches.go
git commit -m "feat(go): add CacheTarget struct, utils, and browser cache methods"
```

---

### Task 4: Backend — AI & Editor cache methods

**Files:**
- Modify: `devcaches.go`

- [ ] **Step 1: Add VSCode old-extension scanner helper**

```go
// vscodeObsoleteExtensions reads ~/.vscode/extensions/.obsolete and returns
// a CacheTarget per matched extension directory.
func vscodeObsoleteExtensions(home string) []CacheTarget {
	extDir := filepath.Join(home, ".vscode", "extensions")
	obsoleteFile := filepath.Join(extDir, ".obsolete")
	data, err := os.ReadFile(obsoleteFile)
	if err != nil {
		return nil
	}
	var obsolete map[string]bool
	if err := json.Unmarshal(data, &obsolete); err != nil {
		return nil
	}
	var targets []CacheTarget
	for name := range obsolete {
		p := filepath.Join(extDir, name)
		if _, err := os.Stat(p); err != nil {
			continue
		}
		targets = append(targets, CacheTarget{
			ID:          "vscode_ext_" + name,
			Name:        name,
			Category:    "ai",
			SafetyLevel: "manual",
			Exists:      true,
			SizeMB:      duSize(p) / (1024 * 1024),
		})
	}
	return targets
}
```

Add `"encoding/json"` to imports.

- [ ] **Step 2: Add `GetAICaches()`**

```go
// GetAICaches returns detected AI tool and editor cache targets.
func (d *DevCacheService) GetAICaches() []CacheTarget {
	home := safeHome()
	if home == "" {
		return nil
	}
	appSupport := filepath.Join(home, "Library", "Application Support")

	type entry struct {
		id    string
		name  string
		level string
		paths []string
	}
	entries := []entry{
		{"claude_vm_bundles", "Claude VM Bundles", "caution", []string{
			filepath.Join(appSupport, "Claude", "vm_bundles"),
		}},
		{"claude_local_sessions", "Claude Local Sessions", "caution", []string{
			filepath.Join(home, ".local", "share", "claude"),
		}},
	}

	result := make([]CacheTarget, 0, len(entries)+4)
	for _, e := range entries {
		ct := CacheTarget{
			ID:          e.id,
			Name:        e.name,
			Category:    "ai",
			SafetyLevel: e.level,
		}
		ct.Exists = anyExists(e.paths)
		if ct.Exists {
			ct.SizeMB = sumDirSizes(e.paths)
		}
		result = append(result, ct)
	}

	// VSCode old extensions (one target per obsolete extension dir)
	result = append(result, vscodeObsoleteExtensions(home)...)

	// VSCode orphaned extension dirs (have no package.json inside)
	extDir := filepath.Join(home, ".vscode", "extensions")
	entries, _ := os.ReadDir(extDir)
	for _, entry := range entries {
		if !entry.IsDir() || strings.HasPrefix(entry.Name(), ".") {
			continue
		}
		pkgJSON := filepath.Join(extDir, entry.Name(), "package.json")
		if _, err := os.Stat(pkgJSON); err == nil {
			continue // has package.json, not orphaned
		}
		p := filepath.Join(extDir, entry.Name())
		result = append(result, CacheTarget{
			ID:          "vscode_orphan_" + entry.Name(),
			Name:        entry.Name(),
			Category:    "ai",
			SafetyLevel: "manual",
			Exists:      true,
			SizeMB:      duSize(p) / (1024 * 1024),
		})
	}
	return result
}
```

- [ ] **Step 3: Add `CleanAICaches()`**

```go
// CleanAICaches removes selected AI/editor cache targets by ID.
func (d *DevCacheService) CleanAICaches(ids []string) []DevCacheResult {
	home := safeHome()
	if home == "" {
		return nil
	}
	idSet := make(map[string]bool, len(ids))
	for _, id := range ids {
		idSet[id] = true
	}
	appSupport := filepath.Join(home, "Library", "Application Support")

	fixedPaths := map[string][]string{
		"claude_vm_bundles":    {filepath.Join(appSupport, "Claude", "vm_bundles")},
		"claude_local_sessions": {filepath.Join(home, ".local", "share", "claude")},
	}

	var results []DevCacheResult
	// Fixed targets
	for id, paths := range fixedPaths {
		if !idSet[id] {
			continue
		}
		var errs []string
		var freed int64
		for _, p := range paths {
			if _, err := os.Stat(p); os.IsNotExist(err) {
				continue
			}
			freed += duSize(p)
			if err := os.RemoveAll(p); err != nil {
				errs = append(errs, err.Error())
			}
		}
		if len(errs) > 0 {
			results = append(results, DevCacheResult{ID: id, Error: strings.Join(errs, "; ")})
		} else {
			results = append(results, DevCacheResult{ID: id, Success: true, Freed: fmt.Sprintf("%d MB", freed/(1024*1024))})
		}
	}

	// VSCode old extension dirs — ID format: "vscode_ext_<dirname>"
	// VSCode orphaned dirs — ID format: "vscode_orphan_<dirname>"
	extDir := filepath.Join(home, ".vscode", "extensions")
	for id := range idSet {
		var prefix string
		if strings.HasPrefix(id, "vscode_ext_") {
			prefix = "vscode_ext_"
		} else if strings.HasPrefix(id, "vscode_orphan_") {
			prefix = "vscode_orphan_"
		} else {
			continue
		}
		dirName := strings.TrimPrefix(id, prefix)
		p := filepath.Join(extDir, dirName)
		freed := duSize(p)
		if err := os.RemoveAll(p); err != nil {
			results = append(results, DevCacheResult{ID: id, Error: err.Error()})
		} else {
			results = append(results, DevCacheResult{ID: id, Success: true, Freed: fmt.Sprintf("%d MB", freed/(1024*1024))})
		}
	}
	return results
}
```

- [ ] **Step 4: Verify build + commit**

```bash
go build ./...
git add devcaches.go
git commit -m "feat(go): add AI and editor cache methods"
```

---

### Task 5: Backend — App cache methods

**Files:**
- Modify: `devcaches.go`

- [ ] **Step 1: Add `GetAppCaches()`**

```go
// GetAppCaches returns detected application-specific cache targets.
func (d *DevCacheService) GetAppCaches() []CacheTarget {
	home := safeHome()
	if home == "" {
		return nil
	}
	libCaches := filepath.Join(home, "Library", "Caches")
	appSupport := filepath.Join(home, "Library", "Application Support")

	type entry struct {
		id          string
		name        string
		level       string
		requiresBin string
		paths       []string
	}
	entries := []entry{
		{"uv_cache", "uv Python Cache", "safe", "", []string{
			filepath.Join(home, ".cache", "uv"),
		}},
		{"pyinstaller_cache", "PyInstaller Binary Cache", "safe", "", []string{
			filepath.Join(appSupport, "pyinstaller"),
		}},
		{"nordvpn_cache", "NordVPN Cache", "safe", "", []string{
			filepath.Join(libCaches, "com.nordvpn.macos"),
		}},
		{"node_gyp_cache", "node-gyp Cache", "safe", "", []string{
			filepath.Join(libCaches, "node-gyp"),
		}},
		{"docker_build_cache", "Docker Build Cache", "caution", "docker", nil},
		{"docker_unused_images", "Docker Unused Images", "caution", "docker", nil},
	}

	result := make([]CacheTarget, 0, len(entries))
	for _, e := range entries {
		ct := CacheTarget{
			ID:          e.id,
			Name:        e.name,
			Category:    "app",
			SafetyLevel: e.level,
		}

		if e.requiresBin != "" {
			if _, err := exec.LookPath(e.requiresBin); err != nil {
				ct.Unavailable = true
				ct.UnavailableReason = e.requiresBin + " not installed"
				result = append(result, ct)
				continue
			}
			// Docker: also check daemon
			if e.requiresBin == "docker" {
				_, running := dockerStatus()
				if !running {
					ct.Exists = true
					ct.Unavailable = true
					ct.UnavailableReason = "Docker is not running"
					result = append(result, ct)
					continue
				}
				// Get Docker size via `docker system df`
				ct.Exists = true
				if e.id == "docker_build_cache" {
					ct.SizeMB = dockerBuildCacheSize()
				} else {
					ct.SizeMB = dockerUnusedImagesSize()
				}
				result = append(result, ct)
				continue
			}
		}

		ct.Exists = anyExists(e.paths)
		if ct.Exists {
			ct.SizeMB = sumDirSizes(e.paths)
		}
		result = append(result, ct)
	}
	return result
}

func dockerBuildCacheSize() int64 {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, "docker", "system", "df", "--format", "{{json .}}").Output()
	if err != nil {
		return 0
	}
	// Simple parse: find BuildCache line
	for _, line := range strings.Split(string(out), "\n") {
		if strings.Contains(line, "BuildCache") {
			var row struct{ Size string }
			if json.Unmarshal([]byte(line), &row) == nil {
				return parseDockerSize(row.Size)
			}
		}
	}
	return 0
}

func dockerUnusedImagesSize() int64 {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, "docker", "system", "df", "--format", "{{json .}}").Output()
	if err != nil {
		return 0
	}
	for _, line := range strings.Split(string(out), "\n") {
		if strings.Contains(line, "Images") {
			var row struct{ Reclaimable string }
			if json.Unmarshal([]byte(line), &row) == nil {
				return parseDockerSize(row.Reclaimable)
			}
		}
	}
	return 0
}

// parseDockerSize converts "8.75GB", "512MB" → MB int64.
func parseDockerSize(s string) int64 {
	s = strings.TrimSpace(s)
	// strip parenthetical e.g. "2.4GB (18%)"
	if idx := strings.Index(s, " "); idx > 0 {
		s = s[:idx]
	}
	var val float64
	unit := ""
	fmt.Sscanf(s, "%f%s", &val, &unit)
	unit = strings.ToUpper(unit)
	switch {
	case strings.HasPrefix(unit, "G"):
		return int64(val * 1024)
	case strings.HasPrefix(unit, "M"):
		return int64(val)
	case strings.HasPrefix(unit, "K"):
		return int64(val / 1024)
	}
	return 0
}
```

- [ ] **Step 2: Add `CleanAppCaches()`**

```go
// CleanAppCaches removes selected app cache targets by ID.
func (d *DevCacheService) CleanAppCaches(ids []string) []DevCacheResult {
	home := safeHome()
	if home == "" {
		return nil
	}
	idSet := make(map[string]bool, len(ids))
	for _, id := range ids {
		idSet[id] = true
	}

	libCaches := filepath.Join(home, "Library", "Caches")
	appSupport := filepath.Join(home, "Library", "Application Support")

	pathTargets := map[string][]string{
		"uv_cache":          {filepath.Join(home, ".cache", "uv")},
		"pyinstaller_cache": {filepath.Join(appSupport, "pyinstaller")},
		"nordvpn_cache":     {filepath.Join(libCaches, "com.nordvpn.macos")},
		"node_gyp_cache":    {filepath.Join(libCaches, "node-gyp")},
	}

	var results []DevCacheResult

	for id, paths := range pathTargets {
		if !idSet[id] {
			continue
		}
		var errs []string
		var freed int64
		for _, p := range paths {
			if _, err := os.Stat(p); os.IsNotExist(err) {
				continue
			}
			freed += duSize(p)
			if err := os.RemoveAll(p); err != nil {
				errs = append(errs, err.Error())
			}
		}
		if len(errs) > 0 {
			results = append(results, DevCacheResult{ID: id, Error: strings.Join(errs, "; ")})
		} else {
			results = append(results, DevCacheResult{ID: id, Success: true, Freed: fmt.Sprintf("%d MB", freed/(1024*1024))})
		}
	}

	// Docker targets
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if idSet["docker_build_cache"] {
		// #nosec G204 — hardcoded args only
		out, err := exec.CommandContext(ctx, "docker", "builder", "prune", "-a", "-f").CombinedOutput()
		if err != nil {
			results = append(results, DevCacheResult{ID: "docker_build_cache", Error: strings.TrimSpace(string(out))})
		} else {
			results = append(results, DevCacheResult{ID: "docker_build_cache", Success: true, Freed: "Build cache pruned"})
		}
	}

	if idSet["docker_unused_images"] {
		// #nosec G204 — hardcoded args only
		out, err := exec.CommandContext(ctx, "docker", "image", "prune", "-a", "-f").CombinedOutput()
		if err != nil {
			results = append(results, DevCacheResult{ID: "docker_unused_images", Error: strings.TrimSpace(string(out))})
		} else {
			results = append(results, DevCacheResult{ID: "docker_unused_images", Success: true, Freed: "Unused images pruned"})
		}
	}

	return results
}
```

- [ ] **Step 3: Verify build + commit**

```bash
go build ./...
git add devcaches.go
git commit -m "feat(go): add app cache methods with Docker support"
```

---

### Task 6: Wails bindings regeneration

**Files:**
- Modify: `frontend/wailsjs/go/main/DevCacheService.js` (auto-generated)
- Modify: `frontend/wailsjs/go/models.ts` (auto-generated)

- [ ] **Step 1: Regenerate JS bindings**

```bash
wails generate module
```

Expected: no errors. Updated files in `frontend/wailsjs/go/main/`.

- [ ] **Step 2: Verify new methods exist in bindings**

```bash
grep -l "GetBrowserCaches\|GetAICaches\|GetAppCaches" frontend/wailsjs/go/main/DevCacheService.js
```

Expected: prints the file path.

- [ ] **Step 3: Verify CacheTarget appears in models**

```bash
grep "CacheTarget" frontend/wailsjs/go/models.ts
```

Expected: `export class CacheTarget implements ICacheTarget { ... }` or similar.

- [ ] **Step 4: Commit generated bindings**

```bash
git add frontend/wailsjs/
git commit -m "chore: regenerate wails bindings for browser/AI/app cache methods"
```

---

### Task 7: i18n setup — install + i18n.ts + common locale files

**Files:**
- Modify: `frontend/package.json` (via npm install)
- Create: `frontend/src/i18n.ts`
- Create: `frontend/src/locales/en/common.json`
- Create: `frontend/src/locales/id/common.json`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Install react-i18next**

```bash
cd frontend && npm install i18next react-i18next
```

Expected: added to `package.json` dependencies.

- [ ] **Step 2: Create `frontend/src/i18n.ts`**

```ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import enCommon from './locales/en/common.json'
import enCleanup from './locales/en/cleanup.json'
import enDevcaches from './locales/en/devcaches.json'
import enDashboard from './locales/en/dashboard.json'
import enProcesses from './locales/en/processes.json'
import enHistory from './locales/en/history.json'
import enSettings from './locales/en/settings.json'
import enAnalyzer from './locales/en/analyzer.json'
import enCleaner from './locales/en/cleaner.json'
import enOptimizer from './locales/en/optimizer.json'
import enInstaller from './locales/en/installer.json'
import enLogs from './locales/en/logs.json'
import enNodemodules from './locales/en/nodemodules.json'
import enPurge from './locales/en/purge.json'
import enUninstall from './locales/en/uninstall.json'

import idCommon from './locales/id/common.json'
import idCleanup from './locales/id/cleanup.json'
import idDevcaches from './locales/id/devcaches.json'
import idDashboard from './locales/id/dashboard.json'
import idProcesses from './locales/id/processes.json'
import idHistory from './locales/id/history.json'
import idSettings from './locales/id/settings.json'
import idAnalyzer from './locales/id/analyzer.json'
import idCleaner from './locales/id/cleaner.json'
import idOptimizer from './locales/id/optimizer.json'
import idInstaller from './locales/id/installer.json'
import idLogs from './locales/id/logs.json'
import idNodemodules from './locales/id/nodemodules.json'
import idPurge from './locales/id/purge.json'
import idUninstall from './locales/id/uninstall.json'

const savedLang = localStorage.getItem('macmole_lang') ?? 'en'

void i18n.use(initReactI18next).init({
  lng: savedLang,
  fallbackLng: 'en',
  resources: {
    en: {
      common: enCommon,
      cleanup: enCleanup,
      devcaches: enDevcaches,
      dashboard: enDashboard,
      processes: enProcesses,
      history: enHistory,
      settings: enSettings,
      analyzer: enAnalyzer,
      cleaner: enCleaner,
      optimizer: enOptimizer,
      installer: enInstaller,
      logs: enLogs,
      nodemodules: enNodemodules,
      purge: enPurge,
      uninstall: enUninstall,
    },
    id: {
      common: idCommon,
      cleanup: idCleanup,
      devcaches: idDevcaches,
      dashboard: idDashboard,
      processes: idProcesses,
      history: idHistory,
      settings: idSettings,
      analyzer: idAnalyzer,
      cleaner: idCleaner,
      optimizer: idOptimizer,
      installer: idInstaller,
      logs: idLogs,
      nodemodules: idNodemodules,
      purge: idPurge,
      uninstall: idUninstall,
    },
  },
  interpolation: { escapeValue: false },
})

export default i18n
```

- [ ] **Step 3: Import i18n in `frontend/src/main.tsx`**

Add `import './i18n'` as the first import (before React imports):

```tsx
import './i18n'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
// ... rest of existing imports
```

- [ ] **Step 4: Create `frontend/src/locales/en/common.json`**

```json
{
  "button": {
    "clean": "Clean",
    "refresh": "Refresh",
    "run": "Run",
    "dryRun": "Dry Run",
    "cancel": "Cancel",
    "confirm": "Confirm",
    "selectAll": "Select All",
    "deselectAll": "Deselect All",
    "preview": "Preview",
    "kill": "Kill Selected"
  },
  "badge": {
    "safe": "Safe",
    "caution": "Caution",
    "manual": "Manual Review",
    "safe_note": "Regenerated automatically — no user data affected.",
    "caution_note": "Will require re-download or re-setup.",
    "manual_note": "Verify manually before deleting."
  },
  "status": {
    "loading": "Loading…",
    "scanning": "Scanning…",
    "running": "Running…",
    "done": "Done",
    "ready": "Ready",
    "noData": "No data available.",
    "cliReady": "Mole CLI ready",
    "cliInstalling": "Installing CLI…",
    "cliFailed": "CLI not available"
  },
  "error": {
    "generic": "Something went wrong.",
    "scanFailed": "Scan failed.",
    "cleanFailed": "Clean failed.",
    "notInstalled": "{{bin}} is not installed.",
    "notRunning": "{{app}} is not running."
  },
  "confirm": {
    "title": "Confirm Cleanup",
    "body": "You are about to free up {{size}} by cleaning {{count}} item(s). This action cannot be undone.",
    "proceed": "Clean Now",
    "cancel": "Cancel"
  },
  "empty": {
    "noCaches": "No caches detected on this Mac.",
    "selectItems": "Select items above to clean."
  },
  "lang": {
    "en": "English",
    "id": "Indonesian"
  },
  "nav": {
    "dashboard": "Dashboard",
    "cleanup": "Cleanup",
    "devcaches": "Dev Caches",
    "uninstall": "Uninstall",
    "installer": "App Cleanup",
    "logs": "Clean Logs",
    "nodemodules": "Node Modules",
    "analyzer": "Disk Analyzer",
    "processes": "Processes",
    "history": "History",
    "settings": "Settings",
    "groups": {
      "clean": "Clean",
      "manage": "Manage",
      "monitor": "Monitor"
    }
  }
}
```

- [ ] **Step 5: Create `frontend/src/locales/id/common.json`**

```json
{
  "button": {
    "clean": "Bersihkan",
    "refresh": "Perbarui",
    "run": "Jalankan",
    "dryRun": "Simulasi",
    "cancel": "Batal",
    "confirm": "Konfirmasi",
    "selectAll": "Pilih Semua",
    "deselectAll": "Hapus Pilihan",
    "preview": "Pratinjau",
    "kill": "Hentikan Terpilih"
  },
  "badge": {
    "safe": "Aman",
    "caution": "Perhatian",
    "manual": "Periksa Manual",
    "safe_note": "Dibuat ulang otomatis — data pengguna tidak terpengaruh.",
    "caution_note": "Memerlukan unduhan atau penyiapan ulang.",
    "manual_note": "Periksa secara manual sebelum menghapus."
  },
  "status": {
    "loading": "Memuat…",
    "scanning": "Memindai…",
    "running": "Berjalan…",
    "done": "Selesai",
    "ready": "Siap",
    "noData": "Tidak ada data.",
    "cliReady": "Mole CLI siap",
    "cliInstalling": "Menginstal CLI…",
    "cliFailed": "CLI tidak tersedia"
  },
  "error": {
    "generic": "Terjadi kesalahan.",
    "scanFailed": "Pemindaian gagal.",
    "cleanFailed": "Pembersihan gagal.",
    "notInstalled": "{{bin}} tidak terinstal.",
    "notRunning": "{{app}} tidak berjalan."
  },
  "confirm": {
    "title": "Konfirmasi Pembersihan",
    "body": "Anda akan membebaskan {{size}} dengan membersihkan {{count}} item. Tindakan ini tidak dapat dibatalkan.",
    "proceed": "Bersihkan Sekarang",
    "cancel": "Batal"
  },
  "empty": {
    "noCaches": "Tidak ada cache yang terdeteksi di Mac ini.",
    "selectItems": "Pilih item di atas untuk dibersihkan."
  },
  "lang": {
    "en": "Inggris",
    "id": "Indonesia"
  },
  "nav": {
    "dashboard": "Dasbor",
    "cleanup": "Pembersihan",
    "devcaches": "Cache Dev",
    "uninstall": "Uninstall",
    "installer": "Bersihkan App",
    "logs": "Bersihkan Log",
    "nodemodules": "Node Modules",
    "analyzer": "Analisis Disk",
    "processes": "Proses",
    "history": "Riwayat",
    "settings": "Pengaturan",
    "groups": {
      "clean": "Bersihkan",
      "manage": "Kelola",
      "monitor": "Monitor"
    }
  }
}
```

- [ ] **Step 6: Commit**

```bash
cd frontend && npm run type-check 2>&1 | head -20
git add frontend/package.json frontend/package-lock.json frontend/src/i18n.ts frontend/src/main.tsx frontend/src/locales/en/common.json frontend/src/locales/id/common.json
git commit -m "feat(i18n): add react-i18next setup and common EN/ID locale"
```

---

### Task 8: i18n — Cleanup locale files (EN + ID)

**Files:**
- Create: `frontend/src/locales/en/cleanup.json`
- Create: `frontend/src/locales/id/cleanup.json`

- [ ] **Step 1: Create `frontend/src/locales/en/cleanup.json`**

```json
{
  "title": "Cleanup",
  "tabs": {
    "deepClean": "Deep Clean",
    "optimize": "Optimize",
    "purge": "Purge",
    "browser": "Browser",
    "ai": "AI & Editors",
    "app": "App Caches"
  },
  "deepClean": {
    "description": "Removes caches, logs, temp files, and browser artifacts. Safe to run anytime.",
    "dangerLevel": "Safe"
  },
  "optimize": {
    "description": "Runs macOS maintenance scripts, rebuilds Launch Services, compacts SQLite databases.",
    "dangerLevel": "Low Risk"
  },
  "purge": {
    "description": "Aggressively removes additional caches and development artifacts. Review before applying.",
    "dangerLevel": "Destructive"
  },
  "browser": {
    "empty": "No browser caches detected on this Mac.",
    "targets": {
      "chrome_ai_model": {
        "name": "Chrome AI Model",
        "description": "On-device AI model auto-downloaded by Chrome for search suggestions and other AI features. Not related to your bookmarks, passwords, or browsing history.",
        "safetyNote": "Safe — Chrome re-downloads automatically when needed.",
        "recoverNote": "Will be re-downloaded by Chrome on next use of AI features."
      },
      "chrome_gpu_cache": {
        "name": "Chrome GPU Cache",
        "description": "Graphics shader and GPU pipeline cache files for Chrome across all profiles.",
        "safetyNote": "Safe — regenerated automatically on next Chrome launch.",
        "recoverNote": "Chrome rebuilds these caches automatically."
      },
      "arc_service_worker": {
        "name": "Arc Service Worker Cache",
        "description": "Web app offline caches and script caches stored by Arc browser. These are website data, not your bookmarks or account info.",
        "safetyNote": "Safe — websites rebuild their caches when you visit them again.",
        "recoverNote": "Websites re-cache content on next visit. First load may be slightly slower."
      },
      "arc_gpu_cache": {
        "name": "Arc GPU Cache",
        "description": "Graphics shader and GPU pipeline caches for Arc browser.",
        "safetyNote": "Safe — regenerated automatically on next Arc launch.",
        "recoverNote": "Arc rebuilds these caches automatically."
      },
      "brave_gpu_cache": {
        "name": "Brave GPU Cache",
        "description": "Graphics shader and GPU pipeline caches for Brave browser.",
        "safetyNote": "Safe — regenerated automatically on next Brave launch.",
        "recoverNote": "Brave rebuilds these caches automatically."
      },
      "playwright_browsers": {
        "name": "Playwright Browsers",
        "description": "Full browser binaries (Chromium, Firefox, WebKit) downloaded by Playwright for automated testing. These are testing tools — not your regular browsers.",
        "safetyNote": "Safe — re-downloaded when you run Playwright tests again.",
        "recoverNote": "Run `npx playwright install` to restore when needed."
      }
    }
  },
  "ai": {
    "empty": "No AI or editor caches detected on this Mac.",
    "targets": {
      "claude_vm_bundles": {
        "name": "Claude VM Bundles",
        "description": "Sandbox VM image used by Claude Code for isolated code execution (worktree mode). This is a large binary downloaded by the Claude desktop app.",
        "safetyNote": "Caution — safe to delete, but Claude Code will re-download (~5 min) the first time isolated execution is used again.",
        "recoverNote": "Claude Code re-downloads automatically on next worktree use."
      },
      "claude_local_sessions": {
        "name": "Claude Local Sessions",
        "description": "Local session data and conversation cache files stored by Claude Code CLI.",
        "safetyNote": "Caution — deletes local session history. Cloud conversation history is unaffected.",
        "recoverNote": "Cannot be recovered. Cloud history remains intact."
      }
    },
    "vscodeExtNote": "Old extension version detected. Verify the newer version is active in VS Code before deleting.",
    "vscodeExtDescription": "Leftover directory from an old VS Code extension version. The newer version is already installed."
  },
  "app": {
    "empty": "No app caches detected on this Mac.",
    "notRunning": "{{app}} is not running. Start it to enable this cleanup.",
    "notInstalled": "{{app}} is not installed on this Mac.",
    "targets": {
      "uv_cache": {
        "name": "uv Python Cache",
        "description": "Package download cache for uv, the fast Python package manager. Contains downloaded Python packages.",
        "safetyNote": "Safe — uv re-downloads packages when needed.",
        "recoverNote": "uv re-downloads packages on next install command."
      },
      "pyinstaller_cache": {
        "name": "PyInstaller Binary Cache",
        "description": "Cached compiled binaries generated by PyInstaller when building Python executables.",
        "safetyNote": "Safe — PyInstaller regenerates these when building apps.",
        "recoverNote": "Rebuilt automatically by PyInstaller on next build."
      },
      "nordvpn_cache": {
        "name": "NordVPN Cache",
        "description": "Cached data files used by the NordVPN macOS app. Does not include VPN credentials or account data.",
        "safetyNote": "Safe — NordVPN recreates cache files on next launch.",
        "recoverNote": "NordVPN rebuilds cache automatically. VPN account unaffected."
      },
      "node_gyp_cache": {
        "name": "node-gyp Cache",
        "description": "Build cache for node-gyp, used to compile native Node.js addons from C/C++ source.",
        "safetyNote": "Safe — node-gyp rebuilds when compiling native modules.",
        "recoverNote": "Rebuilt by node-gyp when you install native npm packages."
      },
      "docker_build_cache": {
        "name": "Docker Build Cache",
        "description": "Cached build layers from Docker image builds. These layers speed up rebuilds but accumulate over time. Your running containers and their data are not affected.",
        "safetyNote": "Caution — removing build cache means next Docker builds will be slower as layers are rebuilt.",
        "recoverNote": "Docker rebuilds cache layers on next `docker build`. Running containers unaffected."
      },
      "docker_unused_images": {
        "name": "Docker Unused Images",
        "description": "Docker images not currently used by any container. Images used by running or stopped containers are kept.",
        "safetyNote": "Caution — removed images must be re-pulled from Docker Hub if needed again.",
        "recoverNote": "Re-pull with `docker pull <image>`. Running containers unaffected."
      }
    }
  },
  "results": {
    "freed": "Freed {{size}}",
    "error": "Error: {{message}}",
    "totalFreed": "Total freed: {{size}}"
  }
}
```

- [ ] **Step 2: Create `frontend/src/locales/id/cleanup.json`**

```json
{
  "title": "Pembersihan",
  "tabs": {
    "deepClean": "Bersih Dalam",
    "optimize": "Optimalkan",
    "purge": "Purge",
    "browser": "Browser",
    "ai": "AI & Editor",
    "app": "Cache Aplikasi"
  },
  "deepClean": {
    "description": "Menghapus cache, log, file sementara, dan artefak browser. Aman dijalankan kapan saja.",
    "dangerLevel": "Aman"
  },
  "optimize": {
    "description": "Menjalankan skrip pemeliharaan macOS, membangun ulang Launch Services, memadatkan database SQLite.",
    "dangerLevel": "Risiko Rendah"
  },
  "purge": {
    "description": "Menghapus cache tambahan dan artefak pengembangan secara agresif. Tinjau sebelum menerapkan.",
    "dangerLevel": "Destruktif"
  },
  "browser": {
    "empty": "Tidak ada cache browser yang terdeteksi di Mac ini.",
    "targets": {
      "chrome_ai_model": {
        "name": "Model AI Chrome",
        "description": "Model AI yang diunduh otomatis oleh Chrome untuk saran pencarian dan fitur AI lainnya. Tidak berkaitan dengan bookmark, kata sandi, atau riwayat browsing.",
        "safetyNote": "Aman — Chrome mengunduh ulang secara otomatis saat dibutuhkan.",
        "recoverNote": "Akan diunduh ulang oleh Chrome saat fitur AI digunakan kembali."
      },
      "chrome_gpu_cache": {
        "name": "Cache GPU Chrome",
        "description": "File cache shader grafis dan pipeline GPU untuk Chrome di semua profil.",
        "safetyNote": "Aman — dibuat ulang otomatis saat Chrome dibuka.",
        "recoverNote": "Chrome membangun ulang cache ini secara otomatis."
      },
      "arc_service_worker": {
        "name": "Cache Service Worker Arc",
        "description": "Cache offline aplikasi web dan cache skrip yang disimpan oleh browser Arc. Ini adalah data situs web, bukan bookmark atau informasi akun.",
        "safetyNote": "Aman — situs web membangun ulang cache saat dikunjungi lagi.",
        "recoverNote": "Situs web melakukan cache ulang saat kunjungan berikutnya. Pemuatan pertama mungkin sedikit lebih lambat."
      },
      "arc_gpu_cache": {
        "name": "Cache GPU Arc",
        "description": "Cache shader grafis dan pipeline GPU untuk browser Arc.",
        "safetyNote": "Aman — dibuat ulang otomatis saat Arc dibuka.",
        "recoverNote": "Arc membangun ulang cache ini secara otomatis."
      },
      "brave_gpu_cache": {
        "name": "Cache GPU Brave",
        "description": "Cache shader grafis dan pipeline GPU untuk browser Brave.",
        "safetyNote": "Aman — dibuat ulang otomatis saat Brave dibuka.",
        "recoverNote": "Brave membangun ulang cache ini secara otomatis."
      },
      "playwright_browsers": {
        "name": "Browser Playwright",
        "description": "Binary browser lengkap (Chromium, Firefox, WebKit) yang diunduh oleh Playwright untuk pengujian otomatis. Ini adalah alat pengujian, bukan browser biasa Anda.",
        "safetyNote": "Aman — diunduh ulang saat Anda menjalankan tes Playwright lagi.",
        "recoverNote": "Jalankan `npx playwright install` untuk memulihkan saat dibutuhkan."
      }
    }
  },
  "ai": {
    "empty": "Tidak ada cache AI atau editor yang terdeteksi di Mac ini.",
    "targets": {
      "claude_vm_bundles": {
        "name": "Bundle VM Claude",
        "description": "Image VM sandbox yang digunakan oleh Claude Code untuk eksekusi kode terisolasi (mode worktree). Ini adalah binary besar yang diunduh oleh aplikasi desktop Claude.",
        "safetyNote": "Perhatian — aman dihapus, tetapi Claude Code akan mengunduh ulang (~5 menit) pertama kali eksekusi terisolasi digunakan lagi.",
        "recoverNote": "Claude Code mengunduh ulang secara otomatis saat worktree berikutnya digunakan."
      },
      "claude_local_sessions": {
        "name": "Sesi Lokal Claude",
        "description": "Data sesi lokal dan file cache percakapan yang disimpan oleh Claude Code CLI.",
        "safetyNote": "Perhatian — menghapus riwayat sesi lokal. Riwayat percakapan cloud tidak terpengaruh.",
        "recoverNote": "Tidak dapat dipulihkan. Riwayat cloud tetap utuh."
      }
    },
    "vscodeExtNote": "Versi ekstensi lama terdeteksi. Pastikan versi terbaru sudah aktif di VS Code sebelum menghapus.",
    "vscodeExtDescription": "Direktori sisa dari versi ekstensi VS Code lama. Versi terbaru sudah terinstal."
  },
  "app": {
    "empty": "Tidak ada cache aplikasi yang terdeteksi di Mac ini.",
    "notRunning": "{{app}} tidak berjalan. Jalankan terlebih dahulu untuk mengaktifkan pembersihan ini.",
    "notInstalled": "{{app}} tidak terinstal di Mac ini.",
    "targets": {
      "uv_cache": {
        "name": "Cache Python uv",
        "description": "Cache unduhan paket untuk uv, manajer paket Python yang cepat. Berisi paket Python yang telah diunduh.",
        "safetyNote": "Aman — uv mengunduh ulang paket saat dibutuhkan.",
        "recoverNote": "uv mengunduh ulang paket saat perintah install berikutnya."
      },
      "pyinstaller_cache": {
        "name": "Cache Binary PyInstaller",
        "description": "Binary terkompilasi yang di-cache oleh PyInstaller saat membangun executable Python.",
        "safetyNote": "Aman — PyInstaller membuat ulang cache ini saat membangun aplikasi.",
        "recoverNote": "Dibangun ulang otomatis oleh PyInstaller saat build berikutnya."
      },
      "nordvpn_cache": {
        "name": "Cache NordVPN",
        "description": "File data cache yang digunakan oleh aplikasi NordVPN di macOS. Tidak termasuk kredensial VPN atau data akun.",
        "safetyNote": "Aman — NordVPN membuat ulang file cache saat diluncurkan.",
        "recoverNote": "NordVPN membangun ulang cache secara otomatis. Akun VPN tidak terpengaruh."
      },
      "node_gyp_cache": {
        "name": "Cache node-gyp",
        "description": "Cache build untuk node-gyp, digunakan untuk mengkompilasi addon Node.js native dari kode sumber C/C++.",
        "safetyNote": "Aman — node-gyp membangun ulang saat mengkompilasi modul native.",
        "recoverNote": "Dibangun ulang oleh node-gyp saat menginstal paket npm native."
      },
      "docker_build_cache": {
        "name": "Cache Build Docker",
        "description": "Layer build yang di-cache dari pembuatan image Docker. Layer ini mempercepat build ulang tetapi menumpuk seiring waktu. Container yang berjalan dan datanya tidak terpengaruh.",
        "safetyNote": "Perhatian — menghapus cache build berarti build Docker berikutnya akan lebih lambat karena layer dibangun ulang.",
        "recoverNote": "Docker membangun ulang layer cache saat `docker build` berikutnya. Container yang berjalan tidak terpengaruh."
      },
      "docker_unused_images": {
        "name": "Image Docker Tidak Digunakan",
        "description": "Image Docker yang tidak digunakan oleh container mana pun. Image yang digunakan oleh container yang berjalan atau dihentikan tetap disimpan.",
        "safetyNote": "Perhatian — image yang dihapus harus ditarik ulang dari Docker Hub jika dibutuhkan lagi.",
        "recoverNote": "Tarik ulang dengan `docker pull <image>`. Container yang berjalan tidak terpengaruh."
      }
    }
  },
  "results": {
    "freed": "Dibebaskan {{size}}",
    "error": "Kesalahan: {{message}}",
    "totalFreed": "Total dibebaskan: {{size}}"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/locales/en/cleanup.json frontend/src/locales/id/cleanup.json
git commit -m "feat(i18n): add cleanup EN/ID locale with all target descriptions"
```

---

### Task 9: i18n — All other page locale files

**Files:**
- Create: `frontend/src/locales/en/{dashboard,devcaches,processes,history,settings,analyzer,cleaner,optimizer,installer,logs,nodemodules,purge,uninstall}.json`
- Create: `frontend/src/locales/id/` (mirrors above)

- [ ] **Step 1: Create all EN locale files**

Create each file by extracting hardcoded strings from the corresponding page. Follow this pattern — example for `frontend/src/locales/en/devcaches.json`:

```json
{
  "title": "Dev Caches",
  "description": "Clean developer tool caches using each tool's native clean command.",
  "available": "Available",
  "notAvailable": "Not installed",
  "noTools": "No developer tools detected.",
  "selected": "{{count}} selected · {{size}} to free",
  "results": {
    "success": "Cleaned",
    "error": "Failed"
  }
}
```

For `frontend/src/locales/en/dashboard.json`:
```json
{
  "title": "Dashboard",
  "healthScore": "Health Score",
  "metrics": {
    "cpu": "CPU",
    "memory": "Memory",
    "disk": "Disk",
    "network": "Network",
    "battery": "Battery",
    "uptime": "Uptime"
  },
  "processes": {
    "title": "Top Processes",
    "noWarnings": "No flagged processes."
  },
  "runAll": "Run Full Clean",
  "warnings": {
    "highCpu": "High CPU usage",
    "highMemory": "High memory usage",
    "lowDisk": "Low disk space"
  }
}
```

For `frontend/src/locales/en/processes.json`:
```json
{
  "title": "Processes",
  "description": "View and terminate flagged processes (zombie, high CPU, high memory).",
  "types": {
    "zombie": "Zombie",
    "highCpu": "High CPU",
    "highMem": "High Memory"
  },
  "noFlagged": "No flagged processes found.",
  "killConfirm": "Kill {{count}} process(es)?",
  "killed": "Process(es) terminated."
}
```

For `frontend/src/locales/en/history.json`:
```json
{
  "title": "History",
  "description": "Audit log of all cleanup operations.",
  "columns": {
    "operation": "Operation",
    "status": "Status",
    "freed": "Freed",
    "time": "Time"
  },
  "empty": "No history yet. Run a cleanup to see results here.",
  "success": "Success",
  "failed": "Failed"
}
```

For `frontend/src/locales/en/settings.json`:
```json
{
  "title": "Settings",
  "loginItem": {
    "label": "Launch at Login",
    "description": "Start MacMole automatically when you log in."
  },
  "updates": {
    "label": "Check for Updates",
    "checking": "Checking…",
    "upToDate": "You're up to date.",
    "updateAvailable": "Update available: {{version}}"
  },
  "language": {
    "label": "Language"
  },
  "version": "Version {{version}}"
}
```

For `frontend/src/locales/en/analyzer.json`:
```json
{
  "title": "Disk Analyzer",
  "description": "Explore disk usage by folder and identify large files.",
  "scanning": "Scanning…",
  "empty": "No data. Select a folder to analyze."
}
```

For `frontend/src/locales/en/cleaner.json`:
```json
{
  "title": "Cleaner",
  "description": "Run deep clean, optimize, or purge using the Mole CLI.",
  "dryRunNote": "Dry run — no files will be deleted.",
  "completed": "Completed successfully.",
  "completedWithErrors": "Completed with errors."
}
```

For `frontend/src/locales/en/optimizer.json`:
```json
{
  "title": "Optimizer",
  "description": "Run macOS maintenance tasks and system optimization.",
  "completed": "Optimization complete.",
  "completedWithErrors": "Optimization finished with errors."
}
```

For `frontend/src/locales/en/installer.json`:
```json
{
  "title": "App Cleanup",
  "description": "Find and remove installer files (.dmg, .pkg) that are no longer needed.",
  "empty": "No installer files found.",
  "totalSize": "Total: {{size}}"
}
```

For `frontend/src/locales/en/logs.json`:
```json
{
  "title": "Clean Logs",
  "description": "Find and remove log files to free up space.",
  "empty": "No log files found.",
  "totalSize": "Total: {{size}}"
}
```

For `frontend/src/locales/en/nodemodules.json`:
```json
{
  "title": "Node Modules",
  "description": "Find node_modules directories in your projects and remove unused ones.",
  "empty": "No node_modules directories found.",
  "scanning": "Scanning projects…",
  "totalSize": "Total: {{size}}"
}
```

For `frontend/src/locales/en/purge.json`:
```json
{
  "title": "Purge",
  "description": "Remove build artifacts, dist folders, and development caches from your projects.",
  "empty": "No purgeable artifacts found.",
  "totalSize": "Total: {{size}}"
}
```

For `frontend/src/locales/en/uninstall.json`:
```json
{
  "title": "Uninstall",
  "description": "Safely uninstall applications and remove all associated data.",
  "empty": "No applications found.",
  "confirm": "Uninstall {{app}}?",
  "note": "This will remove the app and its support files."
}
```

- [ ] **Step 2: Create all ID locale files**

Mirror `en/` structure into `id/`. Translate all values. Example `id/devcaches.json`:

```json
{
  "title": "Cache Dev",
  "description": "Bersihkan cache alat pengembang menggunakan perintah bersih native masing-masing alat.",
  "available": "Tersedia",
  "notAvailable": "Tidak terinstal",
  "noTools": "Tidak ada alat pengembang yang terdeteksi.",
  "selected": "{{count}} dipilih · {{size}} untuk dibebaskan",
  "results": {
    "success": "Dibersihkan",
    "error": "Gagal"
  }
}
```

Apply the same translation pattern to all 13 remaining page files in `id/`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/locales/
git commit -m "feat(i18n): add EN/ID locale files for all 14 pages"
```

---

### Task 10: Sidebar — language switcher pill

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`

- [ ] **Step 1: Add i18n imports to Sidebar.tsx**

Add at top of file:
```tsx
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
```

- [ ] **Step 2: Add `LanguageSwitcher` component inside `Sidebar.tsx`**

Add before the `export default function Sidebar` line:

```tsx
function LanguageSwitcher() {
  const { i18n: i18nInstance } = useTranslation()
  const current = i18nInstance.language

  const toggle = (lang: string) => {
    void i18nInstance.changeLanguage(lang)
    localStorage.setItem('macmole_lang', lang)
  }

  return (
    <div
      className="no-drag flex items-center rounded-lg overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {(['en', 'id'] as const).map((lang) => (
        <button
          key={lang}
          onClick={() => toggle(lang)}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium transition-all"
          style={
            current === lang
              ? {
                  background: 'rgba(139,92,246,0.25)',
                  color: '#ffffff',
                }
              : {
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.35)',
                }
          }
        >
          <span>{lang === 'en' ? '🇺🇸' : '🇮🇩'}</span>
          <span>{lang.toUpperCase()}</span>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Add `LanguageSwitcher` to sidebar layout**

In the `return` of `Sidebar`, add `<LanguageSwitcher />` just above the `<div className="no-drag px-3 pt-2">` (CLI status section):

```tsx
        {/* Language switcher */}
        <div className="no-drag px-3 pb-2">
          <LanguageSwitcher />
        </div>
```

- [ ] **Step 4: Migrate nav labels to i18n**

In the `nav` array, change static labels to use a translation hook. Move the `nav` array inside the component and use `useTranslation`:

```tsx
export default function Sidebar({ current, onNavigate }: Props) {
  const { t } = useTranslation('common')
  // ... existing state ...

  const nav: { id: Page; label: string; icon: React.ReactNode; group?: string }[] = [
    { id: 'dashboard',   label: t('nav.dashboard'),   icon: <LayoutDashboard size={17} /> },
    { id: 'cleanup',     label: t('nav.cleanup'),      icon: <Sparkles size={17} />,      group: t('nav.groups.clean') },
    { id: 'devcaches',   label: t('nav.devcaches'),   icon: <Code2 size={17} />,         group: t('nav.groups.clean') },
    { id: 'uninstall',   label: t('nav.uninstall'),   icon: <AppWindow size={17} />,     group: t('nav.groups.manage') },
    { id: 'installer',   label: t('nav.installer'),   icon: <Archive size={17} />,       group: t('nav.groups.manage') },
    { id: 'logs',        label: t('nav.logs'),        icon: <FileText size={17} />,      group: t('nav.groups.manage') },
    { id: 'nodemodules', label: t('nav.nodemodules'), icon: <FolderX size={17} />,       group: t('nav.groups.manage') },
    { id: 'analyzer',    label: t('nav.analyzer'),    icon: <HardDrive size={17} />,     group: t('nav.groups.monitor') },
    { id: 'processes',   label: t('nav.processes'),   icon: <Activity size={17} />,      group: t('nav.groups.monitor') },
    { id: 'history',     label: t('nav.history'),     icon: <Clock size={17} />,         group: t('nav.groups.monitor') },
    { id: 'settings',    label: t('nav.settings'),    icon: <Settings size={17} /> },
  ]
```

Also update the group filter to use dynamic group values (replace hardcoded `"Clean"`, `"Manage"`, `"Monitor"` with `t('nav.groups.clean')` etc.).

- [ ] **Step 5: Migrate CLI status strings**

Replace hardcoded strings in the CLI status section:

```tsx
{cliStatus === 'installing' && (
  <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(251,191,36,0.8)' }}>
    <Loader2 size={11} className="animate-spin" />
    {t('status.cliInstalling')}
  </div>
)}
{cliStatus === 'ready' && (
  <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(52,211,153,0.65)' }}>
    <CheckCircle2 size={11} />
    {t('status.cliReady')}
  </div>
)}
{cliStatus === 'failed' && (
  <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(248,113,113,0.8)' }} title={failMsg}>
    <AlertCircle size={11} />
    {t('status.cliFailed')}
  </div>
)}
```

- [ ] **Step 6: Verify type-check + commit**

```bash
cd frontend && npm run type-check 2>&1 | grep -c error || true
git add frontend/src/components/Sidebar.tsx
git commit -m "feat(i18n): add language switcher pill and migrate Sidebar strings"
```

---

### Task 11: Migrate all 14 existing pages to useTranslation

**Files:**
- Modify: `frontend/src/pages/*.tsx` (all 14 pages)

- [ ] **Step 1: Add useTranslation to each page (pattern)**

For every page, add the import and hook. Example for `Dashboard.tsx`:

```tsx
// Add import:
import { useTranslation } from 'react-i18next'

// Inside component, first line:
const { t } = useTranslation(['dashboard', 'common'])
```

Then replace hardcoded strings. Examples:
- `"Dashboard"` → `t('dashboard:title')`
- `"Health Score"` → `t('dashboard:healthScore')`
- `"CPU"` → `t('dashboard:metrics.cpu')`
- `"Refresh"` → `t('common:button.refresh')`
- `"No flagged processes."` → `t('dashboard:processes.noWarnings')`

- [ ] **Step 2: Apply the same pattern to all remaining pages**

For each page below, add `useTranslation` and replace hardcoded strings with `t()` calls using the matching locale file keys from Task 9:

| Page | Namespace | Key examples |
|------|-----------|-------------|
| `DevCaches.tsx` | `devcaches` | `t('devcaches:title')`, `t('devcaches:description')`, `t('common:button.refresh')` |
| `Processes.tsx` | `processes` | `t('processes:title')`, `t('processes:noFlagged')`, `t('common:button.kill')` |
| `History.tsx` | `history` | `t('history:title')`, `t('history:empty')`, `t('history:columns.operation')` |
| `Settings.tsx` | `settings` | `t('settings:title')`, `t('settings:loginItem.label')` |
| `Analyzer.tsx` | `analyzer` | `t('analyzer:title')`, `t('analyzer:scanning')` |
| `Cleaner.tsx` | `cleaner` | `t('cleaner:title')`, `t('cleaner:dryRunNote')` |
| `Optimizer.tsx` | `optimizer` | `t('optimizer:title')`, `t('optimizer:completed')` |
| `Installer.tsx` | `installer` | `t('installer:title')`, `t('installer:empty')` |
| `Logs.tsx` | `logs` | `t('logs:title')`, `t('logs:empty')` |
| `NodeModules.tsx` | `nodemodules` | `t('nodemodules:title')`, `t('nodemodules:scanning')` |
| `Purge.tsx` | `purge` | `t('purge:title')`, `t('purge:empty')` |
| `Uninstall.tsx` | `uninstall` | `t('uninstall:title')`, `t('uninstall:confirm')` |

- [ ] **Step 3: Run type-check and fix any errors**

```bash
cd frontend && npm run type-check 2>&1 | head -40
```

Fix any TypeScript errors (unused imports, missing types).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/
git commit -m "feat(i18n): migrate all 14 pages to useTranslation"
```

---

### Task 12: Cleanup.tsx — add Browser / AI / App tabs

**Files:**
- Modify: `frontend/src/pages/Cleanup.tsx`

- [ ] **Step 1: Add new imports to Cleanup.tsx**

```tsx
import { useTranslation } from 'react-i18next'
import { Shield, AlertTriangle, Eye as EyeIcon } from 'lucide-react'
import {
  GetBrowserCaches, CleanBrowserCaches,
  GetAICaches, CleanAICaches,
  GetAppCaches, CleanAppCaches,
} from '../../wailsjs/go/main/DevCacheService'
import type { main } from '../../wailsjs/go/models'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
```

- [ ] **Step 2: Add `SafetyBadge` sub-component**

Add before `export default function Cleanup()`:

```tsx
function SafetyBadge({ level }: { level: string }) {
  const { t } = useTranslation('common')
  const cfg = {
    safe:    { icon: <Shield size={11} />, color: '#34d399', label: t('badge.safe') },
    caution: { icon: <AlertTriangle size={11} />, color: '#f59e0b', label: t('badge.caution') },
    manual:  { icon: <EyeIcon size={11} />, color: '#f87171', label: t('badge.manual') },
  }[level] ?? { icon: null, color: '#94a3b8', label: level }

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-md"
      style={{ color: cfg.color, background: `${cfg.color}18`, border: `1px solid ${cfg.color}30` }}>
      {cfg.icon}{cfg.label}
    </span>
  )
}
```

- [ ] **Step 3: Add `CacheItem` sub-component**

```tsx
function CacheItem({
  target,
  checked,
  onToggle,
}: {
  target: main.CacheTarget
  checked: boolean
  onToggle: (id: string) => void
}) {
  const { t } = useTranslation('cleanup')
  const categoryNs = target.category as 'browser' | 'ai' | 'app'

  const name = t(`${categoryNs}.targets.${target.id}.name`, { defaultValue: target.name })
  const description = t(`${categoryNs}.targets.${target.id}.description`, { defaultValue: '' })
  const safetyNote = t(`${categoryNs}.targets.${target.id}.safetyNote`, { defaultValue: '' })

  const isUnavailable = target.unavailable

  return (
    <div
      className="flex flex-col gap-1.5 p-3 rounded-xl transition-all"
      style={{
        background: checked ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${checked ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.07)'}`,
        opacity: isUnavailable ? 0.5 : 1,
      }}
    >
      <div className="flex items-start gap-3">
        {!isUnavailable && (
          <input
            type="checkbox"
            checked={checked}
            onChange={() => onToggle(target.id)}
            className="mt-0.5 accent-violet-500 cursor-pointer"
          />
        )}
        {isUnavailable && <span className="w-4 h-4 mt-0.5 rounded-sm" style={{ background: 'rgba(255,255,255,0.08)' }} />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white">{name}</span>
            <SafetyBadge level={target.safety_level} />
            {target.size_mb > 0 && (
              <span className="text-xs text-white/40 ml-auto">{target.size_mb >= 1024
                ? `${(target.size_mb / 1024).toFixed(1)} GB`
                : `${target.size_mb} MB`}</span>
            )}
          </div>
          {description && (
            <p className="text-xs text-white/40 mt-1 leading-relaxed">{description}</p>
          )}
          {safetyNote && (
            <p className="text-xs mt-1.5" style={{ color: 'rgba(139,92,246,0.75)' }}>{safetyNote}</p>
          )}
          {isUnavailable && target.unavailable_reason && (
            <p className="text-xs mt-1" style={{ color: 'rgba(248,113,113,0.7)' }}>
              {target.unavailable_reason}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add `SelectiveCleanTab` sub-component**

```tsx
type SelectiveTab = 'browser' | 'ai' | 'app'

function SelectiveCleanTab({ category }: { category: SelectiveTab }) {
  const { t } = useTranslation(['cleanup', 'common'])
  const [targets, setTargets] = useState<main.CacheTarget[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [results, setResults] = useState<main.DevCacheResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const getFn = category === 'browser' ? GetBrowserCaches
    : category === 'ai' ? GetAICaches
    : GetAppCaches
  const cleanFn = category === 'browser' ? CleanBrowserCaches
    : category === 'ai' ? CleanAICaches
    : CleanAppCaches

  const load = () => {
    setLoading(true)
    setError(null)
    getFn()
      .then((data) => {
        const visible = (data ?? []).filter((t) => t.exists || t.unavailable)
        setTargets(visible)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t('common:error.scanFailed'))
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [category])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => setSelected(new Set(targets.filter((t) => t.exists && !t.unavailable).map((t) => t.id)))
  const deselectAll = () => setSelected(new Set())

  const totalSelectedMB = targets
    .filter((t) => selected.has(t.id))
    .reduce((sum, t) => sum + t.size_mb, 0)

  const totalSize = totalSelectedMB >= 1024
    ? `${(totalSelectedMB / 1024).toFixed(1)} GB`
    : `${totalSelectedMB} MB`

  const runClean = async () => {
    setShowConfirm(false)
    setCleaning(true)
    setResults([])
    try {
      const res = await cleanFn(Array.from(selected))
      setResults(res ?? [])
      load()
      setSelected(new Set())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common:error.cleanFailed'))
    } finally {
      setCleaning(false)
    }
  }

  const visibleTargets = targets.filter((t) => t.exists || t.unavailable)
  const selectableCount = targets.filter((t) => t.exists && !t.unavailable).length

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-white/40 py-4">
        <SpinnerRing /> {t('common:status.scanning')}
      </div>
    )
  }

  if (!loading && visibleTargets.length === 0) {
    return (
      <p className="text-sm text-white/40 py-4">{t(`cleanup:${category}.empty`)}</p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="px-3 py-2 rounded-xl text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {visibleTargets.map((target) => (
          <CacheItem
            key={target.id}
            target={target}
            checked={selected.has(target.id)}
            onToggle={toggle}
          />
        ))}
      </div>

      {results.length > 0 && (
        <div className="flex flex-col gap-1">
          {results.map((r) => (
            <div key={r.id} className="text-xs flex items-center gap-2"
              style={{ color: r.success ? '#34d399' : '#f87171' }}>
              {r.success ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
              {r.success ? t('cleanup:results.freed', { size: r.freed }) : t('cleanup:results.error', { message: r.error })}
            </div>
          ))}
        </div>
      )}

      {selectableCount > 0 && (
        <div className="flex items-center gap-3 pt-1">
          <button onClick={selectAll} className="text-xs text-white/40 hover:text-white/70 transition-colors">
            {t('common:button.selectAll')}
          </button>
          <button onClick={deselectAll} className="text-xs text-white/40 hover:text-white/70 transition-colors">
            {t('common:button.deselectAll')}
          </button>
          <div className="flex-1" />
          <Button
            size="sm"
            disabled={selected.size === 0 || cleaning}
            onClick={() => setShowConfirm(true)}
            className="gap-2"
            style={{ background: selected.size > 0 ? 'linear-gradient(135deg,#8b5cf6,#6366f1)' : undefined }}
          >
            {cleaning ? <SpinnerRing /> : <Trash2 size={13} />}
            {cleaning ? t('common:status.running') : `${t('common:button.clean')} · ${totalSize}`}
          </Button>
        </div>
      )}

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent style={{ background: 'rgba(18,18,28,0.97)', border: '1px solid rgba(139,92,246,0.2)' }}>
          <DialogHeader>
            <DialogTitle className="text-white">{t('common:confirm.title')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-white/60">
            {t('common:confirm.body', { size: totalSize, count: selected.size })}
          </p>
          <ScrollArea className="max-h-48">
            <div className="flex flex-col gap-1 pr-3">
              {targets.filter((t) => selected.has(t.id)).map((target) => {
                const name = t(`cleanup:${category}.targets.${target.id}.name`, { defaultValue: target.name })
                const note = t(`cleanup:${category}.targets.${target.id}.safetyNote`, { defaultValue: '' })
                return (
                  <div key={target.id} className="text-xs text-white/50 py-1 border-b border-white/5">
                    <span className="text-white/80 font-medium">{name}</span>
                    {note && <span className="block mt-0.5 text-white/40">{note}</span>}
                  </div>
                )
              })}
            </div>
          </ScrollArea>
          <DialogFooter className="gap-2">
            <Button variant="glass" size="sm" onClick={() => setShowConfirm(false)}>
              {t('common:confirm.cancel')}
            </Button>
            <Button size="sm" onClick={() => { void runClean() }}
              style={{ background: 'linear-gradient(135deg,#8b5cf6,#6366f1)' }}>
              {t('common:confirm.proceed')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 5: Integrate into `Cleanup.tsx` main component**

Update the `Cleanup` component to add 3 new tabs alongside existing ones. Add these imports at the top of the existing type/config:

```tsx
// Add to existing imports:
import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// Extend Tab type:
type Tab = 'clean' | 'optimize' | 'purge' | 'browser' | 'ai' | 'app'
```

In the `Cleanup` component return, add a second `Tabs` group after the existing one:

```tsx
{/* Existing tabs (unchanged) */}
<Tabs value={tab} onValueChange={(v) => { if (!running) setTab(v as Tab) }}>
  <TabsList className="w-full">
    {(['clean', 'optimize', 'purge'] as const).map((t) => (
      <TabsTrigger key={t} value={t} className="flex-1" disabled={running}>
        {t === 'clean' ? t_('tabs.deepClean') : t === 'optimize' ? t_('tabs.optimize') : t_('tabs.purge')}
      </TabsTrigger>
    ))}
  </TabsList>
</Tabs>

{/* New selective cleanup tabs */}
<div className="mt-2">
  <p className="text-xs uppercase tracking-wider px-1 mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
    Selective Cleanup
  </p>
  <Tabs value={['browser','ai','app'].includes(tab) ? tab : undefined}
    onValueChange={(v) => setTab(v as Tab)}>
    <TabsList className="w-full">
      <TabsTrigger value="browser" className="flex-1">{t_('tabs.browser')}</TabsTrigger>
      <TabsTrigger value="ai" className="flex-1">{t_('tabs.ai')}</TabsTrigger>
      <TabsTrigger value="app" className="flex-1">{t_('tabs.app')}</TabsTrigger>
    </TabsList>
  </Tabs>
</div>

{/* Render selective tab content */}
{tab === 'browser' && <SelectiveCleanTab category="browser" />}
{tab === 'ai' && <SelectiveCleanTab category="ai" />}
{tab === 'app' && <SelectiveCleanTab category="app" />}
```

Add `const { t: t_ } = useTranslation('cleanup')` at top of the `Cleanup` function.

- [ ] **Step 6: Migrate existing Cleanup.tsx strings to i18n**

Replace hardcoded strings in the existing Deep Clean / Optimize / Purge section:

```tsx
// TAB_CONFIG: replace hardcoded description strings with t() calls
// dangerLevel labels: use t('common:badge.safe'), t('common:badge.caution')
// Button labels: t('common:button.dryRun'), t('common:button.run')
// Status messages: t('cleaner:completed'), t('cleaner:completedWithErrors')
```

- [ ] **Step 7: Type-check + commit**

```bash
cd frontend && npm run type-check 2>&1 | grep -c "error TS" || true
git add frontend/src/pages/Cleanup.tsx
git commit -m "feat: add Browser/AI/App selective cleanup tabs to Cleanup.tsx"
```

---

### Task 13: Lint + type-check + build

**Files:** No new files — verification only.

- [ ] **Step 1: Frontend lint**

```bash
cd frontend && npm run lint
```

Fix any ESLint errors (unused imports, missing keys, `any` types).

- [ ] **Step 2: Frontend type-check**

```bash
cd frontend && npm run type-check
```

Expected: 0 errors.

- [ ] **Step 3: Go lint**

```bash
golangci-lint run ./...
```

Fix any issues (unused imports, `G204` nosec annotations, error handling).

- [ ] **Step 4: Production build**

```bash
wails build
```

Expected: `build/bin/MacMole.app` created with no errors.

- [ ] **Step 5: Smoke test**

Open `build/bin/MacMole.app`:
- Language switcher visible in sidebar — toggle EN/ID and confirm nav labels change
- Cleanup page → Browser tab loads and shows Chrome/Arc/Playwright targets (if present)
- Cleanup page → AI tab shows Claude vm_bundles (if present)
- Cleanup page → App tab shows Docker items with unavailable state if Docker not running
- Safety badges render correctly per level
- Confirm dialog appears before clean executes

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: lint fixes and verified production build"
```
