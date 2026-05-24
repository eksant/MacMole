# MacMole — Claude Instructions

## Project Overview

MacMole is a macOS system cleaner and optimizer — a native desktop app (Go + Wails v2) wrapping the `mole` CLI. It's NOT Electron. It uses the native WKWebView with a translucent dark UI.

**Modules:**
- Root (`desktop` module) — Wails desktop app (Go backend + React/TS frontend)
- `mole/` — Upstream CLI at `github.com/tw93/mole` (shell scripts + Go TUI)

---

## Build & Dev Commands

```bash
# Development (live reload, hot module replacement)
wails dev

# Production build (outputs to build/bin/MacMole.app)
wails build

# Frontend only (for CSS/component iteration)
cd frontend && npm run dev

# Go build check (no CGo needed for check, but full build requires macOS)
go build ./...

# Regen Wails JS bindings (run after adding/changing any Go service methods)
wails generate module

# Frontend lint + type-check
cd frontend && npm run lint && npm run type-check

# Go lint
golangci-lint run ./...

# Mole CLI build (separate Go module)
cd mole && go build ./...

# Mole CLI tests
cd mole && go test ./...
cd mole && bash scripts/test.sh  # full bats test suite
```

---

## Architecture

```
main.go           Wails app init — binds services, sets Mac appearance, menu
app.go            App struct, startup hook → wires services, calls initTray()
commands.go       CommandService — runs `mo` CLI, scans apps/logs/node_modules
metrics.go        MetricsService — system metrics via gopsutil (CPU/RAM/Disk/Net/Battery)
settings.go       SettingsService — login item (AppleScript), GitHub update check
tray_darwin.go    CGo bridge → calls Objective-C tray functions
tray_darwin.m     Native NSStatusItem + NSPopover (live metrics popover)
tray.go           Stub for non-darwin builds

frontend/src/
  pages/          One React page per feature (Dashboard, Cleaner, Optimizer, …)
  hooks/          useMetrics.ts — polling hook for GetMetrics() every 2s
  components/     Sidebar, MetricCard, GaugeBar, SpinnerRing
  utils/          notify.ts — Web Notification API wrapper
  wailsjs/        Auto-generated Wails JS bindings — DO NOT EDIT

mole/
  bin/            CLI entry scripts (analyze.sh, clean.sh, optimize.sh, …)
  lib/            Shell function libraries (core/, clean/, optimize/, …)
  cmd/analyze/    Go disk analyzer (BubbleTea TUI)
  cmd/status/     Go system status (gopsutil)
  internal/       Shared Go utilities (units/bytes.go)
```

---

## Critical Rules

### Go Backend
- **NEVER ignore `//go:embed` paths** — `build/trayicon.png` and `build/trayicon@2x.png` must exist at compile time
- **Run `wails generate module`** after any Go service struct or method changes — the JS bindings in `frontend/wailsjs/` are auto-generated
- **MetricsService has a `sync.RWMutex`** — always lock `mu` when reading/writing `prevNetSent`, `prevNetRecv`, `prevNetTime`
- **CommandService args are hardcoded** — never pass user input to `exec.Command`. All args come from hardcoded string literals
- **`tray_darwin.go` goroutine has a `trayDone` channel** — `StopTray()` must be called in `OnShutdown`
- **`safeHome()`** — always use this helper instead of `os.UserHomeDir()` directly; it returns `""` on error and callers return early

### Frontend
- **No `any` types** — `@typescript-eslint/no-explicit-any` is set to error
- **No unused variables** — `noUnusedLocals: true` in tsconfig
- **Use `type` imports** — `import type { Foo }` for TypeScript-only types
- **All `.catch()` must update error state** — never `.catch(console.error)` silently
- **`wailsjs/` is auto-generated** — do not edit files in `frontend/wailsjs/`
- **`fmtBytes` is defined per-page** — consistent implementation: `>>30` GB, `>>20` MB, `>>10` KB

### Mole CLI (`mole/`)
- Upstream source: `github.com/tw93/mole` — sync periodically
- Shell scripts use strict mode `set -euo pipefail`
- Tests use [bats-core](https://github.com/bats-core/bats-core)
- Go binaries compiled separately: `go build ./cmd/analyze/` → `bin/analyze-go`

---

## Icon Assets

| File | Size | Purpose |
|---|---|---|
| `docs/assets/macmole-icon-dark.svg` | Source SVG (dark) | Master icon — dark/navy theme |
| `docs/assets/macmole-icon-light.svg` | Source SVG (light) | Master icon — light theme |
| `docs/assets/macmole-mark.svg` | Mark SVG | Simplified mole mark (no background) |
| `docs/assets/macmole-icon-dark-1024.png` | 1024×1024 | Pre-rendered dark icon |
| `build/appicon.png` | 1024×1024 | macOS app icon (tracked, required by Wails) |
| `build/trayicon.png` | 18×18 | Menu bar tray icon @1x |
| `build/trayicon@2x.png` | 36×36 | Menu bar tray icon @2x retina |

To regenerate build icons from source (requires `brew install librsvg`):
```bash
cp docs/assets/macmole-icon-dark-1024.png build/appicon.png
rsvg-convert -w 18 -h 18 -o build/trayicon.png docs/assets/macmole-icon-dark.svg
rsvg-convert -w 36 -h 36 -o build/trayicon@2x.png docs/assets/macmole-icon-dark.svg
```

Note: `build/trayicon.png` is used as a template image (`[img setTemplate:YES]` in `tray_darwin.m`) — macOS renders it as monochrome in both light and dark menu bar appearances.

---

## Plans & Roadmap

Implementation plans live in `docs/superpowers/plans/`:
- `phase1-foundation.md` — Bug fixes + ESLint/Prettier/golangci-lint setup
- `phase2-cli-sync.md` — Sync upstream tw93/mole + expose new features
- `phase3-new-features.md` — Dev Caches, Process Killer, SQLite History
- `phase4-design.md` — Dashboard redesign, sidebar consolidation, UX polish

## Skills

Project skills are in `.claude/commands/`:
- `/dev` — Start the Wails dev server
- `/build` — Build the production app
- `/sync-mole` — Sync upstream mole CLI changes
