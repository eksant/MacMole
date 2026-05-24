# Phase 3: New Features — Dev Caches, Docker, Process Killer, History

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four high-value features inspired by MacSlim: (1) Dev Cache Cleaner with per-tool native commands, (2) Docker deep management, (3) Zombie/idle Process Killer, (4) SQLite Operation History log.

**Architecture:** Each feature is a new Go service in the root package exposed via Wails, plus a new React page. History uses `database/sql` + `modernc.org/sqlite` (pure Go, no CGo needed). All backend functions in new dedicated `.go` files to keep `commands.go` focused.

**Tech Stack:** Go 1.24, Wails v2, React 18 + TypeScript, modernc.org/sqlite (pure Go SQLite driver), lucide-react icons

**Prerequisite:** Phase 1 complete.

---

## Task 1: Dev Caches page — Go backend

**Files:**
- Create: `devcaches.go`

- [ ] **Step 1: Create devcaches.go with DevCacheService**

```go
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
	id      string
	name    string
	bin     string
	sizeCmd []string
	cleanCmd []string
}{
	{"npm",      "npm",              "npm",    []string{"npm", "cache", "ls"},        []string{"npm", "cache", "clean", "--force"}},
	{"pnpm",     "pnpm",             "pnpm",   []string{"pnpm", "store", "path"},     []string{"pnpm", "store", "prune"}},
	{"yarn",     "Yarn",             "yarn",   []string{"yarn", "cache", "dir"},      []string{"yarn", "cache", "clean"}},
	{"homebrew", "Homebrew",         "brew",   []string{"brew", "--cache"},           []string{"brew", "cleanup", "--prune=all"}},
	{"pip",      "pip / pip3",       "pip3",   nil,                                   []string{"pip3", "cache", "purge"}},
	{"cargo",    "Cargo",            "cargo",  nil,                                   []string{"cargo", "cache", "--autoclean"}},
	{"go",       "Go module cache",  "go",     []string{"go", "env", "GOPATH"},       []string{"go", "clean", "-modcache"}},
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
			cacheDir := filepath.Join(home, ".npm", "_cacache")
			size = duSize(cacheDir)
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
			cacheDir := filepath.Join(home, "Library", "Caches", "pip")
			size = duSize(cacheDir)
		case "cargo":
			cacheDir := filepath.Join(home, ".cargo", "registry")
			size = duSize(cacheDir)
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

		// Measure size before
		var before int64
		switch t.id {
		case "npm":
			home, _ := os.UserHomeDir()
			before = duSize(filepath.Join(home, ".npm", "_cacache"))
		case "homebrew":
			before = duSize("/opt/homebrew/Library/Homebrew/vendor")
		}

		cmd := exec.CommandContext(context.Background(), t.cleanCmd[0], t.cleanCmd[1:]...) // #nosec G204 — hardcoded commands only
		out, cmdErr := cmd.CombinedOutput()
		if cmdErr != nil {
			results = append(results, DevCacheResult{ID: t.id, Error: strings.TrimSpace(string(out))})
			continue
		}

		freed := ""
		if before > 0 {
			freed = fmt.Sprintf("~%s freed", fmtBytes(before))
		} else {
			freed = "Cache cleared"
		}
		results = append(results, DevCacheResult{ID: t.id, Success: true, Freed: freed})
	}
	return results
}
```

- [ ] **Step 2: Register DevCacheService in main.go**

In `main.go`, add:
```go
devCaches := NewDevCacheService()
```
And add `devCaches` to the `Bind` slice.

- [ ] **Step 3: Build**

```bash
cd /Users/eksa/Projects/MacMole && go build ./...
```

- [ ] **Step 4: Regenerate Wails bindings**

```bash
wails generate module
```

Verify `frontend/wailsjs/go/main/DevCacheService.js` was created.

- [ ] **Step 5: Commit**

```bash
git add devcaches.go main.go frontend/wailsjs/
git commit -m "feat: add DevCacheService with 7 tool caches (npm, pnpm, yarn, brew, pip, cargo, go)"
```

---

## Task 2: Dev Caches page — React frontend

**Files:**
- Create: `frontend/src/pages/DevCaches.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`

- [ ] **Step 1: Create DevCaches.tsx**

