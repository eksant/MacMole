import { useState, useEffect, useRef } from "react";
import { Flame, PlayCircle, Eye, CheckCircle2, AlertCircle, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RunPurge } from "../../wailsjs/go/main/CommandService";
import { EventsOn, EventsOff } from "../../wailsjs/runtime/runtime";
import { notify } from "../utils/notify";
import SpinnerRing from "../components/SpinnerRing";

export default function Purge() {
  const { t } = useTranslation("purge");

  const TASKS = [
    t("tasks.remove_orphaned_support"),
    t("tasks.delete_preference_plists"),
    t("tasks.clear_font_caches"),
    t("tasks.remove_stale_extensions"),
    t("tasks.clean_broken_symlinks"),
  ];

  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [success, setSuccess] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    setRunning(true);
    setDone(false);
    setLines([]);
    try {
      const result = await RunPurge(dryRun);
      setSuccess(result.success);
      if (result.error) setLines((prev) => [...prev, "Error: " + result.error]);
      if (!dryRun)
        notify(
          t("notify_title"),
          result.success ? t("notify_success") : t("notify_error")
        );
    } catch (err: unknown) {
      setError(String(err));
    } finally {
      setRunning(false);
      setDone(true);
    }
  };

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
          <AlertCircle size={14} className="flex-shrink-0" />
          {error}
        </div>
      )}
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <span
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#f97316,#ef4444)" }}
          >
            <Flame size={16} className="text-white" />
          </span>
          {t("title")}
        </h2>
        <p className="text-sm mt-1.5 ml-10" style={{ color: "rgba(255,255,255,0.4)" }}>
          {t("description")}
        </p>
      </div>

      {/* Task list */}
      <div
        className="rounded-2xl p-4 flex flex-col gap-2.5"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {TASKS.map((task, i) => (
          <div
            key={i}
            className="flex items-center gap-3 text-sm"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs"
              style={{
                background: "rgba(249,115,22,0.15)",
                border: "1px solid rgba(249,115,22,0.3)",
                color: "#f97316",
              }}
            >
              {i + 1}
            </span>
            {task}
          </div>
        ))}
      </div>

      {/* Warning */}
      <div
        className="rounded-xl px-4 py-3 flex items-start gap-2.5 text-xs"
        style={{
          background: "rgba(251,191,36,0.08)",
          border: "1px solid rgba(251,191,36,0.2)",
          color: "rgba(251,191,36,0.85)",
        }}
      >
        <TriangleAlert size={13} className="flex-shrink-0 mt-0.5" />
        <span>{t("warning")}</span>
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
          <Eye size={14} /> {t("preview")}
        </button>
        <button
          disabled={running}
          onClick={() => run(false)}
          className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-40 no-drag"
          style={{
            background: running
              ? "rgba(249,115,22,0.2)"
              : "linear-gradient(135deg,#f97316,#ef4444)",
            border: running ? "1px solid rgba(249,115,22,0.4)" : "none",
            color: "#fff",
            boxShadow: running ? "none" : "0 4px 16px rgba(249,115,22,0.4)",
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
              {t("purging")}
            </>
          ) : (
            <>
              <PlayCircle size={14} /> {t("run_purge")}
            </>
          )}
        </button>
      </div>

      {/* Spinner */}
      {running && lines.length === 0 && (
        <SpinnerRing size={52} color="#f97316" label={t("scanning_message")} />
      )}

      {/* Log */}
      {(running || lines.length > 0) && (
        <div
          ref={logRef}
          className="rounded-2xl p-4 font-mono text-xs overflow-y-auto max-h-64 flex flex-col gap-0.5 animate-fade-in"
          style={{
            background: "rgba(0,0,0,0.35)",
            border: "1px solid rgba(249,115,22,0.2)",
            color: "rgba(255,255,255,0.6)",
          }}
        >
          {lines.map((l, i) => (
            <div
              key={i}
              className="leading-5"
              style={{ color: l.toLowerCase().startsWith("error") ? "#f87171" : undefined }}
            >
              {l || " "}
            </div>
          ))}
          {running && (
            <div className="flex items-center gap-2 mt-1" style={{ color: "#fb923c" }}>
              <div className="dot-loader flex gap-1">
                <span />
                <span />
                <span />
              </div>
              {t("purging")}
            </div>
          )}
          {done && (
            <div className="flex items-center gap-2 mt-2 font-semibold animate-fade-in">
              {success ? (
                <>
                  <CheckCircle2 size={14} style={{ color: "#34d399" }} />
                  <span style={{ color: "#34d399" }}>{t("purge_complete")}</span>
                </>
              ) : (
                <>
                  <AlertCircle size={14} style={{ color: "#f87171" }} />
                  <span style={{ color: "#f87171" }}>{t("finished_with_errors")}</span>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
