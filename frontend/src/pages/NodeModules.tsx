import { useEffect, useState } from "react";
import { Package, RefreshCw, ArrowUpDown, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ScanNodeModules, DeleteNodeModules } from "../../wailsjs/go/main/CommandService";
import { notify } from "../utils/notify";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface NodeModulesEntry {
  project_name: string;
  project_path: string;
  path: string;
  size: number;
  mod_time: number;
}

type SortKey = "mod_time" | "size" | "project_name";

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

function fmtRelativeDate(unix: number): string {
  const now = Date.now() / 1000;
  const diff = now - unix;
  if (diff < 86400) return "Today";
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400 / 7)}w ago`;
  if (diff < 86400 * 365) return `${Math.floor(diff / 86400 / 30)}mo ago`;
  return `${Math.floor(diff / 86400 / 365)}y ago`;
}

export default function NodeModules() {
  const { t } = useTranslation("nodemodules");
  const [entries, setEntries] = useState<NodeModulesEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("mod_time");
  const [sortAsc, setSortAsc] = useState(true); // oldest first by default
  const [error, setError] = useState<string | null>(null);

  const scan = () => {
    setScanning(true);
    setResult(null);
    setError(null);
    setSelected(new Set());
    ScanNodeModules()
      .then((e) => setEntries(e ?? []))
      .catch((err: unknown) => setError(String(err)))
      .finally(() => setScanning(false));
  };

  useEffect(() => {
    scan();
  }, []);

  const sorted = [...entries].sort((a, b) => {
    let diff = 0;
    if (sortKey === "mod_time") diff = a.mod_time - b.mod_time;
    else if (sortKey === "size") diff = a.size - b.size;
    else diff = a.project_name.localeCompare(b.project_name);
    return sortAsc ? diff : -diff;
  });

  const cycleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(key === "mod_time"); // oldest first for date, largest first for size
    }
  };

  const toggle = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === entries.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(entries.map((e) => e.path)));
    }
  };

  const totalSelected = entries
    .filter((e) => selected.has(e.path))
    .reduce((sum, e) => sum + e.size, 0);

  const doDelete = async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    setResult(null);
    try {
      const res = await DeleteNodeModules(Array.from(selected));
      setResult({ success: res.success, message: res.success ? res.output : res.error });
      if (res.success) {
        notify(t("notify_title"), res.output || t("notify_default"));
        scan();
      }
    } finally {
      setDeleting(false);
    }
  };

  const totalSize = entries.reduce((s, e) => s + e.size, 0);

  const SortBtn = ({ label, k }: { label: string; k: SortKey }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => cycleSort(k)}
      className={`gap-1 text-xs h-6 px-2 ${sortKey === k ? "text-emerald-400" : "text-white/30"}`}
    >
      {label}
      <ArrowUpDown size={10} />
    </Button>
  );

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
            style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)" }}
          >
            <Package size={16} className="text-white" />
          </span>
          {t("title")}
        </h2>
        <p className="text-sm mt-1.5 ml-10" style={{ color: "rgba(255,255,255,0.4)" }}>
          {t("description")}
        </p>
      </div>

      {/* Stats strip */}
      {entries.length > 0 && (
        <div
          className="flex items-center gap-6 px-4 py-3 rounded-xl text-sm"
          style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.18)" }}
        >
          <span style={{ color: "rgba(34,197,94,0.9)" }}>
            {t("found_count", { count: entries.length })}
          </span>
          <span className="text-white/30">·</span>
          <span className="text-white/50">{t("total_reclaimable", { size: fmtBytes(totalSize) })}</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <Button variant="glass" size="sm" onClick={scan} disabled={scanning || deleting} className="gap-2">
          <RefreshCw size={13} className={scanning ? "animate-spin" : ""} />
          {scanning ? t("scanning") : t("rescan")}
        </Button>

        {entries.length > 0 && (
          <Button variant="ghost" size="sm" onClick={toggleAll} disabled={scanning || deleting}>
            {selected.size === entries.length ? t("deselect_all") : t("select_all")}
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
              ? "linear-gradient(135deg,#22c55e,#16a34a)"
              : "rgba(34,197,94,0.10)",
            border: selected.size === 0 || deleting ? "1px solid rgba(34,197,94,0.2)" : "none",
            color: selected.size === 0 || deleting ? "rgba(34,197,94,0.3)" : "#fff",
            boxShadow: selected.size > 0 && !deleting ? "0 4px 16px rgba(34,197,94,0.22)" : "none",
          }}
        >
          <Package size={13} />
          {deleting ? t("removing") : t("remove_selected")}
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

      {/* Column headers */}
      {entries.length > 0 && (
        <div className="flex items-center gap-3 px-4 text-xs text-white/25">
          <span className="w-4 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <SortBtn label={t("column_project")} k="project_name" />
          </div>
          <SortBtn label={t("column_last_modified")} k="mod_time" />
          <SortBtn label={t("column_size")} k="size" />
        </div>
      )}

      {/* List */}
      {scanning && entries.length === 0 && (
        <p className="text-white/30 text-sm">{t("scanning_message")}</p>
      )}
      {!scanning && entries.length === 0 && (
        <p className="text-white/30 text-sm">
          {t("no_results")}
        </p>
      )}

      {sorted.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {sorted.map((entry) => {
            const isSelected = selected.has(entry.path);
            const isOld = Date.now() / 1000 - entry.mod_time > 86400 * 30; // older than 30 days

            return (
              <button
                key={entry.path}
                onClick={() => toggle(entry.path)}
                disabled={deleting}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all w-full"
                style={{
                  background: isSelected ? "rgba(34,197,94,0.10)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${isSelected ? "rgba(34,197,94,0.35)" : "rgba(255,255,255,0.07)"}`,
                }}
              >
                {/* Checkbox */}
                <span
                  className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 text-xs transition-all"
                  style={{
                    background: isSelected ? "#22c55e" : "rgba(255,255,255,0.08)",
                    border: `1px solid ${isSelected ? "#22c55e" : "rgba(255,255,255,0.15)"}`,
                    color: "#fff",
                  }}
                >
                  {isSelected && "✓"}
                </span>

                {/* Project info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white font-medium truncate">
                      {entry.project_name}
                    </span>
                    {isOld && (
                      <Badge variant="warning" className="flex-shrink-0 text-[10px]">
                        {t("badge_old")}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-white/25 truncate">{entry.project_path}</div>
                </div>

                {/* Date */}
                <div className="flex-shrink-0 text-right">
                  <div className="text-xs text-white/40">{fmtRelativeDate(entry.mod_time)}</div>
                  <div className="text-xs text-white/20">{fmtDate(entry.mod_time)}</div>
                </div>

                {/* Size */}
                <span className="text-xs text-white/40 tabular-nums flex-shrink-0 w-16 text-right">
                  {entry.size > 0 ? fmtBytes(entry.size) : "—"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
