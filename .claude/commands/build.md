---
description: Build MacMole production app (.app bundle for macOS)
---

Build a production macOS `.app` bundle.

## Steps

1. Build the frontend and Go binary together:
```bash
wails build
```

Output: `build/bin/MacMole.app`

2. For a signed/notarized build (requires Apple Developer account):
```bash
wails build -platform darwin/universal
```

3. Verify the build:
```bash
open build/bin/MacMole.app
```

## What wails build does
- Runs `cd frontend && npm run build` → outputs to `frontend/dist/`
- Compiles Go with `//go:embed all:frontend/dist` to bundle the frontend
- Compiles Objective-C via CGo for the tray (tray_darwin.m)
- Produces a macOS `.app` bundle

## Regenerate Wails JS bindings (do this after Go service changes)
```bash
wails generate module
```
This updates `frontend/wailsjs/go/main/*.js` and `.d.ts` files.

## Regenerate icons (do this when icon SVG changes)
```bash
rsvg-convert -w 1024 -h 1024 -o build/appicon.png assets/icon-concept.svg
rsvg-convert -w 18   -h 18   -o build/trayicon.png assets/icon-concept.svg
rsvg-convert -w 36   -h 36   -o build/trayicon@2x.png assets/icon-concept.svg
```

## Common issues
- `no matching files found` for frontend/dist → `wails build` handles this; don't use `go build`
- CGo errors → ensure Xcode Command Line Tools: `xcode-select --install`
- Icon not showing → verify `build/appicon.png` exists and is 1024×1024
