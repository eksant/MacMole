# MacMole — Cleanup Expansion + i18n Design Spec
**Date:** 2026-06-14  
**Status:** Approved

---

## Overview

Expand MacMole's cleanup capabilities based on a real-world storage audit session (170GB → 33GB free on a 228GB MacBook). Add browser caches, AI tool caches, and app-specific caches to the existing `Cleanup.tsx` page as three new tabs. Add full EN/ID internationalization with a flag-based language switcher throughout the app.

**Guiding constraints:**
- Every cleanup target must check for existence before displaying — items not present on the user's machine are hidden entirely (not greyed out)
- macOS version compatibility checks via `kern.osrelease` before exposing targets
- All UI strings must go through i18n keys — no hardcoded strings anywhere
- Safety level + recovery information must accompany every cleanup target
- All exec paths use hardcoded args only — never user input in shell commands

---

## Architecture

```
Cleanup.tsx (hub — 3 tabs)
├── Tab: Browser      → GetBrowserCaches()   → CleanBrowserCaches(ids[])
├── Tab: AI & Editors → GetAICaches()        → CleanAICaches(ids[])
└── Tab: App Caches   → GetAppCaches()       → CleanAppCaches(ids[])
         ↓
    devcaches.go (extended)
         ↓
    scan() → exists? → macOS version ok? → size estimate → CacheTarget{}
    clean() → hardcoded rm -rf / exec paths
         ↓
    history.go → record operation + freed_mb
```

---

## Backend: `devcaches.go` Extension

### Extended `CacheTarget` Struct

```go
type CacheTarget struct {
    ID           string   // unique key, matches i18n key
    Name         string   // display name (fallback if i18n missing)
    Category     string   // "browser" | "ai" | "app"
    Paths        []string // hardcoded absolute paths (no user input)
    Exists       bool     // false = hidden in UI
    SizeMB       int64    // 0 = not shown until scanned
    SafetyLevel  string   // "safe" | "caution" | "manual"
    MinOSVersion string   // "13.0" | "" = all versions
    RequiresBin  string   // binary that must exist e.g. "docker", "" = none
}
```

### 6 New Methods on `DevCacheService`

```go
func (s *DevCacheService) GetBrowserCaches() []CacheTarget
func (s *DevCacheService) CleanBrowserCaches(ids []string) []CleanResult

func (s *DevCacheService) GetAICaches() []CacheTarget
func (s *DevCacheService) CleanAICaches(ids []string) []CleanResult

func (s *DevCacheService) GetAppCaches() []CacheTarget
func (s *DevCacheService) CleanAppCaches(ids []string) []CleanResult
```

### macOS Version Detection

```go
func macOSMajorVersion() int {
    // syscall.Sysctl("kern.osrelease") → parse "24.x.x" → Darwin 24 = macOS 15
    // Darwin kernel version = macOS version + 9
}
```

### Cleanup Targets

#### Browser Caches

| ID | Path(s) | Safety | Min OS | Requires |
|----|---------|--------|--------|----------|
| `chrome_ai_model` | `~/Library/Application Support/Google/Chrome/OptGuideOnDeviceModel` | safe | — | — |
| `chrome_gpu_cache` | `*/Chrome/**/GPUCache`, `DawnWebGPUCache`, `DawnGraphiteCache`, `GraphiteDawnCache` | safe | — | — |
| `arc_service_worker` | `~/Library/Application Support/Arc/User Data/Default/Service Worker/CacheStorage` | safe | — | — |
| `arc_gpu_cache` | `*/Arc/**/GPUCache`, `GrShaderCache`, `ShaderCache`, `DawnWebGPUCache` | safe | — | — |
| `brave_gpu_cache` | `*/BraveSoftware/**/GPUCache`, `DawnWebGPUCache`, `DawnGraphiteCache` | safe | — | — |
| `playwright_browsers` | `~/Library/Caches/ms-playwright`, `ms-playwright-mcp`, `ms-playwright-go` | safe | — | — |

#### AI & Editor Caches

