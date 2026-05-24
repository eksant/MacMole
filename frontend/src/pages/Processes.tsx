import { useState, useEffect } from "react";
import { Activity, RefreshCw, Zap, AlertTriangle } from "lucide-react";
import { ListFlaggedProcesses, KillProcesses } from "../../wailsjs/go/main/ProcessService";
import type { main } from "../../wailsjs/go/models";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STATUS_COLORS: Record<string, string> = {
  zombie: "#f87171",
  "high-cpu": "#fb923c",
  "high-mem": "#a78bfa",
};

const STATUS_LABELS: Record<string, string> = {
  zombie: "Zombie",
  "high-cpu": "High CPU",
  "high-mem": "High Mem",
};

export default function Processes() {
  const [procs, setProcs] = useState<main.ProcessDetail[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [killing, setKilling] = useState(false);
  const [results, setResults] = useState<main.KillProcessResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    ListFlaggedProcesses()
      .then((p) => setProcs(p ?? []))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Scan failed.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = (pid: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(pid) ? next.delete(pid) : next.add(pid);
      return next;
    });
  };

  const kill = async () => {
    setKilling(true);
    setResults([]);
    try {
      const res = await KillProcesses(Array.from(selected));
      setResults(res);
      setSelected(new Set());
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Kill failed.");
    } finally {
      setKilling(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 animate-fade-in-up">
      <div>
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <span
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#f97316,#ea580c)" }}
          >
            <Activity size={16} className="text-white" />
          </span>
          Process Manager
        </h2>
        <p className="text-sm mt-1.5 ml-10 text-white/40">
          Detect and terminate zombie, high-CPU, or high-memory processes.
        </p>
      </div>

      <div
        className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
        style={{
          background: "rgba(249,115,22,0.08)",
          border: "1px solid rgba(249,115,22,0.2)",
          color: "rgba(249,115,22,0.8)",
        }}
      >
        <AlertTriangle size={14} className="flex-shrink-0" />
        <span>Killing processes is irreversible. Only flagged processes are shown.</span>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="glass" size="sm" onClick={load} disabled={loading || killing} className="gap-2">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          {loading ? "Scanning…" : "Refresh"}
        </Button>
        <div className="flex-1" />
        <Button
          onClick={kill}
          disabled={selected.size === 0 || killing || loading}
          className="gap-2 font-semibold text-white"
          style={{
            background: selected.size > 0 && !killing ? "linear-gradient(135deg,#f97316,#ea580c)" : "rgba(249,115,22,0.1)",
            border: selected.size === 0 || killing ? "1px solid rgba(249,115,22,0.2)" : "none",
            color: selected.size === 0 || killing ? "rgba(249,115,22,0.3)" : "#fff",
            boxShadow: selected.size > 0 && !killing ? "0 4px 16px rgba(249,115,22,0.22)" : "none",
          }}
        >
          <Zap size={13} />
          {killing ? "Killing…" : `Kill${selected.size > 0 ? ` ${selected.size}` : ""} Selected`}
        </Button>
      </div>

      {error && (
        <div
          className="px-4 py-3 rounded-xl text-sm"
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "#f87171",
          }}
        >
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="flex flex-col gap-1">
          {results.map((r) => (
            <div
              key={r.pid}
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
              style={{
                color: r.success ? "#34d399" : "#f87171",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              PID {r.pid}: {r.message}
            </div>
          ))}
        </div>
      )}

      {!loading && procs.length === 0 && (
        <div className="flex items-center gap-2 text-white/30 text-sm mt-4">
          <Activity size={14} />
          No flagged processes found. System looks healthy.
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {procs.map((proc) => {
          const isSelected = selected.has(proc.pid);
          const color = STATUS_COLORS[proc.status] ?? "#94a3b8";
          return (
            <button
              key={proc.pid}
              onClick={() => toggle(proc.pid)}
              disabled={killing}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all w-full"
              style={{
                background: isSelected ? `${color}18` : "rgba(255,255,255,0.04)",
                border: `1px solid ${isSelected ? `${color}50` : "rgba(255,255,255,0.07)"}`,
              }}
            >
              <span
                className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 text-xs"
                style={{
                  background: isSelected ? color : "rgba(255,255,255,0.08)",
                  border: `1px solid ${isSelected ? color : "rgba(255,255,255,0.15)"}`,
                  color: "#fff",
                }}
              >
                {isSelected ? "✓" : ""}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white font-medium truncate">{proc.name}</span>
                  <Badge variant={proc.status === "zombie" ? "destructive" : proc.status === "high-cpu" ? "warning" : "default"}>
                    {STATUS_LABELS[proc.status]}
                  </Badge>
                </div>
                <div className="text-xs text-white/25">
                  PID {proc.pid} &middot; runtime {proc.runtime}
                </div>
              </div>
              <div className="flex gap-3 text-xs tabular-nums flex-shrink-0">
                <span style={{ color: "rgba(249,115,22,0.7)" }}>{proc.cpu.toFixed(1)}% cpu</span>
                <span style={{ color: "rgba(255,255,255,0.3)" }}>{proc.memory.toFixed(1)}% mem</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
