---
description: Sync the mole/ directory with upstream github.com/tw93/mole
---

Pull the latest changes from the upstream `tw93/mole` CLI into the local `mole/` directory.

## Context

`mole/` is a plain directory copy (not a git submodule) of `github.com/tw93/mole`. The local module path is `github.com/tw93/mole` (see `mole/go.mod`). Syncing requires pulling upstream files manually.

## Steps

1. Add upstream as a remote and fetch:
```bash
git remote add mole-upstream https://github.com/tw93/mole.git 2>/dev/null || true
git fetch mole-upstream main
```

2. Check what changed:
```bash
git diff HEAD mole-upstream/main -- . | head -60
```

3. Pull upstream files into mole/ using read-tree:
```bash
git read-tree --prefix=mole/ -u mole-upstream/main
```

4. Build and test:
```bash
cd mole && go build ./... && go test ./...
```

5. Clean up remote:
```bash
git remote remove mole-upstream
```

6. Commit:
```bash
git add mole/
git commit -m "chore(mole): sync upstream tw93/mole"
```

## Key new features to look for after sync
- `cmd/analyze/insights.go` — insights subsystem
- `cmd/status/process_watch.go` — real-time process watching
- `cmd/status/diagnosis.go` — system diagnosis
- `internal/units/bytes.go` — byte formatting utility
- `lib/core/bundle_resolver.sh` — app bundle resolution
- `lib/core/pkg_receipts.sh` — package receipts

## After syncing
If new Go methods are added to mole's status/analyze commands, consider exposing them via `MetricsService` or `CommandService` in the desktop app and running `wails generate module`.
