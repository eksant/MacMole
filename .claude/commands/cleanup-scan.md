---
description: Scan this Mac's storage and report what can be safely cleaned
---

Run a full storage scan and output a categorized summary table. Covers: Docker,
Homebrew, npm/node_modules, browser caches (Chrome/Arc/Brave), Playwright,
Python caches (pyinstaller/uv), Claude/AI caches (vm_bundles, sessions),
VSCode old extensions, and Go module cache.

## Steps

1. Check disk usage overview:
```bash
df -h / | tail -1
```

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
