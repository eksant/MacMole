# Phase 1: Foundation — Bug Fixes + Lint Setup

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Fix all known bugs and enforce strict linting/formatting across the entire codebase (Go + TypeScript/React) with zero warnings, zero errors, zero `any` types, zero unused vars.

**Architecture:** Bug fixes target specific identified issues in Go backend and React frontend. Lint uses ESLint flat config + Prettier for frontend; golangci-lint for Go. TypeScript strictness is already partially enabled — we add the missing options.

**Tech Stack:** Go 1.24, golangci-lint, ESLint 9 flat config, typescript-eslint v8, Prettier 3, Vite 3, React 18, librsvg (rsvg-convert), sips (macOS built-in)

> **⚠️ Start with Task 0** — icon files in `build/` were deleted from disk but are referenced by `//go:embed` in `tray_darwin.go`. The project will not compile until they are restored.

---

## Task 0: Project Setup — .gitignore, CLAUDE.md, Skills, Icon Assets

**Files:**
- Modify: `.gitignore`
- Create: `CLAUDE.md`
- Create: `.claude/commands/dev.md`
- Create: `.claude/commands/build.md`
- Create: `.claude/commands/sync-mole.md`
- Create: `build/appicon.png` (1024×1024, from assets/icon-concept.svg)
- Create: `build/trayicon.png` (18×18)
- Create: `build/trayicon@2x.png` (36×36)

- [x] **Step 1: Update .gitignore** — remove CLAUDE.md from ignore, surgical .claude/ ignores, add `desktop` binary

- [x] **Step 2: Create CLAUDE.md** at project root with build commands, architecture, and code rules

