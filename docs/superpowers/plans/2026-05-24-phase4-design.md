# Phase 4: Design Overhaul — Dashboard, Sidebar, UX Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the navigation from 10+ flat items to ~6 meaningful groups, make the health ring the hero element of the dashboard with post-action state, fix icon duplication, improve contrast, add ARIA attributes, and persist last-run result.

**Architecture:** All changes are purely frontend. No Go backend changes required. Uses localStorage for persisting last-run result. No new dependencies.

**Tech Stack:** React 18, TypeScript, TailwindCSS 3, Lucide React, CSS custom properties

**Prerequisite:** Phase 1 complete (lint clean).

---

## Task 1: Fix duplicate Package icons in Sidebar

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`

The sidebar uses `Package` icon for both "App Cleanup" and "Node Modules". This makes the two entries visually identical.

- [ ] **Step 1: Replace duplicate icons**

In `Sidebar.tsx`, import `Archive` and `FolderX` from `lucide-react` (in addition to existing imports):

```tsx
import { ..., Archive, FolderX } from "lucide-react";
```

- [ ] **Step 2: Update nav array**

Change the two entries:

```tsx
{ id: "installer",   label: "App Cleanup",  icon: <Archive size={17} />,  group: "Tools" },
{ id: "nodemodules", label: "Node Modules", icon: <FolderX size={17} />,  group: "Tools" },
```

- [ ] **Step 3: Raise group label opacity**

Find the group label `<p>` element with `color: "rgba(255,255,255,0.18)"` and raise to `0.40`:

```tsx
style={{ color: "rgba(255,255,255,0.40)", letterSpacing: "0.08em" }}
```

- [ ] **Step 4: Add aria-current to active NavBtn**

In the `NavBtn` component, add `aria-current={active ? "page" : undefined}` to the `<button>` element:

```tsx
<button
  aria-current={active ? "page" : undefined}
  onClick={() => onNavigate(id)}
  ...
>
```

- [ ] **Step 5: Type-check and lint**

```bash
cd frontend && npm run type-check && npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Sidebar.tsx
git commit -m "fix: replace duplicate Package icons, raise group label contrast, add aria-current"
```

---

## Task 2: Consolidate Tools sidebar group into logical sub-groups

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`

Currently all tools are in one flat "Tools" group. With new pages from Phase 3, the sidebar is ~12 items. Group into: **Clean** (Cleaner, Optimizer, Purge, Dev Caches), **Manage** (Uninstall, App Cleanup, Logs, Node Modules), **Monitor** (Analyzer, Processes, History).

- [ ] **Step 1: Update nav array with sub-groups**

Replace the current single `group: "Tools"` with three distinct group values:

```tsx
const nav: { id: Page; label: string; icon: React.ReactNode; group?: string }[] = [
  { id: "dashboard",   label: "Dashboard",    icon: <LayoutDashboard size={17} /> },

  // Clean group
  { id: "cleaner",     label: "Cleaner",      icon: <Trash2 size={17} />,        group: "Clean" },
  { id: "optimizer",   label: "Optimizer",    icon: <Zap size={17} />,           group: "Clean" },
  { id: "purge",       label: "Purge",        icon: <Flame size={17} />,         group: "Clean" },
  { id: "devcaches",   label: "Dev Caches",   icon: <Code2 size={17} />,         group: "Clean" },

  // Manage group
  { id: "uninstall",   label: "Uninstall",    icon: <AppWindow size={17} />,     group: "Manage" },
  { id: "installer",   label: "App Cleanup",  icon: <Archive size={17} />,       group: "Manage" },
  { id: "logs",        label: "Clean Logs",   icon: <FileText size={17} />,      group: "Manage" },
  { id: "nodemodules", label: "Node Modules", icon: <FolderX size={17} />,       group: "Manage" },

  // Monitor group
  { id: "analyzer",    label: "Disk Analyzer",icon: <HardDrive size={17} />,     group: "Monitor" },
  { id: "processes",   label: "Processes",    icon: <Activity size={17} />,      group: "Monitor" },
  { id: "history",     label: "History",      icon: <Clock size={17} />,         group: "Monitor" },

  { id: "settings",    label: "Settings",     icon: <Settings size={17} /> },
];
```

