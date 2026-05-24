import { useEffect, useState } from "react";
import { Trash2, RefreshCw, AlertTriangle } from "lucide-react";
import { ScanApps, DeleteApps } from "../../wailsjs/go/main/CommandService";
import { notify } from "../utils/notify";
import { Button } from "@/components/ui/button";

interface AppEntry {
  name: string;
  path: string;
  size: number;
  bundle_id: string;
}

function fmtBytes(bytes: number): string {
  if (bytes >= 1 << 30) return (bytes / (1 << 30)).toFixed(1) + " GB";
  if (bytes >= 1 << 20) return (bytes / (1 << 20)).toFixed(1) + " MB";
  if (bytes >= 1 << 10) return (bytes / (1 << 10)).toFixed(0) + " KB";
  return bytes + " B";
}

export default function Uninstall() {
  const [apps, setApps] = useState<AppEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scan = () => {
    setScanning(true);
    setResult(null);
    setError(null);
    setSelected(new Set());
    ScanApps()
      .then((list) => {
        const sorted = [...(list ?? [])].sort((a, b) => b.size - a.size);
        setApps(sorted);
      })
      .catch((err: unknown) => setError(String(err)))
      .finally(() => setScanning(false));
  };

  useEffect(() => {
    scan();
  }, []);

  const toggle = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === apps.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(apps.map((a) => a.path)));
    }
  };

  const totalSelected = apps
    .filter((a) => selected.has(a.path))
    .reduce((sum, a) => sum + a.size, 0);

  const doDelete = async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    setResult(null);
    try {
      const res = await DeleteApps(Array.from(selected));
      setResult({ success: res.success, message: res.success ? res.output : res.error });
      if (res.success) {
        notify("MacMole — Uninstaller", res.output || "Apps removed successfully.");
        scan();
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 animate-fade-in-up">
      {error && (
        <div
          className="rounded-xl px-4 py-3 flex items-center gap-2.5 text-sm"
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "#f87171",
          }}
        >
          <AlertTriangle size={14} className="flex-shrink-0" />
          {error}
        </div>
      )}
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <span
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)" }}
          >
            <Trash2 size={16} className="text-white" />
          </span>
          App Uninstaller
        </h2>
        <p className="text-sm mt-1.5 ml-10" style={{ color: "rgba(255,255,255,0.4)" }}>
          Remove apps from /Applications and their associated data files.
        </p>
      </div>

      {/* Warning */}
      <div
        className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
        style={{
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.25)",
          color: "rgba(239,68,68,0.85)",
        }}
      >
        <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
        <span>Deletion is permanent. Preview which files will be removed before confirming.</span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <Button variant="glass" size="sm" onClick={scan} disabled={scanning || deleting} className="gap-2"><RefreshCw size={13} className={scanning ? "animate-spin" : ""} />{scanning ? "Scanning…" : "Refresh"}</Button>

        {apps.length > 0 && (
          <Button variant="ghost" size="sm" onClick={toggleAll} disabled={scanning || deleting}>{selected.size === apps.length ? "Deselect All" : "Select All"}</Button>
        )}

        <div className="flex-1" />

        {selected.size > 0 && (
          <span className="text-xs text-white/40">
            {selected.size} app{selected.size !== 1 ? "s" : ""} selected — {fmtBytes(totalSelected)}{" "}
            to reclaim
          </span>
        )}

        <Button variant="destructive" onClick={doDelete} disabled={selected.size === 0 || deleting || scanning} className="gap-2 font-semibold"><Trash2 size={13} />{deleting ? "Removing…" : "Remove Selected"}</Button>
      </div>

      {/* Result banner */}
      {result && (
        <div
          className="px-4 py-3 rounded-xl text-sm"
          style={{
            background: result.success ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
            border: `1px solid ${result.success ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
            color: result.success ? "#4ade80" : "#f87171",
          }}
        >
          {result.message}
        </div>
      )}

      {/* App list */}
      {scanning && apps.length === 0 && (
        <p className="text-white/30 text-sm">Scanning /Applications…</p>
      )}

      {!scanning && apps.length === 0 && (
        <p className="text-white/30 text-sm">No apps found in /Applications.</p>
      )}

      {apps.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {apps.map((app) => {
            const isSelected = selected.has(app.path);
            return (
              <button
                key={app.path}
                onClick={() => toggle(app.path)}
                disabled={deleting}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all w-full"
                style={{
                  background: isSelected ? "rgba(239,68,68,0.10)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${isSelected ? "rgba(239,68,68,0.35)" : "rgba(255,255,255,0.07)"}`,
                }}
              >
                {/* Checkbox */}
                <span
                  className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 text-xs transition-all"
                  style={{
                    background: isSelected ? "#ef4444" : "rgba(255,255,255,0.08)",
                    border: `1px solid ${isSelected ? "#ef4444" : "rgba(255,255,255,0.15)"}`,
                    color: "#fff",
                  }}
                >
                  {isSelected && "✓"}
                </span>

                {/* App name */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white font-medium truncate">{app.name}</div>
                  {app.bundle_id && (
                    <div className="text-xs text-white/25 truncate">{app.bundle_id}</div>
                  )}
                </div>

                {/* Size */}
                <span className="text-xs text-white/40 tabular-nums flex-shrink-0">
                  {app.size > 0 ? fmtBytes(app.size) : "—"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
