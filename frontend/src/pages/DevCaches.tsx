import { useState, useEffect } from "react";
import { Code2, RefreshCw, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { GetDevCaches, CleanDevCaches } from "../../wailsjs/go/main/DevCacheService";
import type { main } from "../../wailsjs/go/models";
import { Button } from "@/components/ui/button";

function fmtBytes(bytes: number): string {
  if (bytes >= 1 << 30) return (bytes / (1 << 30)).toFixed(1) + " GB";
  if (bytes >= 1 << 20) return (bytes / (1 << 20)).toFixed(1) + " MB";
  if (bytes >= 1 << 10) return (bytes / (1 << 10)).toFixed(0) + " KB";
  return bytes + " B";
}

export default function DevCaches() {
  const [tools, setTools] = useState<main.DevCacheTool[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [results, setResults] = useState<main.DevCacheResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    GetDevCaches()
      .then((t) => setTools(t ?? []))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to scan dev caches.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalSelected = tools
    .filter((t) => selected.has(t.id))
    .reduce((sum, t) => sum + t.size_bytes, 0);

  const clean = async () => {
    setCleaning(true);
    setResults([]);
    try {
      const res = await CleanDevCaches(Array.from(selected));
      setResults(res);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Clean failed.");
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 animate-fade-in-up">
      <div>
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <span
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}
          >
            <Code2 size={16} className="text-white" />
          </span>
          Dev Caches
        </h2>
        <p className="text-sm mt-1.5 ml-10 text-white/40">
          Clean developer tool caches using each tool&apos;s native clean command.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="glass" size="sm" onClick={load} disabled={loading || cleaning} className="gap-2"><RefreshCw size={13} className={loading ? "animate-spin" : ""} />{loading ? "Scanning…" : "Refresh"}</Button>
        <div className="flex-1" />
        {selected.size > 0 && (
          <span className="text-xs text-white/40">
            {selected.size} selected &mdash; ~{fmtBytes(totalSelected)} to free
          </span>
        )}
        <Button
          onClick={clean}
          disabled={selected.size === 0 || cleaning || loading}
          className="gap-2 font-semibold text-white"
          style={{
            background: selected.size > 0 && !cleaning
              ? "linear-gradient(135deg,#10b981,#059669)"
              : "rgba(16,185,129,0.1)",
            border: selected.size === 0 || cleaning ? "1px solid rgba(16,185,129,0.2)" : "none",
            color: selected.size === 0 || cleaning ? "rgba(16,185,129,0.3)" : "#fff",
            boxShadow: selected.size > 0 && !cleaning ? "0 4px 16px rgba(16,185,129,0.22)" : "none",
          }}
        >
          <Trash2 size={13} />
          {cleaning ? "Cleaning…" : "Clean Selected"}
        </Button>
      </div>

      {error && (
        <div
          className="px-4 py-3 rounded-xl text-sm flex items-center gap-2"
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "#f87171",
          }}
        >
          <AlertCircle size={14} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {results.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
              style={{
                background: r.success ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                border: `1px solid ${r.success ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
                color: r.success ? "#34d399" : "#f87171",
              }}
            >
              {r.success ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
              <span className="font-medium">{r.id}</span>
              <span className="text-white/40">{r.success ? r.freed : r.error}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {tools.map((tool) => {
          const isSelected = selected.has(tool.id);
          return (
            <button
              key={tool.id}
              onClick={() => {
                if (tool.available) toggle(tool.id);
              }}
              disabled={!tool.available || cleaning}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all w-full"
              style={{
                background: isSelected ? "rgba(16,185,129,0.10)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${isSelected ? "rgba(16,185,129,0.35)" : "rgba(255,255,255,0.07)"}`,
                opacity: tool.available ? 1 : 0.4,
              }}
            >
              <span
                className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 text-xs transition-all"
                style={{
                  background: isSelected ? "#10b981" : "rgba(255,255,255,0.08)",
                  border: `1px solid ${isSelected ? "#10b981" : "rgba(255,255,255,0.15)"}`,
                  color: "#fff",
                }}
              >
                {isSelected ? "✓" : ""}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white font-medium">{tool.name}</div>
                {!tool.available && <div className="text-xs text-white/25">Not installed</div>}
              </div>
              <span className="text-xs text-white/40 tabular-nums flex-shrink-0">
                {tool.size_bytes > 0 ? fmtBytes(tool.size_bytes) : "—"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
