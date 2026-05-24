import { useEffect, useState } from "react";
import { HardDrive, FolderOpen, RefreshCw, AlertTriangle } from "lucide-react";
import { GetDiskAnalysis } from "../../wailsjs/go/main/CommandService";

interface DiskEntry {
  name: string;
  path: string;
  size: number;
  is_dir: boolean;
}

function fmtBytes(bytes: number): string {
  if (bytes >= 1 << 30) return (bytes / (1 << 30)).toFixed(1) + " GB";
  if (bytes >= 1 << 20) return (bytes / (1 << 20)).toFixed(1) + " MB";
  if (bytes >= 1 << 10) return (bytes / (1 << 10)).toFixed(0) + " KB";
  return bytes + " B";
}

export default function Analyzer() {
  const [entries, setEntries] = useState<DiskEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    GetDiskAnalysis()
      .then((list) => {
        const sorted = [...(list ?? [])].sort((a, b) => b.size - a.size);
        setEntries(sorted);
      })
      .catch((err: unknown) => setError(String(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const totalSize = entries.reduce((s, e) => s + e.size, 0);

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
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <HardDrive size={20} className="text-cyan-400" /> Disk Analyzer
          </h2>
          <p className="text-sm text-white/40 mt-1">
            Disk usage overview for major directories. Run{" "}
            <code className="font-mono text-cyan-400/70">mo analyze</code> in terminal for full
            interactive explorer.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all mt-0.5"
          style={{
            background: "rgba(6,182,212,0.08)",
            border: "1px solid rgba(6,182,212,0.2)",
            color: loading ? "rgba(6,182,212,0.3)" : "rgba(6,182,212,0.8)",
          }}
        >
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          {loading ? "Scanning…" : "Refresh"}
        </button>
      </div>

      {loading && entries.length === 0 && (
        <div className="text-white/30 text-sm">Calculating sizes… (may take a moment)</div>
      )}

      {!loading && entries.length === 0 && (
        <div className="text-white/30 text-sm">No directories found.</div>
      )}

      {entries.length > 0 && (
        <>
          {/* Total bar */}
          <div
            className="flex items-center justify-between px-4 py-3 rounded-xl text-sm"
            style={{ background: "rgba(6,182,212,0.07)", border: "1px solid rgba(6,182,212,0.18)" }}
          >
            <span style={{ color: "rgba(6,182,212,0.9)" }}>
              Total across {entries.length} directories
            </span>
            <span className="font-semibold tabular-nums text-white">{fmtBytes(totalSize)}</span>
          </div>

          <div className="flex flex-col gap-2">
            {entries.map((entry) => {
              const pct = totalSize > 0 ? (entry.size / totalSize) * 100 : 0;
              return (
                <div
                  key={entry.path}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <FolderOpen size={16} className="text-white/30 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-medium">{entry.name}</div>
                    <div className="text-xs text-white/25 truncate">{entry.path}</div>
                    {/* Size bar */}
                    <div
                      className="mt-1.5 w-full rounded-full"
                      style={{ height: 2, background: "rgba(255,255,255,0.07)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: "linear-gradient(90deg,#06b6d4,#0891b2)",
                          transition: "width 0.6s ease",
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm text-white/70 tabular-nums font-medium">
                      {entry.size > 0 ? fmtBytes(entry.size) : "—"}
                    </div>
                    <div className="text-xs text-white/25">{pct.toFixed(1)}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
