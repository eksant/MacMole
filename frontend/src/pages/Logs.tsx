import { useEffect, useState } from "react";
import { FileText, RefreshCw, Folder, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ScanLogs, DeleteLogs } from "../../wailsjs/go/main/CommandService";
import { notify } from "../utils/notify";
import { Button } from "@/components/ui/button";

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
  const { t } = useTranslation("logs");
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
        const sorted = [...(list ?? [])].sort((a, b) => b.size - a.size);
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
        notify(t("notify_title"), res.output || t("notify_default"));
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
          {t("title")}
        </h2>
        <p className="text-sm mt-1.5 ml-10" style={{ color: "rgba(255,255,255,0.4)" }}>
          {t("description")}
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
            {logs.length !== 1
              ? t("items_count_plural", { count: logs.length })
              : t("items_count_singular", { count: logs.length })}
          </span>
          <span className="text-white/30">·</span>
          <span className="text-white/50">{t("total", { size: fmtBytes(totalSize) })}</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <Button variant="glass" size="sm" onClick={scan} disabled={scanning || deleting} className="gap-2">
          <RefreshCw size={13} className={scanning ? "animate-spin" : ""} />
          {scanning ? t("scanning") : t("refresh")}
        </Button>

        {logs.length > 0 && (
          <Button variant="ghost" size="sm" onClick={toggleAll} disabled={scanning || deleting} className="gap-2">
            {selected.size === logs.length ? t("deselect_all") : t("select_all")}
          </Button>
        )}

        <div className="flex-1" />

        {selected.size > 0 && (
          <span className="text-xs text-white/40">
            {t("selected_summary", { count: selected.size, size: fmtBytes(totalSelected) })}
          </span>
        )}

        <Button
          onClick={doDelete}
          disabled={selected.size === 0 || deleting || scanning}
          className="gap-2 font-semibold text-white"
          style={{
            background: selected.size > 0 && !deleting
              ? "linear-gradient(135deg,#a78bfa,#7c3aed)"
              : "rgba(167,139,250,0.10)",
            border: selected.size === 0 || deleting ? "1px solid rgba(167,139,250,0.2)" : "none",
            color: selected.size === 0 || deleting ? "rgba(167,139,250,0.3)" : "#fff",
            boxShadow: selected.size > 0 && !deleting ? "0 4px 16px rgba(167,139,250,0.22)" : "none",
          }}
        >
          <FileText size={13} />
          {deleting ? t("deleting") : t("delete_selected")}
        </Button>
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
        <p className="text-white/30 text-sm">{t("scanning_message")}</p>
      )}
      {!scanning && logs.length === 0 && (
        <p className="text-white/30 text-sm">{t("no_log_entries")}</p>
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
                  <div className="text-xs text-white/25">{t("modified", { date: fmtDate(log.mod_time) })}</div>
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
