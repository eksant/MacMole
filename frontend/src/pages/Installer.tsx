import { useState, useEffect } from "react";
import { Package, PlayCircle, Eye } from "lucide-react";
import { RunInstall } from "../../wailsjs/go/main/CommandService";
import { EventsOn, EventsOff } from "../../wailsjs/runtime/runtime";
import { notify } from "../utils/notify";

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

  useEffect(() => {
    EventsOn("command:output", (line: string) => {
      setLines(prev => [...prev, line]);
    });
    return () => { EventsOff("command:output"); };
  }, []);

  const run = async (dryRun: boolean) => {
    setRunning(true);
    setDone(false);
    setLines([]);
    try {
      const result = await RunInstall(dryRun);
      setSuccess(result.success);
      if (result.error) setLines(prev => [...prev, "Error: " + result.error]);
      if (!dryRun) notify("Mole — Installer Cleanup", result.success ? "Installer cleanup done." : "Finished with errors.");
    } finally {
      setRunning(false);
      setDone(true);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Package size={20} className="text-cyan-400" /> Installer Cleanup
        </h2>
        <p className="text-sm text-white/40 mt-1">
          Remove .pkg, .dmg, and .zip installer files that are no longer needed.
        </p>
      </div>

      {/* Task list */}
      <div
        className="rounded-xl p-4 flex flex-col gap-2"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        {TASKS.map((t, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-white/60">
            <span className="text-cyan-400/60 text-xs">✓</span>
            {t}
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          disabled={running}
          onClick={() => run(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
          style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)" }}
        >
          <Eye size={15} /> Preview (Dry Run)
        </button>
        <button
          disabled={running}
          onClick={() => run(false)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-cyan-600 hover:bg-cyan-500 text-white transition-all disabled:opacity-40"
        >
          <PlayCircle size={15} /> {running ? "Cleaning..." : "Clean Installers"}
        </button>
      </div>

      {(running || lines.length > 0) && (
        <div
          className="rounded-xl p-4 font-mono text-xs text-white/70 overflow-y-auto max-h-72 flex flex-col gap-0.5"
          style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          {lines.map((l, i) => <div key={i}>{l || "\u00A0"}</div>)}
          {running && <div className="text-cyan-400 animate-pulse">Running...</div>}
          {done && (
            <div className={`mt-2 font-semibold ${success ? "text-emerald-400" : "text-red-400"}`}>
              {success ? "Installer cleanup complete!" : "Finished with errors."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