- [x] **Step 3: Create .claude/commands/** project skills for dev, build, sync-mole

- [x] **Step 4: Install librsvg and generate icon PNGs**

```bash
brew install librsvg
mkdir -p build
rsvg-convert -w 1024 -h 1024 -o build/appicon.png assets/icon-concept.svg
rsvg-convert -w 18 -h 18 -o build/trayicon.png assets/icon-concept.svg
rsvg-convert -w 36 -h 36 -o build/trayicon@2x.png assets/icon-concept.svg
```

- [x] **Step 5: Verify Go build succeeds**

```bash
go build ./...
```

Expected: no output.

- [x] **Step 6: Commit all setup files**

```bash
git add .gitignore CLAUDE.md .claude/commands/ build/appicon.png build/trayicon.png build/trayicon@2x.png
git commit -m "chore: project setup — CLAUDE.md, skills, gitignore, regenerate icon assets from SVG"
```

---

## Task 1: Fix MetricsService race condition (HIGH severity)

**Files:**
- Modify: `metrics.go`

The `prevNetSent`, `prevNetRecv`, `prevNetTime` fields are accessed from `GetMetrics()` which can be called concurrently by both the frontend polling (via Wails) and the tray goroutine. No mutex protects these fields.

- [x] **Step 1: Add mutex to MetricsService**

Replace the struct definition at `metrics.go:21-25`:

```go
type MetricsService struct {
	mu          sync.RWMutex
	prevNetSent uint64
	prevNetRecv uint64
	prevNetTime time.Time
}
```

Add `"sync"` to the import block (it already imports other packages, just add sync).

- [x] **Step 2: Wrap net rate calculation in mutex**

Replace the network block at `metrics.go:130-146`:

```go
// Network (rate calculation)
var netMetrics NetworkMetrics
netStats, err := net.IOCountersWithContext(ctx, false)
if err == nil && len(netStats) > 0 {
	now := time.Now()
	sent := netStats[0].BytesSent
	recv := netStats[0].BytesRecv

	m.mu.Lock()
	if !m.prevNetTime.IsZero() {
		elapsed := now.Sub(m.prevNetTime).Seconds()
		if elapsed > 0 {
			netMetrics.BytesSentPerSec = uint64(float64(sent-m.prevNetSent) / elapsed)
			netMetrics.BytesRecvPerSec = uint64(float64(recv-m.prevNetRecv) / elapsed)
		}
	}
	m.prevNetSent = sent
	m.prevNetRecv = recv
	m.prevNetTime = now
	m.mu.Unlock()
}
```

- [x] **Step 3: Build to verify no compile errors**

```bash
cd /Users/eksa/Projects/MacMole && go build ./...
```

Expected: no output (success).

- [x] **Step 4: Commit**

```bash
git add metrics.go
git commit -m "fix: add mutex to MetricsService to prevent network rate race condition"
```

---

## Task 2: Fix UserHomeDir error handling in commands.go (MEDIUM)

**Files:**
- Modify: `commands.go`

`os.UserHomeDir()` errors are silently ignored in 3 functions: `GetDiskAnalysis`, `ScanLogs`, `ScanNodeModules`, `DeleteApps`, `DeleteLogs`. If home is empty, paths collapse to `/Library`, `/Logs`, etc. — dangerous.

- [x] **Step 1: Extract a safe helper at top of commands.go**

After the `stripANSI` function (around line 22), add:

```go
// safeHome returns the user's home directory or "" if unavailable.
// Callers that get "" should return empty results rather than operating on root paths.
func safeHome() string {
	h, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return h
}
```

- [x] **Step 2: Update GetDiskAnalysis**

Replace line `home, _ := os.UserHomeDir()` in `GetDiskAnalysis` with:

```go
home := safeHome()
if home == "" {
	return nil
}
```

- [x] **Step 3: Update ScanLogs**

Replace `home, _ := os.UserHomeDir()` in `ScanLogs` with:

```go
home := safeHome()
if home == "" {
	return nil
}
```

- [x] **Step 4: Update ScanNodeModules**

Replace `home, _ := os.UserHomeDir()` in `ScanNodeModules` with:

```go
home := safeHome()
if home == "" {
	return nil
}
```

- [x] **Step 5: Update DeleteApps**

Replace `home, _ := os.UserHomeDir()` in `DeleteApps` with:

```go
home := safeHome()
if home == "" {
	return CommandResult{Success: false, Error: "cannot determine home directory"}
}
```

- [x] **Step 6: Update DeleteLogs**

Replace `home, _ := os.UserHomeDir()` in `DeleteLogs` with:

```go
home := safeHome()
if home == "" {
	return CommandResult{Success: false, Error: "cannot determine home directory"}
}
logsRoot := filepath.Join(home, "Library", "Logs")
```

- [x] **Step 7: Build**

```bash
go build ./...
```

- [x] **Step 8: Commit**

```bash
git add commands.go
git commit -m "fix: guard against empty UserHomeDir in all path operations"
```

---

## Task 3: Fix tray goroutine leak (MEDIUM)

**Files:**
- Modify: `tray_darwin.go`

The background metrics goroutine started in `initTray()` runs forever with no shutdown signal. On app quit, the goroutine leaks because the ticker is never stopped by a context.

- [x] **Step 1: Add a package-level done channel**

At the top of `tray_darwin.go`, after the import block, add:

```go
var trayDone = make(chan struct{})
```

- [x] **Step 2: Thread the done channel into the goroutine**

Replace the goroutine in `initTray()` (current lines 41-54):

```go
go func() {
	svc := NewMetricsService()
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	time.Sleep(500 * time.Millisecond)
	pushTrayMetrics(svc)

	for {
		select {
		case <-ticker.C:
			pushTrayMetrics(svc)
		case <-trayDone:
			return
		}
	}
}()
```

- [x] **Step 3: Export a StopTray function so app.go can call it on shutdown**

Add at the bottom of `tray_darwin.go`:

```go
// StopTray signals the tray metrics goroutine to exit.
func StopTray() {
	select {
	case <-trayDone:
	default:
		close(trayDone)
	}
}
```

- [x] **Step 4: Call StopTray on app shutdown in app.go**

Add an `OnShutdown` hook in `main.go` inside `wails.Run(&options.App{...})`:

```go
OnShutdown: func(ctx context.Context) {
    StopTray()
},
```

Add it after the `OnStartup` line.

- [x] **Step 5: Build**

```bash
go build ./...
```

- [x] **Step 6: Commit**

```bash
git add tray_darwin.go main.go
git commit -m "fix: add shutdown channel to tray metrics goroutine to prevent leak on quit"
```

---

## Task 4: Fix pmset output parsing bounds check (MEDIUM)

**Files:**
- Modify: `metrics.go`

In `collectBattery()`, the index arithmetic `start := idx - 1` followed by a backward scan assumes `idx > 0` but never checks. If `%` appears at position 0, `start` becomes -1 causing an index out of bounds panic.

- [x] **Step 1: Add bounds guard before backward scan**

Replace the parsing block in `collectBattery()` at lines ~193-200:

```go
idx := strings.Index(line, "%")
if idx <= 0 {
	continue
}
start := idx - 1
for start > 0 && line[start-1] >= '0' && line[start-1] <= '9' {
	start--
}
pct, err := strconv.Atoi(strings.TrimSpace(line[start:idx]))
if err != nil {
	continue
}
```

The key change: `if idx == -1` becomes `if idx <= 0` — catches both "not found" and "at position 0".

- [x] **Step 2: Build and verify**

```bash
go build ./...
```

- [x] **Step 3: Commit**

```bash
git add metrics.go
git commit -m "fix: guard pmset % index against out-of-bounds when % is at start of string"
```

---

## Task 5: Fix unhandled promise rejections in frontend pages (MEDIUM)

**Files:**
- Modify: `frontend/src/pages/Uninstall.tsx`
- Modify: `frontend/src/pages/Logs.tsx`
- Modify: `frontend/src/pages/NodeModules.tsx`
- Modify: `frontend/src/pages/Analyzer.tsx`
- Modify: `frontend/src/pages/Purge.tsx`

All these pages use `.catch(console.error)` with no user-facing error state. On API failure the page is silent.

- [x] **Step 1: Add error state to Uninstall.tsx**

Add to state declarations:
```tsx
const [scanError, setScanError] = useState<string | null>(null);
```

Update the `scan` function:
```tsx
const scan = () => {
  setScanning(true);
  setResult(null);
  setScanError(null);
  setSelected(new Set());
  ScanApps()
    .then((list) => {
      const sorted = [...list].sort((a, b) => b.size - a.size);
      setApps(sorted);
    })
    .catch((err: unknown) => {
      setScanError(err instanceof Error ? err.message : "Scan failed. Check permissions.");
    })
    .finally(() => setScanning(false));
};
```

Add error banner just before the app list render:
```tsx
{scanError && (
  <div className="px-4 py-3 rounded-xl text-sm"
    style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
    {scanError}
  </div>
)}
```

- [x] **Step 2: Apply same pattern to Logs.tsx**

In `ScanLogs().catch(...)` replace `console.error` with:
```tsx
.catch((err: unknown) => {
  setError(err instanceof Error ? err.message : "Scan failed.");
})
```

Add `const [error, setError] = useState<string | null>(null);` to state, render banner above log list.

- [x] **Step 3: Apply same pattern to NodeModules.tsx**

Same pattern: `error` state, update `.catch`, render banner.

- [x] **Step 4: Apply same pattern to Analyzer.tsx**

Same pattern.

- [x] **Step 5: Apply same pattern to Purge.tsx**

Same pattern.

- [x] **Step 6: Type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [x] **Step 7: Commit**

```bash
git add frontend/src/pages/
git commit -m "fix: add error state to all pages that silently swallowed API failures"
```

---

## Task 6: Setup ESLint (flat config) for frontend

**Files:**
- Create: `frontend/eslint.config.mjs`
- Modify: `frontend/package.json`

- [x] **Step 1: Install ESLint packages**

```bash
cd frontend && npm install --save-dev \
  eslint@^9 \
  @eslint/js@^9 \
  typescript-eslint@^8 \
  eslint-config-prettier@^9
```

- [x] **Step 2: Create eslint.config.mjs**

Create `frontend/eslint.config.mjs`:

```javascript
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import configPrettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist/", "node_modules/", "wailsjs/"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  configPrettier,
);
```

- [x] **Step 3: Add lint scripts to package.json**

Add to `"scripts"` in `frontend/package.json`:

```json
"lint": "eslint src",
"lint:fix": "eslint src --fix",
"type-check": "tsc --noEmit"
```

- [x] **Step 4: Run lint and see initial violations**

```bash
cd frontend && npm run lint 2>&1 | head -60
```

Note violations — do not fix yet (next task).

- [x] **Step 5: Commit config files**

```bash
git add frontend/eslint.config.mjs frontend/package.json frontend/package-lock.json
git commit -m "chore: add ESLint flat config with strict typescript-eslint rules"
```

---

## Task 7: Setup Prettier for frontend

**Files:**
- Create: `frontend/.prettierrc`
- Create: `frontend/.prettierignore`

- [x] **Step 1: Install Prettier**

```bash
cd frontend && npm install --save-dev prettier@^3
```

- [x] **Step 2: Create .prettierrc**

Create `frontend/.prettierrc`:

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": false,
  "tabWidth": 2,
  "printWidth": 100,
  "bracketSameLine": false,
  "arrowParens": "always"
}
```

- [x] **Step 3: Create .prettierignore**

Create `frontend/.prettierignore`:

```
dist/
node_modules/
wailsjs/
*.md
```

- [x] **Step 4: Add format scripts to package.json**

Add to `"scripts"`:

```json
"format": "prettier --write src/",
"format:check": "prettier --check src/"
```

- [x] **Step 5: Run Prettier on all src files**

```bash
cd frontend && npm run format
```

- [x] **Step 6: Commit formatted files**

```bash
git add frontend/.prettierrc frontend/.prettierignore frontend/package.json frontend/package-lock.json frontend/src/
git commit -m "chore: add Prettier config and auto-format all frontend source files"
```

---

## Task 8: Fix ESLint violations in frontend source

**Files:**
- Modify: All files in `frontend/src/` that have violations

- [x] **Step 1: Run lint to see all violations**

```bash
cd frontend && npm run lint 2>&1
```

- [x] **Step 2: Fix auto-fixable violations**

```bash
cd frontend && npm run lint:fix
```

- [x] **Step 3: Fix remaining manual violations**

Common patterns to fix:
- Replace `console.error` with proper error state (already done in Task 5)
- Replace `import type` where applicable
- Replace `.catch(console.error)` with typed catch handlers
- Remove any remaining `any` types

- [x] **Step 4: Run lint until zero violations**

```bash
cd frontend && npm run lint
```

Expected: no output (exit 0).

- [x] **Step 5: Run type-check**

```bash
cd frontend && npm run type-check
```

Expected: no errors.

- [x] **Step 6: Commit**

```bash
git add frontend/src/
git commit -m "fix: resolve all ESLint and TypeScript strict violations in frontend"
```

---

## Task 9: Add golangci-lint config for root Go package

**Files:**
- Create: `.golangci.yml` (root)

- [x] **Step 1: Check golangci-lint is installed**

```bash
golangci-lint --version
```

If not installed: `brew install golangci-lint`

- [x] **Step 2: Create .golangci.yml at repo root**

```yaml
run:
  timeout: 5m
  modules-download-mode: readonly

linters:
  enable:
    - errcheck
    - gosimple
    - govet
    - ineffassign
    - staticcheck
    - unused
    - gofmt
    - goimports
    - misspell
    - unconvert
    - unparam
    - revive
    - errorlint

linters-settings:
  goimports:
    local-prefixes: desktop
  revive:
    rules:
      - name: exported
        severity: warning
      - name: unused-parameter
        severity: warning

issues:
  exclude-rules:
    - path: _test\.go
      linters: [unparam, unused]
  max-issues-per-linter: 0
  max-same-issues: 0
```

- [x] **Step 3: Run golangci-lint and see violations**

```bash
golangci-lint run ./... 2>&1
```

Note violations.

- [x] **Step 4: Fix violations**

Common patterns:
- Remove unused variables
- Add error checks where missing
- Fix formatting inconsistencies

- [x] **Step 5: Run until zero violations**

```bash
golangci-lint run ./...
```

Expected: no output (exit 0).

- [x] **Step 6: Commit**

```bash
git add .golangci.yml
git commit -m "chore: add golangci-lint config and fix all Go linting violations"
```

---

## Task 10: Tighten TypeScript config

**Files:**
- Modify: `frontend/tsconfig.json`

- [x] **Step 1: Add strict options to tsconfig.json**

Replace `"compilerOptions"` block with:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ESNext"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": false,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [x] **Step 2: Type-check**

```bash
cd frontend && npm run type-check
```

Fix any new violations that surface.

- [x] **Step 3: Commit**

```bash
git add frontend/tsconfig.json frontend/src/
git commit -m "chore: tighten TypeScript config with noImplicitReturns, noImplicitAny, noFallthroughCasesInSwitch"
```

---

## Self-Review

**Spec coverage:**
- ✅ Race condition in MetricsService → Task 1
- ✅ UserHomeDir error handling → Task 2
- ✅ Tray goroutine leak → Task 3
- ✅ pmset bounds check → Task 4
- ✅ Unhandled promise rejections → Task 5
- ✅ ESLint strict config → Task 6
- ✅ Prettier config → Task 7
- ✅ ESLint violations fixed → Task 8
- ✅ golangci-lint → Task 9
- ✅ TypeScript tightened → Task 10

**Placeholder scan:** All steps have concrete code. No "TBD" or "implement later".

**Type consistency:** `CommandResult`, `MetricsService`, `safeHome()` all consistent across tasks.
