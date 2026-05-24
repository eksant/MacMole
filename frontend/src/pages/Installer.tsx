import { useState, useEffect, useRef } from "react";
import { Package, PlayCircle, Eye, CheckCircle2, AlertCircle } from "lucide-react";
import { RunInstall } from "../../wailsjs/go/main/CommandService";
import { EventsOn, EventsOff } from "../../wailsjs/runtime/runtime";
import { notify } from "../utils/notify";
import SpinnerRing from "../components/SpinnerRing";

const TASKS = [
  "Find and remove .pkg installer files",
  "Clear leftover .dmg disk images",
  "Delete downloaded .zip archives in Downloads",
  "Remove unused installer caches",
  "Clean up quarantine attributes",
];

export default function Installer() {
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [success, setSuccess] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    EventsOn("command:output", (line: string) => {
      setLines((prev) => [...prev, line]);
    });
    return () => {
      EventsOff("command:output");
    };
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [lines]);

  const run = async (dryRun: boolean) => {
    setRunning(true);
    setDone(false);
    setLines([]);
    try {
      const result = await RunInstall(dryRun);
      setSuccess(result.success);
      if (result.error) setLines((prev) => [...prev, "Error: " + result.error]);
      if (!dryRun)
        notify(
          "Mole — Installer Cleanup",
          result.success ? "Installer cleanup done." : "Finished with errors."
        );
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
            style={{ background: "linear-gradient(135deg,#10b981,#06b6d4)" }}
          >
            <Package size={16} className="text-white" />
          </span>
          Installer Cleanup
        </h2>
        <p className="text-sm mt-1.5 ml-10" style={{ color: "rgba(255,255,255,0.4)" }}>
          Remove .pkg, .dmg, and .zip installer files that are no longer needed.
        </p>
      </div>

      {/* Task list */}
      <div
        className="rounded-2xl p-4 flex flex-col gap-2.5"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {TASKS.map((t, i) => (
          <div
            key={i}
            className="flex items-center gap-3 text-sm"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs"
              style={{
                background: "rgba(16,185,129,0.15)",
                border: "1px solid rgba(16,185,129,0.3)",
                color: "#10b981",
              }}
            >
              {i + 1}
            </span>
            {t}
          </div>
        ))}
      </div>

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
            background: running
              ? "rgba(16,185,129,0.2)"
              : "linear-gradient(135deg,#10b981,#06b6d4)",
            border: running ? "1px solid rgba(16,185,129,0.4)" : "none",
            color: "#fff",
            boxShadow: running ? "none" : "0 4px 16px rgba(16,185,129,0.4)",
          }}
        >
          {running ? (
            <>
              <svg width="13" height="13" viewBox="0 0 13 13" className="animate-spin-ring">
                <circle
                  cx="6.5"
                  cy="6.5"
                  r="5"
                  fill="none"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="1.5"
                />
                <path
                  d="M6.5 1.5 A5 5 0 0 1 11.5 6.5"
                  fill="none"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              Cleaning…
            </>
          ) : (
            <>
              <PlayCircle size={14} /> Clean Installers
            </>
          )}
        </button>
      </div>

      {/* Spinner while log is empty */}
      {running && lines.length === 0 && (
        <SpinnerRing size={52} color="#10b981" label="Scanning for installer files…" />
      )}

      {/* Log */}
      {(running || lines.length > 0) && (
        <div
          ref={logRef}
          className="rounded-2xl p-4 font-mono text-xs overflow-y-auto max-h-64 flex flex-col gap-0.5 animate-fade-in"
          style={{
            background: "rgba(0,0,0,0.35)",
            border: "1px solid rgba(16,185,129,0.2)",
            color: "rgba(255,255,255,0.6)",
          }}
        >
          {lines.map((l, i) => (
            <div
              key={i}
              className="leading-5"
              style={{ color: l.toLowerCase().startsWith("error") ? "#f87171" : undefined }}
            >
              {l || "\u00A0"}
            </div>
          ))}
          {running && (
            <div className="flex items-center gap-2 mt-1" style={{ color: "#34d399" }}>
              <div className="dot-loader flex gap-1">
                <span />
                <span />
                <span />
              </div>
              Cleaning up…
            </div>
          )}
          {done && (
            <div className="flex items-center gap-2 mt-2 font-semibold animate-fade-in">
              {success ? (
                <>
                  <CheckCircle2 size={14} style={{ color: "#34d399" }} />
                  <span style={{ color: "#34d399" }}>Cleanup complete!</span>
                </>
              ) : (
                <>
                  <AlertCircle size={14} style={{ color: "#f87171" }} />
                  <span style={{ color: "#f87171" }}>Finished with errors.</span>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
