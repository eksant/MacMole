import { useState, useEffect, useRef } from "react";
import { Sparkles, PlayCircle, Eye, CheckCircle2, AlertCircle } from "lucide-react";
import { RunClean, RunOptimize, RunPurge } from "../../wailsjs/go/main/CommandService";
import { EventsOn, EventsOff } from "../../wailsjs/runtime/runtime";
import { notify } from "../utils/notify";
import SpinnerRing from "../components/SpinnerRing";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Tab = "clean" | "optimize" | "purge";

const TAB_CONFIG: Record<Tab, {
  label: string;
  description: string;
  color: string;
  dangerLevel: "safe" | "low-risk" | "destructive";
}> = {
  clean: {
    label: "Deep Clean",
    description: "Removes caches, logs, temp files, and browser artifacts. Safe to run anytime.",
    color: "#3b82f6",
    dangerLevel: "safe",
  },
  optimize: {
    label: "Optimize",
    description: "Runs macOS maintenance scripts, rebuilds Launch Services, compacts SQLite databases.",
    color: "#f59e0b",
    dangerLevel: "low-risk",
  },
  purge: {
    label: "Purge",
    description: "Aggressively removes additional caches and development artifacts. Review before applying.",
    color: "#f97316",
    dangerLevel: "destructive",
  },
};

export default function Cleanup() {
  const [tab, setTab] = useState<Tab>("clean");
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const cfg = TAB_CONFIG[tab];

  useEffect(() => {
    EventsOn("command:output", (line: string) => {
      setLines(prev => [...prev, line]);
    });
    return () => { EventsOff("command:output"); };
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [lines]);

  // Reset state when switching tabs
  useEffect(() => {
    setLines([]);
    setDone(false);
    setError(null);
  }, [tab]);

  const run = async (dryRun: boolean) => {
    setRunning(true);
    setDone(false);
    setError(null);
    setLines([]);
    try {
      const fn = tab === "clean" ? RunClean : tab === "optimize" ? RunOptimize : RunPurge;
      const result = await fn(dryRun);
      setSuccess(result.success);
      if (result.error) setLines(prev => [...prev, "Error: " + result.error]);
      if (!dryRun) notify("MacMole", result.success ? `${cfg.label} completed.` : `${cfg.label} finished with errors.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Command failed.");
    } finally {
      setRunning(false);
      setDone(true);
    }
  };

  const dangerVariant = cfg.dangerLevel === "safe"
    ? "success"
    : cfg.dangerLevel === "low-risk"
      ? "warning"
      : "destructive";

  const dangerLabel = cfg.dangerLevel === "safe"
    ? "Safe"
    : cfg.dangerLevel === "low-risk"
      ? "Low Risk"
      : "Destructive";

  return (
    <div className="flex flex-col gap-5 animate-fade-in-up">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `linear-gradient(135deg,${cfg.color},${cfg.color}cc)` }}>
            <Sparkles size={16} className="text-white" />
          </span>
          Cleanup
        </h2>
        <p className="text-sm mt-1.5 ml-10 text-white/40">{cfg.description}</p>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => { if (!running) setTab(v as Tab); }}>
        <TabsList className="w-full">
          {(["clean", "optimize", "purge"] as Tab[]).map(t => (
            <TabsTrigger key={t} value={t} className="flex-1" disabled={running}>
              {TAB_CONFIG[t].label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Risk badge */}
      <div className="flex items-center gap-2">
        <Badge variant={dangerVariant}>{dangerLabel}</Badge>
        <span className="text-xs text-white/30">{cfg.description}</span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <Button variant="glass" size="sm" onClick={() => { void run(true); }} disabled={running}>
          <Eye size={13} /> Dry Run
        </Button>
        <Button
          onClick={() => { void run(false); }}
          disabled={running}
          className="gap-2 font-semibold"
          style={{
            background: `linear-gradient(135deg,${cfg.color},${cfg.color}cc)`,
            color: "#fff",
            boxShadow: `0 4px 16px ${cfg.color}28`,
            opacity: running ? 0.6 : 1,
          }}
        >
          {running ? <SpinnerRing /> : <PlayCircle size={14} />}
          {running ? "Running…" : `Run ${cfg.label}`}
        </Button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-sm"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
          {error}
        </div>
      )}

      {done && !running && (
        <div className="flex items-center gap-2 text-sm"
          style={{ color: success ? "#34d399" : "#f87171" }}>
          {success ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {success ? `${cfg.label} completed successfully.` : `${cfg.label} finished with errors.`}
        </div>
      )}

      {lines.length > 0 && (
        <div ref={logRef}
          className="rounded-2xl px-4 py-3 font-mono text-xs overflow-y-auto max-h-64 flex flex-col gap-0.5"
          style={{ background: "rgba(0,0,0,0.35)", border: `1px solid ${cfg.color}30`, color: "rgba(255,255,255,0.55)" }}>
          {lines.map((l, i) => (
            <div key={i}>{l || " "}</div>
          ))}
          {running && (
            <div className="flex items-center gap-1.5 mt-1" style={{ color: cfg.color }}>
              <div className="dot-loader flex gap-1"><span /><span /><span /></div>
              Running…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
