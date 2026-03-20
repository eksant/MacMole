import { useState, useEffect, useRef } from "react";
import { Zap, PlayCircle, Eye, CheckCircle2, AlertCircle } from "lucide-react";
import { RunOptimize } from "../../wailsjs/go/main/CommandService";
import { EventsOn, EventsOff } from "../../wailsjs/runtime/runtime";
import { notify } from "../utils/notify";
import SpinnerRing from "../components/SpinnerRing";

const TASKS = [
  "Rebuild system databases and clear caches",
  "Reset network services",
  "Refresh Finder and Dock",
  "Clean diagnostic and crash logs",
  "Rebuild launch services and Spotlight index",
];

export default function Optimizer() {
  const [running, setRunning]   = useState(false);
  const [lines, setLines]       = useState<string[]>([]);
  const [done, setDone]         = useState(false);
  const [success, setSuccess]   = useState(false);
  const [progress, setProgress] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    EventsOn("command:output", (line: string) => {
      setLines(prev => {
        const next = [...prev, line];
        setProgress(Math.min(95, Math.round((next.length / 40) * 95)));
        return next;
      });
    });
    return () => { EventsOff("command:output"); };
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [lines]);

  const run = async (dryRun: boolean) => {
    setRunning(true);
    setDone(false);
    setLines([]);
    setProgress(0);
    try {
      const result = await RunOptimize(dryRun);
      setSuccess(result.success);
      setProgress(100);
      if (result.error) setLines(prev => [...prev, "Error: " + result.error]);
      if (!dryRun) notify("Mole — Optimizer", result.success ? "Optimization complete!" : "Optimizer finished with errors.");
    } finally {
      setRunning(false);
      setDone(true);
    }
  };

  return (
    <div className="flex flex-col gap-5 animate-fade-in-up">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <span
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#f59e0b,#ef4444)" }}
          >
            <Zap size={16} className="text-white" />
          </span>
          System Optimizer
        </h2>
        <p className="text-sm mt-1.5 ml-10" style={{ color: "rgba(255,255,255,0.4)" }}>
          Refresh caches, rebuild services, and reset system state.
        </p>
      </div>

      {/* Task checklist */}
      <div
        className="rounded-2xl p-4 flex flex-col gap-2.5"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {TASKS.map((t, i) => (
          <div key={i} className="flex items-center gap-3 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs"
              style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b" }}
            >
              {i + 1}
            </span>
            {t}
          </div>
        ))}
      </div>

      {/* Progress bar (visible when running) */}
      {running && (
        <div className="flex flex-col gap-1.5 animate-fade-in">
          <div className="flex justify-between text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            <span>Progress</span><span>{progress}%</span>
          </div>
          <div className="w-full rounded-full overflow-hidden" style={{ height: 5, background: "rgba(255,255,255,0.08)" }}>
            <div
              className="h-full rounded-full shimmer-bar transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg,#f59e0b,#ef4444)",
                boxShadow: "0 0 8px rgba(245,158,11,0.5)",
              }}
            />
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          disabled={running}
          onClick={() => run(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-40 no-drag"
          style={{
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.75)",
          }}
        >
          <Eye size={14} /> Preview
        </button>
        <button
          disabled={running}
          onClick={() => run(false)}
          className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-40 no-drag"
          style={{
            background: running ? "rgba(245,158,11,0.2)" : "linear-gradient(135deg,#f59e0b,#ef4444)",
            border: running ? "1px solid rgba(245,158,11,0.4)" : "none",
            color: "#fff",
            boxShadow: running ? "none" : "0 4px 16px rgba(245,158,11,0.4)",
          }}
        >
          {running ? (
            <>
              <svg width="13" height="13" viewBox="0 0 13 13" className="animate-spin-ring">
                <circle cx="6.5" cy="6.5" r="5" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/>
                <path d="M6.5 1.5 A5 5 0 0 1 11.5 6.5" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Optimizing…
            </>
          ) : (
            <><PlayCircle size={14} /> Optimize</>
          )}
        </button>
      </div>

      {/* Spinner while log is empty */}
      {running && lines.length === 0 && (
        <SpinnerRing size={52} color="#f59e0b" label="Initializing optimizer…" />
      )}

      {/* Log */}
      {(running || lines.length > 0) && (
        <div
          ref={logRef}
          className="rounded-2xl p-4 font-mono text-xs overflow-y-auto max-h-64 flex flex-col gap-0.5 animate-fade-in"
          style={{
            background: "rgba(0,0,0,0.35)",
            border: "1px solid rgba(245,158,11,0.2)",
            color: "rgba(255,255,255,0.6)",
          }}
        >
          {lines.map((l, i) => (
            <div key={i} className="leading-5"
                 style={{ color: l.toLowerCase().startsWith("error") ? "#f87171" : undefined }}>
              {l || "\u00A0"}
            </div>
          ))}
          {running && (
            <div className="flex items-center gap-2 mt-1" style={{ color: "#fbbf24" }}>
              <div className="dot-loader flex gap-1"><span /><span /><span /></div>
              Running tasks…
            </div>
          )}
          {done && (
            <div className="flex items-center gap-2 mt-2 font-semibold animate-fade-in">
              {success
                ? <><CheckCircle2 size={14} style={{ color: "#34d399" }} /><span style={{ color: "#34d399" }}>Optimization complete!</span></>
                : <><AlertCircle size={14} style={{ color: "#f87171" }} /><span style={{ color: "#f87171" }}>Finished with errors.</span></>
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
}