- [ ] **Step 2: Update the nav render to show 3 groups**

Replace the current nav render section (the `<nav>` content in Sidebar.tsx):

```tsx
<nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto">
  {/* Top-level: Dashboard only */}
  {nav.filter(n => !n.group && n.id !== "settings").map(({ id, label, icon }) => (
    <NavBtn key={id} id={id} label={label} icon={icon} current={current} onNavigate={onNavigate} />
  ))}

  {(["Clean", "Manage", "Monitor"] as const).map(groupName => (
    <div key={groupName}>
      <p className="text-xs uppercase tracking-wider px-3 pt-4 pb-1.5"
         style={{ color: "rgba(255,255,255,0.40)", letterSpacing: "0.08em" }}>
        {groupName}
      </p>
      {nav.filter(n => n.group === groupName).map(({ id, label, icon }) => (
        <NavBtn key={id} id={id} label={label} icon={icon} current={current} onNavigate={onNavigate} />
      ))}
    </div>
  ))}

  <div className="flex-1" />
  {nav.filter(n => n.id === "settings").map(({ id, label, icon }) => (
    <NavBtn key={id} id={id} label={label} icon={icon} current={current} onNavigate={onNavigate} />
  ))}
</nav>
```

- [ ] **Step 3: Add overflow-y-auto to sidebar itself**

Add `overflow-y-auto` to the `<aside>` className so the nav can scroll if it grows tall.

- [ ] **Step 4: Type-check and lint**

```bash
cd frontend && npm run type-check && npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Sidebar.tsx
git commit -m "refactor: consolidate sidebar into Clean/Manage/Monitor sub-groups"
```

---

## Task 3: Enlarge health score ring and add label + last-run state

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

The health ring is 88×88px and shows only a number. It should be the dashboard hero at 120×120px with a label ("Excellent/Good/Fair/Critical") and a "Last run" timestamp from localStorage.

- [ ] **Step 1: Update ScoreRing component to 120×120 with label**

Replace the `ScoreRing` function:

```tsx
function ScoreRing({ score }: { score: number }) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#34d399" : score >= 60 ? "#fbbf24" : score >= 40 ? "#fb923c" : "#f87171";
  const label = score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Fair" : "Critical";
  const scoreRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    if (scoreRef.current) {
      scoreRef.current.style.setProperty("--full", String(circumference));
      scoreRef.current.style.setProperty("--offset", String(offset));
    }
  }, [offset, circumference]);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
        <circle
          ref={scoreRef}
          cx="60" cy="60" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          transform="rotate(-90 60 60)"
          className="animate-score-ring"
          style={{ filter: `drop-shadow(0 0 8px ${color}90)`, transition: "stroke 0.5s ease" }}
        />
        <text x="60" y="57" textAnchor="middle" dominantBaseline="middle"
          fontSize="22" fontWeight="700" fill={color}
          fontFamily="-apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif">
          {score}
        </text>
        <text x="60" y="73" textAnchor="middle" dominantBaseline="middle"
          fontSize="10" fill="rgba(255,255,255,0.35)"
          fontFamily="-apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif">
          {label}
        </text>
      </svg>
      <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Health</span>
    </div>
  );
}
```

- [ ] **Step 2: Add last-run state persistence**

Add to Dashboard component state:

```tsx
const [lastRun, setLastRun] = useState<{ time: string; freed: string } | null>(() => {
  const raw = localStorage.getItem("macmole_last_run");
  if (!raw) return null;
  try { return JSON.parse(raw) as { time: string; freed: string }; }
  catch { return null; }
});
```

Update `runAll` to save after completion:

