---
description: Start MacMole in development mode with live reload
---

Start the Wails development server with hot module replacement.

## Steps

1. Make sure frontend dependencies are installed:
```bash
cd frontend && npm install && cd ..
```

2. Start the dev server:
```bash
wails dev
```

This starts:
- A Go backend with live recompile on `.go` file changes
- A Vite dev server for the React frontend with HMR
- The app window opens automatically

## Notes
- Go service changes require `wails generate module` first if you changed struct/method signatures
- The app runs in development mode — no app bundle is created
- Tray icon is initialized on startup (`initTray()` in `app.go`)
- Frontend assets are served from Vite dev server, not embedded

## Common issues
- `pattern all:frontend/dist: no matching files found` → run `wails dev`, not `go build` directly
- Tray icons missing → run `rsvg-convert` to regenerate `build/trayicon.png` (see CLAUDE.md)
- Port conflict → kill existing `wails dev` process: `pkill -f "wails dev"`