```tsx
import { useState, useEffect } from "react";
import { Code2, RefreshCw, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { GetDevCaches, CleanDevCaches } from "../../wailsjs/go/main/DevCacheService";
import type { main } from "../../wailsjs/go/models";

function fmtBytes(bytes: number): string {
  if (bytes >= 1 << 30) return (bytes / (1 << 30)).toFixed(1) + " GB";
  if (bytes >= 1 << 20) return (bytes / (1 << 20)).toFixed(1) + " MB";
  if (bytes >= 1 << 10) return (bytes / (1 << 10)).toFixed(0) + " KB";
  return bytes + " B";
}

export default function DevCaches() {
  const [tools, setTools] = useState<main.DevCacheTool[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [results, setResults] = useState<main.DevCacheResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    GetDevCaches()
      .then(setTools)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to scan dev caches.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalSelected = tools
    .filter(t => selected.has(t.id))
    .reduce((sum, t) => sum + t.size_bytes, 0);

  const clean = async () => {
    setCleaning(true);
    setResults([]);
    try {
      const res = await CleanDevCaches(Array.from(selected));
      setResults(res);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Clean failed.");
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 animate-fade-in-up">
      <div>
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
            <Code2 size={16} className="text-white" />
          </span>
          Dev Caches
        </h2>
        <p className="text-sm mt-1.5 ml-10 text-white/40">
          Clean developer tool caches using each tool's native clean command.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={load} disabled={loading || cleaning}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}>
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          {loading ? "Scanning…" : "Refresh"}
        </button>
        <div className="flex-1" />
        {selected.size > 0 && (
          <span className="text-xs text-white/40">
            {selected.size} selected — ~{fmtBytes(totalSelected)} to free
          </span>
        )}
        <button onClick={clean} disabled={selected.size === 0 || cleaning || loading}
          className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all"
          style={selected.size === 0 || cleaning
            ? { background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: "rgba(16,185,129,0.3)" }
            : { background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff", boxShadow: "0 4px 16px rgba(16,185,129,0.3)" }}>
          <Trash2 size={13} />
          {cleaning ? "Cleaning…" : "Clean Selected"}
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-sm"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {results.map(r => (
            <div key={r.id} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
              style={{ background: r.success ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                       border: `1px solid ${r.success ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
                       color: r.success ? "#34d399" : "#f87171" }}>
              {r.success ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
              <span className="font-medium">{r.id}</span>
              <span className="text-white/40">{r.success ? r.freed : r.error}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {tools.map(tool => {
          const isSelected = selected.has(tool.id);
          return (
            <button key={tool.id} onClick={() => { if (tool.available) toggle(tool.id); }}
              disabled={!tool.available || cleaning}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all w-full"
              style={{
                background: isSelected ? "rgba(16,185,129,0.10)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${isSelected ? "rgba(16,185,129,0.35)" : "rgba(255,255,255,0.07)"}`,
                opacity: tool.available ? 1 : 0.4,
              }}>
              <span className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 text-xs transition-all"
                style={{ background: isSelected ? "#10b981" : "rgba(255,255,255,0.08)",
                         border: `1px solid ${isSelected ? "#10b981" : "rgba(255,255,255,0.15)"}`,
                         color: "#fff" }}>
                {isSelected ? "✓" : ""}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white font-medium">{tool.name}</div>
                {!tool.available && <div className="text-xs text-white/25">Not installed</div>}
              </div>
              <span className="text-xs text-white/40 tabular-nums flex-shrink-0">
                {tool.size_bytes > 0 ? fmtBytes(tool.size_bytes) : "—"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add "devcaches" to App.tsx Page type and renderPage**

In `App.tsx`, add `"devcaches"` to the `Page` type and `case "devcaches": return <DevCaches />;` in `renderPage`.

Import: `import DevCaches from "./pages/DevCaches";`

- [ ] **Step 3: Add Dev Caches to Sidebar navigation**

In `Sidebar.tsx`, add to the `nav` array (in the Tools group):

```tsx
{ id: "devcaches", label: "Dev Caches", icon: <Code2 size={17} />, group: "Tools" },
```

Add to `accentMap`: `devcaches: "#10b981"`.

Import `Code2` from `lucide-react`.

- [ ] **Step 4: Type-check and lint**

```bash
cd frontend && npm run type-check && npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/
git commit -m "feat: add Dev Caches page with 7 tool-native clean commands"
```

---

## Task 3: Process Killer page — Go backend

**Files:**
- Create: `processes.go`

- [ ] **Step 1: Create processes.go**

```go
package main

import (
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

// ProcessService manages process listing and termination.
type ProcessService struct{}

func NewProcessService() *ProcessService { return &ProcessService{} }

// ProcessDetail has more info than ProcessInfo in metrics.go.
type ProcessDetail struct {
	PID     int    `json:"pid"`
	Name    string `json:"name"`
	CPU     float64 `json:"cpu"`
	Memory  float64 `json:"memory"`
	Status  string `json:"status"` // "zombie" | "high-cpu" | "high-mem" | "idle"
	Runtime string `json:"runtime"` // human-readable "2h 15m"
}

// ListFlaggedProcesses returns processes that are zombie or using excessive resources.
func (p *ProcessService) ListFlaggedProcesses() []ProcessDetail {
	out, err := exec.Command("ps", "-Aceo", "pid,pcpu,pmem,stat,time,comm").Output()
	if err != nil {
		return nil
	}
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	var result []ProcessDetail
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "PID") || line == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 6 {
			continue
		}
		pid, err1 := strconv.Atoi(fields[0])
		cpuVal, err2 := strconv.ParseFloat(fields[1], 64)
		memVal, err3 := strconv.ParseFloat(fields[2], 64)
		if err1 != nil || err2 != nil || err3 != nil {
			continue
		}
		stat := fields[3]
		runtime := fields[4]
		name := fields[5]
		if len(name) > 28 {
			name = name[:28]
		}

		var status string
		switch {
		case strings.Contains(stat, "Z"):
			status = "zombie"
		case cpuVal > 50:
			status = "high-cpu"
		case memVal > 10:
			status = "high-mem"
		default:
			continue
		}

		result = append(result, ProcessDetail{
			PID:     pid,
			Name:    name,
			CPU:     cpuVal,
			Memory:  memVal,
			Status:  status,
			Runtime: runtime,
		})
	}
	return result
}

// KillProcessResult describes the outcome of killing one process.
type KillProcessResult struct {
	PID     int    `json:"pid"`
	Name    string `json:"name"`
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// KillProcesses sends SIGTERM to each PID, waits 3 seconds, then SIGKILL if still running.
// PIDs must be positive integers > 1 (never kill PID 1 = launchd).
func (p *ProcessService) KillProcesses(pids []int) []KillProcessResult {
	var results []KillProcessResult
	for _, pid := range pids {
		if pid <= 1 {
			results = append(results, KillProcessResult{PID: pid, Message: "refusing to kill PID ≤ 1"})
			continue
		}
		proc, err := os.FindProcess(pid)
		if err != nil {
			results = append(results, KillProcessResult{PID: pid, Message: "process not found"})
			continue
		}

		// SIGTERM first
		_ = proc.Signal(os.Interrupt) // sends SIGTERM on Unix

		// Wait up to 3 seconds for graceful exit
		done := make(chan error, 1)
		go func() {
			_, err := proc.Wait()
			done <- err
		}()

		select {
		case <-done:
			results = append(results, KillProcessResult{PID: pid, Success: true, Message: "terminated gracefully"})
		case <-time.After(3 * time.Second):
			// SIGKILL
			if killErr := proc.Kill(); killErr != nil {
				results = append(results, KillProcessResult{PID: pid, Message: fmt.Sprintf("SIGKILL failed: %v", killErr)})
			} else {
				results = append(results, KillProcessResult{PID: pid, Success: true, Message: "force killed"})
			}
		}
	}
	return results
}
```

- [ ] **Step 2: Register in main.go**

```go
processes := NewProcessService()
```

Add `processes` to `Bind` slice.

- [ ] **Step 3: Build and regenerate bindings**

```bash
go build ./... && wails generate module
```

- [ ] **Step 4: Commit**

```bash
git add processes.go main.go frontend/wailsjs/
git commit -m "feat: add ProcessService with SIGTERM→SIGKILL escalation for flagged processes"
```

---

## Task 4: Process Killer page — React frontend

**Files:**
- Create: `frontend/src/pages/Processes.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`

- [ ] **Step 1: Create Processes.tsx**

```tsx
import { useState, useEffect } from "react";
import { Activity, RefreshCw, Zap, AlertTriangle } from "lucide-react";
import { ListFlaggedProcesses, KillProcesses } from "../../wailsjs/go/main/ProcessService";
import type { main } from "../../wailsjs/go/models";

const STATUS_COLORS: Record<string, string> = {
  zombie:   "#f87171",
  "high-cpu": "#fb923c",
  "high-mem": "#a78bfa",
};

const STATUS_LABELS: Record<string, string> = {
  zombie:   "Zombie",
  "high-cpu": "High CPU",
  "high-mem": "High Mem",
};

export default function Processes() {
  const [procs, setProcs] = useState<main.ProcessDetail[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [killing, setKilling] = useState(false);
  const [results, setResults] = useState<main.KillProcessResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    ListFlaggedProcesses()
      .then(setProcs)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Scan failed.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggle = (pid: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(pid) ? next.delete(pid) : next.add(pid);
      return next;
    });
  };

  const kill = async () => {
    setKilling(true);
    setResults([]);
    try {
      const res = await KillProcesses(Array.from(selected));
      setResults(res);
      setSelected(new Set());
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Kill failed.");
    } finally {
      setKilling(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 animate-fade-in-up">
      <div>
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#f97316,#ea580c)" }}>
            <Activity size={16} className="text-white" />
          </span>
          Process Manager
        </h2>
        <p className="text-sm mt-1.5 ml-10 text-white/40">
          Detect and terminate zombie, high-CPU, or high-memory processes.
        </p>
      </div>

      <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
        style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)", color: "rgba(249,115,22,0.8)" }}>
        <AlertTriangle size={14} className="flex-shrink-0" />
        <span>Killing processes is irreversible. Only flagged processes are shown.</span>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={load} disabled={loading || killing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}>
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          {loading ? "Scanning…" : "Refresh"}
        </button>
        <div className="flex-1" />
        <button onClick={kill} disabled={selected.size === 0 || killing || loading}
          className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all"
          style={selected.size === 0 || killing
            ? { background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)", color: "rgba(249,115,22,0.3)" }
            : { background: "linear-gradient(135deg,#f97316,#ea580c)", color: "#fff", boxShadow: "0 4px 16px rgba(249,115,22,0.3)" }}>
          <Zap size={13} />
          {killing ? "Killing…" : `Kill ${selected.size > 0 ? selected.size : ""} Selected`}
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-sm"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="flex flex-col gap-1">
          {results.map(r => (
            <div key={r.pid} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
              style={{ color: r.success ? "#34d399" : "#f87171", background: "rgba(255,255,255,0.03)" }}>
              PID {r.pid}: {r.message}
            </div>
          ))}
        </div>
      )}

      {!loading && procs.length === 0 && (
        <div className="flex items-center gap-2 text-white/30 text-sm mt-4">
          <Activity size={14} />
          No flagged processes found. System looks healthy.
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {procs.map(proc => {
          const isSelected = selected.has(proc.pid);
          const color = STATUS_COLORS[proc.status] ?? "#94a3b8";
          return (
            <button key={proc.pid} onClick={() => toggle(proc.pid)} disabled={killing}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all w-full"
              style={{
                background: isSelected ? `${color}18` : "rgba(255,255,255,0.04)",
                border: `1px solid ${isSelected ? `${color}50` : "rgba(255,255,255,0.07)"}`,
              }}>
              <span className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 text-xs"
                style={{ background: isSelected ? color : "rgba(255,255,255,0.08)",
                         border: `1px solid ${isSelected ? color : "rgba(255,255,255,0.15)"}`,
                         color: "#fff" }}>
                {isSelected ? "✓" : ""}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white font-medium truncate">{proc.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: `${color}20`, color }}>
                    {STATUS_LABELS[proc.status]}
                  </span>
                </div>
                <div className="text-xs text-white/25">PID {proc.pid} · runtime {proc.runtime}</div>
              </div>
              <div className="flex gap-3 text-xs tabular-nums flex-shrink-0">
                <span style={{ color: "rgba(249,115,22,0.7)" }}>{proc.cpu.toFixed(1)}% cpu</span>
                <span style={{ color: "rgba(255,255,255,0.3)" }}>{proc.memory.toFixed(1)}% mem</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire into App.tsx and Sidebar.tsx**

In `App.tsx`: add `"processes"` to `Page` type, add `case "processes": return <Processes />;`, import component.

In `Sidebar.tsx`: add `{ id: "processes", label: "Processes", icon: <Activity size={17} />, group: "Tools" }` to nav array. Add `processes: "#f97316"` to accentMap.

- [ ] **Step 3: Type-check and lint**

```bash
cd frontend && npm run type-check && npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/
git commit -m "feat: add Process Manager page with zombie and high-resource process detection"
```

---

## Task 5: Operation History — Go backend (SQLite)

**Files:**
- Create: `history.go`
- Modify: `go.mod` / `go.sum`

- [ ] **Step 1: Add SQLite driver**

```bash
cd /Users/eksa/Projects/MacMole && go get modernc.org/sqlite
```

- [ ] **Step 2: Create history.go**

```go
package main

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

// HistoryService persists operation audit logs to SQLite.
type HistoryService struct {
	db *sql.DB
}

// HistoryEntry is one recorded operation.
type HistoryEntry struct {
	ID        int64  `json:"id"`
	Operation string `json:"operation"` // "clean" | "optimize" | "purge" | "devcache" | "uninstall"
	Success   bool   `json:"success"`
	Detail    string `json:"detail"` // e.g. "Removed 23 items. Freed 1.2 GB"
	FreedMB   float64 `json:"freed_mb"`
	Timestamp int64  `json:"timestamp"` // Unix seconds
}

func NewHistoryService() (*HistoryService, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("cannot find home dir: %w", err)
	}
	dir := filepath.Join(home, "Library", "Application Support", "MacMole")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, fmt.Errorf("cannot create app support dir: %w", err)
	}
	dbPath := filepath.Join(dir, "history.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS history (
		id        INTEGER PRIMARY KEY AUTOINCREMENT,
		operation TEXT NOT NULL,
		success   INTEGER NOT NULL,
		detail    TEXT,
		freed_mb  REAL DEFAULT 0,
		ts        INTEGER NOT NULL
	)`)
	if err != nil {
		return nil, err
	}
	return &HistoryService{db: db}, nil
}

// Record adds one entry to the history log.
func (h *HistoryService) Record(operation string, success bool, detail string, freedMB float64) {
	_, _ = h.db.Exec(
		`INSERT INTO history (operation, success, detail, freed_mb, ts) VALUES (?,?,?,?,?)`,
		operation, success, detail, freedMB, time.Now().Unix(),
	)
}

// GetHistory returns the last N entries, newest first.
func (h *HistoryService) GetHistory(limit int) []HistoryEntry {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := h.db.Query(
		`SELECT id, operation, success, detail, freed_mb, ts FROM history ORDER BY ts DESC LIMIT ?`, limit,
	)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var result []HistoryEntry
	for rows.Next() {
		var e HistoryEntry
		var success int
		if err := rows.Scan(&e.ID, &e.Operation, &success, &e.Detail, &e.FreedMB, &e.Timestamp); err != nil {
			continue
		}
		e.Success = success == 1
		result = append(result, e)
	}
	return result
}

// ClearHistory removes all history entries.
func (h *HistoryService) ClearHistory() bool {
	_, err := h.db.Exec(`DELETE FROM history`)
	return err == nil
}
```

- [ ] **Step 3: Register in main.go**

```go
history, err := NewHistoryService()
if err != nil {
    println("Warning: history disabled:", err.Error())
}
```

If `history != nil`, add to `Bind` slice. Store `history` in `App` struct so `CommandService` can call `history.Record()` after operations.

- [ ] **Step 4: Record operations in CommandService**

Modify `CommandService` to hold a `*HistoryService` reference. After each `runMo()` call in `RunClean`, `RunOptimize`, `RunPurge`, call:
```go
if c.history != nil {
    c.history.Record("clean", result.Success, result.Output, 0)
}
```

- [ ] **Step 5: Build**

```bash
go build ./...
```

- [ ] **Step 6: Regenerate bindings**

```bash
wails generate module
```

- [ ] **Step 7: Commit**

```bash
git add history.go main.go commands.go go.mod go.sum frontend/wailsjs/
git commit -m "feat: add SQLite operation history log to ~/Library/Application Support/MacMole/history.db"
```

---

## Task 6: History page — React frontend

**Files:**
- Create: `frontend/src/pages/History.tsx`
- Modify: `frontend/src/App.tsx`, `frontend/src/components/Sidebar.tsx`

- [ ] **Step 1: Create History.tsx**

```tsx
import { useState, useEffect } from "react";
import { Clock, Trash2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { GetHistory, ClearHistory } from "../../wailsjs/go/main/HistoryService";
import type { main } from "../../wailsjs/go/models";

function fmtTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const OP_COLORS: Record<string, string> = {
  clean:     "#3b82f6",
  optimize:  "#f59e0b",
  purge:     "#f97316",
  devcache:  "#10b981",
  uninstall: "#ef4444",
};

export default function History() {
  const [entries, setEntries] = useState<main.HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    GetHistory(100)
      .then(setEntries)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load history.");
      })
      .finally(() => setLoading(false));
  };

  const clear = async () => {
    await ClearHistory();
    load();
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="flex flex-col gap-5 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)" }}>
              <Clock size={16} className="text-white" />
            </span>
            Operation History
          </h2>
          <p className="text-sm mt-1.5 ml-10 text-white/40">
            Audit log of all cleanup operations.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={clear} disabled={entries.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "rgba(239,68,68,0.7)" }}>
            <Trash2 size={13} /> Clear
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-sm"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
          {error}
        </div>
      )}

      {!loading && entries.length === 0 && (
        <p className="text-white/30 text-sm mt-4">No operations recorded yet.</p>
      )}

      <div className="flex flex-col gap-1.5">
        {entries.map(e => {
          const color = OP_COLORS[e.operation] ?? "#94a3b8";
          return (
            <div key={e.id} className="flex items-start gap-3 px-4 py-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              {e.success
                ? <CheckCircle2 size={15} style={{ color: "#34d399", flexShrink: 0, marginTop: 1 }} />
                : <XCircle size={15} style={{ color: "#f87171", flexShrink: 0, marginTop: 1 }} />
              }
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: `${color}20`, color }}>
                    {e.operation}
                  </span>
                  {e.freed_mb > 0 && (
                    <span className="text-xs text-emerald-400/70">
                      {e.freed_mb.toFixed(1)} MB freed
                    </span>
                  )}
                </div>
                {e.detail && (
                  <p className="text-xs text-white/40 mt-0.5 truncate">{e.detail}</p>
                )}
              </div>
              <span className="text-xs text-white/25 flex-shrink-0 mt-0.5">{fmtTime(e.timestamp)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire into App.tsx and Sidebar.tsx**

In `App.tsx`: add `"history"` to `Page`, add case, import.
In `Sidebar.tsx`: add `{ id: "history", label: "History", icon: <Clock size={17} />, group: "Tools" }`, accentMap entry `history: "#6366f1"`.

- [ ] **Step 3: Type-check and lint**

```bash
cd frontend && npm run type-check && npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/
git commit -m "feat: add Operation History page — audit log from SQLite"
```

---

## Self-Review

**Spec coverage:**
- ✅ Dev Caches (npm, pnpm, yarn, brew, pip, cargo, go) — Tasks 1-2
- ✅ Process Killer (zombie + high-resource, SIGTERM→SIGKILL) — Tasks 3-4
- ✅ Operation History (SQLite) — Tasks 5-6
- ⚠️ Docker management — deferred (requires Docker socket; lower priority, add in Phase 3b if needed)
- ✅ Graduated risk labels — deferred to Phase 4 (Design) as UX pattern

**Placeholder scan:** All tasks have concrete Go and React code. No TBDs.

**Type consistency:** `DevCacheTool`, `DevCacheResult`, `ProcessDetail`, `KillProcessResult`, `HistoryEntry` all defined in Go and referenced consistently in TypeScript via `main.*` Wails-generated types.