```tsx
const runAll = async () => {
  setOptStatus("running");
  setOptLines([]);
  try {
    const result = await RunAll(false);
    setOptStatus(result.success ? "done" : "error");
    if (result.error) setOptLines(prev => [...prev, "Error: " + result.error]);
    if (result.success) {
      const entry = { time: new Date().toLocaleString(), freed: extractFreed(result.output) };
      localStorage.setItem("macmole_last_run", JSON.stringify(entry));
      setLastRun(entry);
    }
  } catch {
    setOptStatus("error");
  }
};
```

Add helper before `Dashboard()`:

```tsx
function extractFreed(output: string): string {
  const match = /freed\s+([\d.]+\s+[KMGT]?B)/i.exec(output);
  return match ? match[1] : "";
}
```

- [ ] **Step 3: Show last-run below the Optimize All button**

Just below the button group in the header `<div className="flex items-center gap-5">`:

```tsx
{lastRun && optStatus === "idle" && (
  <div className="text-xs text-center" style={{ color: "rgba(255,255,255,0.25)" }}>
    Last run: {lastRun.time}
    {lastRun.freed && <span className="text-emerald-400/50 ml-1">· {lastRun.freed} freed</span>}
  </div>
)}
```

- [ ] **Step 4: Type-check and lint**

```bash
cd frontend && npm run type-check && npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx
git commit -m "feat: enlarge health ring to 120px, add score label, persist last-run result"
```

---

## Task 4: Consolidate Cleaner/Optimizer/Purge into tabbed Cleanup page

**Files:**
- Create: `frontend/src/pages/Cleanup.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`

The Cleaner, Optimizer, and Purge pages are structurally identical (run command → stream output → show result). Consolidate into one "Cleanup" page with tabs.

- [ ] **Step 1: Create Cleanup.tsx combining all three**

