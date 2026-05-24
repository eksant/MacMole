import { useEffect, useState } from "react";
import { FileText, RefreshCw, Folder, AlertTriangle } from "lucide-react";
import { ScanLogs, DeleteLogs } from "../../wailsjs/go/main/CommandService";
import { notify } from "../utils/notify";

interface LogEntry {
  name: string;
  path: string;
  size: number;
  mod_time: number;
  is_dir: boolean;
}

function fmtBytes(bytes: number): string {
  if (bytes >= 1 << 30) return (bytes / (1 << 30)).toFixed(1) + " GB";
  if (bytes >= 1 << 20) return (bytes / (1 << 20)).toFixed(1) + " MB";
  if (bytes >= 1 << 10) return (bytes / (1 << 10)).toFixed(0) + " KB";
  return bytes + " B";
}

function fmtDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function Logs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
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
    ScanLogs()
      .then((list) => {
        const sorted = [...list].sort((a, b) => b.size - a.size);
        setLogs(sorted);
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
    if (selected.size === logs.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(logs.map((l) => l.path)));
    }
  };

  const totalSelected = logs
    .filter((l) => selected.has(l.path))
    .reduce((sum, l) => sum + l.size, 0);

  const doDelete = async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    setResult(null);
    try {
      const res = await DeleteLogs(Array.from(selected));
      setResult({ success: res.success, message: res.success ? res.output : res.error });
      if (res.success) {
        notify("MacMole — Log Cleaner", res.output || "Logs removed successfully.");
        scan();
      }
    } finally {
      setDeleting(false);
    }
  };

  const totalSize = logs.reduce((s, l) => s + l.size, 0);

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
            style={{ background: "linear-gradient(135deg,#a78bfa,#7c3aed)" }}
          >
            <FileText size={16} className="text-white" />
          </span>
          Log Cleaner
        </h2>
        <p className="text-sm mt-1.5 ml-10" style={{ color: "rgba(255,255,255,0.4)" }}>
          Remove application log files from ~/Library/Logs. Safe to clean — apps recreate logs as
          needed.
        </p>
      </div>

      {/* Stats strip */}
      {logs.length > 0 && (
        <div
          className="flex items-center gap-6 px-4 py-3 rounded-xl text-sm"
          style={{
            background: "rgba(167,139,250,0.07)",
            border: "1px solid rgba(167,139,250,0.18)",
          }}
        >
          <span style={{ color: "rgba(167,139,250,0.9)" }}>
            {logs.length} item{logs.length !== 1 ? "s" : ""}
          </span>
          <span className="text-white/30">·</span>
          <span className="text-white/50">Total: {fmtBytes(totalSize)}</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <button
          onClick={scan}
          disabled={scanning || deleting}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
          style={{
            background: scanning ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: scanning ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.7)",
          }}
        >
          <RefreshCw size={13} className={scanning ? "animate-spin" : ""} />
          {scanning ? "Scanning…" : "Refresh"}
        </button>

        {logs.length > 0 && (
          <button
            onClick={toggleAll}
            disabled={scanning || deleting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            {selected.size === logs.length ? "Deselect All" : "Select All"}
          </button>
        )}

        <div className="flex-1" />

        {selected.size > 0 && (
          <span className="text-xs text-white/40">
            {selected.size} selected — {fmtBytes(totalSelected)}
          </span>
        )}

        <button
          onClick={doDelete}
          disabled={selected.size === 0 || deleting || scanning}
          className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all"
          style={
            selected.size === 0 || deleting
              ? {
                  background: "rgba(167,139,250,0.10)",
                  border: "1px solid rgba(167,139,250,0.2)",
                  color: "rgba(167,139,250,0.3)",
                }
              : {
                  background: "linear-gradient(135deg,#a78bfa,#7c3aed)",
                  color: "#fff",
                  boxShadow: "0 4px 16px rgba(167,139,250,0.35)",
                }
          }
        >
          <FileText size={13} />
          {deleting ? "Deleting…" : "Delete Selected"}
        </button>
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

      {/* List */}
      {scanning && logs.length === 0 && (
        <p className="text-white/30 text-sm">Scanning ~/Library/Logs…</p>
      )}
      {!scanning && logs.length === 0 && (
        <p className="text-white/30 text-sm">No log entries found.</p>
      )}

      {logs.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {logs.map((log) => {
            const isSelected = selected.has(log.path);
            return (
              <button
                key={log.path}
                onClick={() => toggle(log.path)}
                disabled={deleting}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all w-full"
                style={{
                  background: isSelected ? "rgba(167,139,250,0.10)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${isSelected ? "rgba(167,139,250,0.35)" : "rgba(255,255,255,0.07)"}`,
                }}
              >
                {/* Checkbox */}
                <span
                  className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 text-xs transition-all"
                  style={{
                    background: isSelected ? "#a78bfa" : "rgba(255,255,255,0.08)",
                    border: `1px solid ${isSelected ? "#a78bfa" : "rgba(255,255,255,0.15)"}`,
                    color: "#fff",
                  }}
                >
                  {isSelected && "✓"}
                </span>

                {/* Icon */}
                {log.is_dir ? (
                  <Folder
                    size={14}
                    className="flex-shrink-0"
                    style={{ color: "rgba(167,139,250,0.5)" }}
                  />
                ) : (
                  <FileText
                    size={14}
                    className="flex-shrink-0"
                    style={{ color: "rgba(255,255,255,0.2)" }}
                  />
                )}

                {/* Name + date */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white font-medium truncate">{log.name}</div>
                  <div className="text-xs text-white/25">Modified {fmtDate(log.mod_time)}</div>
                </div>

                {/* Size */}
                <span className="text-xs text-white/40 tabular-nums flex-shrink-0">
                  {log.size > 0 ? fmtBytes(log.size) : "—"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