| ID | Path(s) | Safety | Min OS | Requires |
|----|---------|--------|--------|----------|
| `claude_vm_bundles` | `~/Library/Application Support/Claude/vm_bundles` | caution | — | — |
| `claude_local_sessions` | `~/.local/share/claude` | caution | — | — |
| `vscode_old_extensions` | Dirs listed in `~/.vscode/extensions/.obsolete` | manual | — | — |
| `vscode_orphaned_extensions` | Dirs in `~/.vscode/extensions/` without `package.json` | manual | — | — |

**VSCode old extension detection logic:**
1. Read `~/.vscode/extensions/.obsolete` (JSON map of `id → bool`)
2. Cross-reference with actual dirs in `~/.vscode/extensions/`
3. For each matched dir: compute size, expose as individual selectable item
4. `vscode_orphaned_extensions`: dirs that have no `package.json` inside

#### App Caches

| ID | Path(s) / Command | Safety | Min OS | Requires |
|----|-------------------|--------|--------|----------|
| `docker_build_cache` | `docker builder prune -a -f` | caution | — | `docker` |
| `docker_unused_images` | `docker image prune -a -f` | caution | — | `docker` |
| `pyinstaller_cache` | `~/Library/Application Support/pyinstaller` | safe | — | — |
| `uv_cache` | `~/.cache/uv` | safe | — | — |
| `nordvpn_cache` | `~/Library/Caches/com.nordvpn.macos` | safe | — | — |
| `node_gyp_cache` | `~/Library/Caches/node-gyp` | safe | — | — |

**Docker target rules:**
- Check `docker` binary in PATH via `exec.LookPath("docker")`
- Check Docker daemon running via `docker info` (timeout 3s)
- If daemon not running: show target as unavailable with note "Docker is not running"
- `SizeMB` estimated via `docker system df --format json` output
- Active containers and their images/volumes are never touched by prune

---

## Frontend: `Cleanup.tsx` Transformation

### Layout

```
Cleanup
├── [Browser  2.4 GB] [AI & Editors  8.6 GB] [App Caches  4.2 GB]  ← tabs with total size
│
└── Per-tab content:
    ┌────────────────────────────────────────────────────────────┐
    │ ☑  Chrome AI Model                               4.0 GB   │
    │    ✅ Safe — On-device AI model auto-downloaded by Chrome. │
    │    Does not affect browsing data, bookmarks, or accounts.  │
    │    Chrome re-downloads automatically when needed.          │
    └────────────────────────────────────────────────────────────┘
    ┌────────────────────────────────────────────────────────────┐
    │ ☑  Claude VM Bundles                             7.8 GB   │
    │    ⚠️ Caution — Sandbox VM for Claude Code worktree mode.  │
    │    Safe to delete, but Claude Code will re-download (~5m)  │
    │    the first time isolated execution is used again.        │
    └────────────────────────────────────────────────────────────┘
    ┌────────────────────────────────────────────────────────────┐
    │ ☐  VS Code Old Extensions                        505 MB   │
    │    🔴 Manual — Old extension versions detected.            │
    │    Verify newer versions are active before deleting.       │
    │    Cannot be recovered without manual reinstall.           │
    └────────────────────────────────────────────────────────────┘
    
    [Select All]  [Deselect All]          [Preview →]
```

### Safety Badges

| Level | Icon | Color | Meaning |
|-------|------|-------|---------|
| `safe` | ✅ Safe | Green | Auto-regenerated, no user data affected |
| `caution` | ⚠️ Caution | Amber | Will require re-download or re-setup |
| `manual` | 🔴 Manual | Red | Verify manually before deleting |

### Interaction Flow

1. **Mount** → call `GetBrowserCaches()`, `GetAICaches()`, `GetAppCaches()` in parallel
2. **Display** → only items where `exists === true`; tab header shows total size sum
3. **Empty tab** → show: *"No [browser/AI/app] caches detected on this Mac."*
4. **Select items** → checkbox per target; Select All / Deselect All per tab
5. **Preview** → dry-run dialog: list selected items + sizes + all `safetyNote` strings
6. **Confirm** → "Clean X items · Free up Y GB" button in dialog
7. **Execute** → progress indicator per item; results list (freed MB or error per item)
8. **Complete** → summary: total freed, log to history.db