```tsx
import { useState, useEffect, useRef } from "react";
import { Sparkles, PlayCircle, Eye, CheckCircle2, AlertCircle } from "lucide-react";
import { RunClean, RunOptimize, RunPurge } from "../../wailsjs/go/main/CommandService";
import { EventsOn, EventsOff } from "../../wailsjs/runtime/runtime";
import { notify } from "../utils/notify";
import SpinnerRing from "../components/SpinnerRing";

type Tab = "clean" | "optimize" | "purge";

const TAB_CONFIG: Record<Tab, {
  label: string;
  description: string;
  color: string;
  dangerLevel: "safe" | "low-risk" | "destructive";
}> = {
  clean: {
    label: "Deep Clean",
    description: "Removes caches, logs, temp files, and browser artifacts. Safe to run anytime.",
    color: "#3b82f6",
    dangerLevel: "safe",
  },
  optimize: {
    label: "Optimize",
    description: "Runs macOS maintenance scripts, rebuilds Launch Services, compacts SQLite databases.",
    color: "#f59e0b",
    dangerLevel: "low-risk",
  },
  purge: {
    label: "Purge",
    description: "Aggressively removes additional caches and development artifacts. Review before applying.",
    color: "#f97316",
    dangerLevel: "destructive",
  },
};

const DANGER_BADGE: Record<string, { label: string; style: React.CSSProperties }> = {
  safe:        { label: "Safe",        style: { background: "rgba(52,211,153,0.12)", color: "#34d399" } },
  "low-risk":  { label: "Low Risk",   style: { background: "rgba(251,191,36,0.12)", color: "#fbbf24" } },
  destructive: { label: "Destructive", style: { background: "rgba(249,115,22,0.12)", color: "#fb923c" } },
};

export default function Cleanup() {
  const [tab, setTab] = useState<Tab>("clean");
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const cfg = TAB_CONFIG[tab];

  useEffect(() => {
    EventsOn("command:output", (line: string) => {
      setLines(prev => [...prev, line]);
    });
    return () => { EventsOff("command:output"); };
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [lines]);

  // Reset state when switching tabs
  useEffect(() => {
    setLines([]);
    setDone(false);
    setError(null);
  }, [tab]);

  const run = async (dryRun: boolean) => {
    setRunning(true);
    setDone(false);
    setError(null);
    setLines([]);
    try {
      const fn = tab === "clean" ? RunClean : tab === "optimize" ? RunOptimize : RunPurge;
      const result = await fn(dryRun);
      setSuccess(result.success);
      if (result.error) setLines(prev => [...prev, "Error: " + result.error]);
      if (!dryRun) notify("MacMole", result.success ? `${cfg.label} completed.` : `${cfg.label} finished with errors.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Command failed.");
    } finally {
      setRunning(false);
      setDone(true);
    }
  };

  const badge = DANGER_BADGE[cfg.dangerLevel];

  return (
    <div className="flex flex-col gap-5 animate-fade-in-up">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `linear-gradient(135deg,${cfg.color},${cfg.color}cc)` }}>
            <Sparkles size={16} className="text-white" />
          </span>
          Cleanup
        </h2>
        <p className="text-sm mt-1.5 ml-10 text-white/40">{cfg.description}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.05)" }}>
        {(["clean", "optimize", "purge"] as Tab[]).map(t => {
          const c = TAB_CONFIG[t];
          return (
            <button key={t} onClick={() => setTab(t)} disabled={running}
              className="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all"
              style={tab === t
                ? { background: `linear-gradient(135deg,${c.color}30,${c.color}18)`,
                    border: `1px solid ${c.color}40`, color: "#fff" }
                : { background: "transparent", border: "1px solid transparent", color: "rgba(255,255,255,0.4)" }
              }>
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Risk badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs px-2 py-0.5 rounded-full" style={badge.style}>{badge.label}</span>
        <span className="text-xs text-white/30">{cfg.description}</span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <button onClick={() => { void run(true); }} disabled={running}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.65)" }}>
          <Eye size={13} /> Dry Run
        </button>
        <button onClick={() => { void run(false); }} disabled={running}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: `linear-gradient(135deg,${cfg.color},${cfg.color}cc)`,
                   color: "#fff", boxShadow: `0 4px 16px ${cfg.color}40`, opacity: running ? 0.6 : 1 }}>
          {running ? <SpinnerRing /> : <PlayCircle size={14} />}
          {running ? "Running…" : `Run ${cfg.label}`}
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-sm"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
          {error}
        </div>
      )}

      {done && !running && (
        <div className="flex items-center gap-2 text-sm"
          style={{ color: success ? "#34d399" : "#f87171" }}>
          {success ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {success ? `${cfg.label} completed successfully.` : `${cfg.label} finished with errors.`}
        </div>
      )}

      {lines.length > 0 && (
        <div ref={logRef}
          className="rounded-2xl px-4 py-3 font-mono text-xs overflow-y-auto max-h-64 flex flex-col gap-0.5"
          style={{ background: "rgba(0,0,0,0.35)", border: `1px solid ${cfg.color}30`, color: "rgba(255,255,255,0.55)" }}>
          {lines.map((l, i) => (
            <div key={i}>{l || " "}</div>
          ))}
          {running && (
            <div className="flex items-center gap-1.5 mt-1" style={{ color: cfg.color }}>
              <div className="dot-loader flex gap-1"><span /><span /><span /></div>
              Running…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire into App.tsx**

Add `"cleanup"` to `Page` type, add `case "cleanup": return <Cleanup />;`, import component.

- [ ] **Step 3: Update Sidebar to use "cleanup" replacing "cleaner", "optimizer", "purge"**

Remove the separate cleaner, optimizer, purge nav entries. Add single entry:

```tsx
{ id: "cleanup", label: "Cleanup", icon: <Sparkles size={17} />, group: "Clean" },
```

Update accentMap: `cleanup: "#3b82f6"`.

Import `Sparkles` from `lucide-react`.

- [ ] **Step 4: Keep old pages in App.tsx** (for backwards navigation compatibility — routes still exist but not in sidebar)

Old pages `Cleaner`, `Optimizer`, `Purge` can remain in the codebase for now; they simply won't appear in sidebar navigation. This avoids breaking any deep-links.

- [ ] **Step 5: Type-check and lint**

```bash
cd frontend && npm run type-check && npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/
git commit -m "refactor: consolidate Cleaner/Optimizer/Purge into single tabbed Cleanup page"
```

---

## Task 5: CSS custom properties and animation polish

**Files:**
- Modify: `frontend/src/style.css`
- Modify: `frontend/src/App.css`

- [ ] **Step 1: Verify animate-score-ring keyframe exists in style.css**

Check `frontend/src/style.css` for `@keyframes score-ring`. If missing, add:

```css
@keyframes score-ring {
  from { stroke-dashoffset: var(--full); }
  to   { stroke-dashoffset: var(--offset); }
}
.animate-score-ring {
  animation: score-ring 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
```

- [ ] **Step 2: Add fade-in-up animation**

Add to `style.css` if not present:

```css
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
  animation: fade-in-up 0.3s ease-out;
}
.animate-fade-in-up {
  animation: fade-in-up 0.4s ease-out;
}
```

- [ ] **Step 3: Ensure dot-loader animation is defined**

```css
@keyframes dot-bounce {
  0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
  40%            { transform: scale(1); opacity: 1; }
}
.dot-loader span {
  display: inline-block;
  width: 5px; height: 5px;
  border-radius: 50%;
  background: currentColor;
  animation: dot-bounce 1.2s infinite ease-in-out;
}
.dot-loader span:nth-child(2) { animation-delay: 0.15s; }
.dot-loader span:nth-child(3) { animation-delay: 0.30s; }
```

- [ ] **Step 4: Build frontend**

```bash
cd frontend && npm run build
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/style.css frontend/src/App.css
git commit -m "style: ensure all CSS animations (score-ring, fade-in-up, dot-loader) are defined"
```

---

## Task 6: Icon swap (when user provides PNG/SVG)

**Files:**
- Replace: `assets/logo.svg` (or add new icon files)
- Replace: `build/appicon.png`, `build/trayicon.png`, `build/trayicon@2x.png`

This task is blocked on user providing the icon asset. When provided:

- [ ] **Step 1: Copy user-provided icon to assets/**

```bash
cp ~/Downloads/<provided-icon>.svg /Users/eksa/Projects/MacMole/assets/logo.svg
# or PNG:
cp ~/Downloads/<provided-icon>.png /Users/eksa/Projects/MacMole/assets/logo.png
```

- [ ] **Step 2: Generate app icon variants using wails CLI or manual export**

For macOS `.icns` via wails:
```bash
wails generate icons --input assets/logo.png
```

This generates `build/appicon.png` and `build/darwin/AppIcon.icns`.

For tray icons (18×18, 36×36 @2x):
```bash
# Using ImageMagick or sips to resize
sips -z 18 18 assets/logo.png --out build/trayicon.png
sips -z 36 36 assets/logo.png --out build/trayicon@2x.png
```

- [ ] **Step 3: Update logo reference in Sidebar.tsx**

If format changes (e.g., from SVG to PNG), update the import in `Sidebar.tsx`:
```tsx
import logoSvg from "../assets/images/logo.svg"; // change path/extension as needed
```

- [ ] **Step 4: Build and verify icons appear correctly**

```bash
wails build
open build/bin/MacMole.app
```

Verify: app icon in Dock, tray icon in menu bar.

- [ ] **Step 5: Commit**

```bash
git add assets/ build/
git commit -m "feat: update app icon with new brand design"
```

---

## Self-Review

**Spec coverage:**
- ✅ Fix duplicate Package icons → Task 1
- ✅ Raise group label contrast (0.18 → 0.40) → Task 1
- ✅ Add aria-current → Task 1
- ✅ Sidebar consolidation (Clean/Manage/Monitor) → Task 2
- ✅ Health ring 120px + label + last-run → Task 3
- ✅ Cleanup tab consolidation → Task 4
- ✅ Animation/CSS polish → Task 5
- ✅ Icon swap workflow → Task 6 (blocked on user asset)

**Placeholder scan:** Task 6 is explicitly flagged as blocked on user-provided asset — this is intentional, not a TBD. All other tasks have concrete code.

**Type consistency:** `Tab` type, `TAB_CONFIG`, `DANGER_BADGE` all defined and used consistently within Cleanup.tsx. No cross-task type references.