### Docker Special Case

If Docker daemon is not running, the Docker targets show an inline note instead of a checkbox:
```
⚪  Docker Build Cache                        — 
    Docker is not running. Start Docker to enable this cleanup.
```

---

## i18n Implementation

### Library

```
react-i18next + i18next
```

Install: `npm install i18next react-i18next`

### File Structure

```
frontend/src/
├── i18n.ts                     # init: load locales, detect saved lang
└── locales/
    ├── en/
    │   ├── common.json         # buttons, labels, nav, badges
    │   ├── cleanup.json        # Cleanup page — all 3 tabs + targets
    │   ├── devcaches.json      # DevCaches page
    │   ├── dashboard.json
    │   ├── cleaner.json
    │   ├── processes.json
    │   ├── history.json
    │   ├── optimizer.json
    │   ├── analyzer.json
    │   ├── installer.json
    │   ├── logs.json
    │   ├── nodemodules.json
    │   ├── purge.json
    │   ├── uninstall.json
    │   └── settings.json
    └── id/
        └── (mirrors en/ structure)
```

### i18n.ts Init

```ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const savedLang = localStorage.getItem('macmole_lang') ?? 'en'

i18n.use(initReactI18next).init({
  lng: savedLang,
  fallbackLng: 'en',
  resources: { en: { ... }, id: { ... } },
  interpolation: { escapeValue: false },
})
```

### Language Switcher — Sidebar.tsx

Placed above the Settings nav item, at the bottom of the sidebar:

```tsx
// Toggle pill: 🇺🇸 EN | 🇮🇩 ID
// On click: i18n.changeLanguage(lang); localStorage.setItem('macmole_lang', lang)
```

### Translation Key Convention

- `common.button.clean` → "Clean" / "Bersihkan"
- `common.badge.safe` → "Safe" / "Aman"
- `cleanup.browser.targets.chrome_ai_model.name` → "Chrome AI Model"
- `cleanup.browser.targets.chrome_ai_model.safetyNote` → "Safe — Chrome re-downloads automatically..."
- `cleanup.browser.empty` → "No browser caches detected on this Mac."

### Migration Rule

All existing hardcoded strings in all 14 pages must be migrated to `useTranslation()` hooks. No raw string literals in JSX allowed after this change.

---

## `.claude/commands/cleanup-scan.md` (New Skill)

```markdown
# /cleanup-scan

Run a full storage scan and output a categorized summary table of what can be safely cleaned on this Mac. Covers: Docker, Homebrew, npm/node_modules, browser caches, Playwright, Python caches, Claude/AI caches, VSCode extensions, and Go module cache.

Does NOT execute any deletions — scan only.
```

---

## CLAUDE.md Updates

- Add `/cleanup-scan` to Skills section
- Add **i18n Rules** section:
  - All UI strings via `useTranslation()` — no hardcoded strings in JSX
  - Translation files at `frontend/src/locales/{en,id}/<page>.json`
  - Key format: `<page>.<section>.<key>`
  - Add both EN and ID strings when adding any new UI text

---

## `.gitignore` Updates

```gitignore
# SQLite user data
*.db
*.db-shm  
*.db-wal

# Go build artifacts
*.prof
/tmp/

# i18n compiled cache (if generated)
frontend/src/locales/**/*.js
```

---

## Lint, Type-check, Build

All changes must pass before completion:

```bash
# Frontend
cd frontend && npm run lint && npm run type-check

# Go
golangci-lint run ./...

# Full build
wails build
```

TypeScript strict rules apply: no `any`, no unused vars, all `.catch()` must update error state.

---

## Implementation Order

1. `.gitignore` + `CLAUDE.md` + `.claude/commands/cleanup-scan.md`
2. `devcaches.go` — extend struct + 6 new methods + macOS version util
3. `wails generate module` — regenerate JS bindings
4. `frontend/src/i18n.ts` + `locales/en/` + `locales/id/` (all pages)
5. `Sidebar.tsx` — language switcher pill
6. Migrate all 14 existing pages to `useTranslation()`
7. `Cleanup.tsx` — 3 tabs with safety badges + confirm dialog + progress
8. Lint + type-check + build
