import { useState, useEffect, useRef } from "react";
import {
  Activity,
  AlertCircle,
  BatteryMedium,
  CheckCircle2,
  Clock,
  Cpu,
  HardDrive,
  Info,
  MemoryStick,
  Wifi,
  XCircle,
  Zap,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";
import { useMetrics, useWatchedProcesses } from "../hooks/useMetrics";
import MetricCard from "../components/MetricCard";
import GaugeBar from "../components/GaugeBar";
import { RunAll } from "../../wailsjs/go/main/CommandService";
import { EventsOn, EventsOff } from "../../wailsjs/runtime/runtime";

function fmtBytes(bytes: number): string {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + " GB";
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + " MB";
  if (bytes >= 1e3) return (bytes / 1e3).toFixed(1) + " KB";
  return bytes + " B";
}

function fmtUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function healthScore(cpu: number, mem: number, disk: number): number {
  return Math.max(0, Math.min(100, Math.round(100 - (cpu * 0.3 + mem * 0.4 + disk * 0.3))));
}

/** Animated SVG ring for the health score */
function ScoreRing({ score }: { score: number }) {
  const { t } = useTranslation("dashboard");
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#34d399" : score >= 60 ? "#fbbf24" : score >= 40 ? "#fb923c" : "#f87171";
  const label =
    score >= 80
      ? t("score_labels.excellent")
      : score >= 60
        ? t("score_labels.good")
        : score >= 40
          ? t("score_labels.fair")
          : t("score_labels.critical");
  const scoreRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    if (scoreRef.current) {
      scoreRef.current.style.setProperty("--full", String(circumference));
      scoreRef.current.style.setProperty("--offset", String(offset));
    }
  }, [offset, circumference]);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
        <circle
          ref={scoreRef}
          cx="60" cy="60" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          transform="rotate(-90 60 60)"
          className="animate-score-ring"
          style={{ filter: `drop-shadow(0 0 8px ${color}90)`, transition: "stroke 0.5s ease" }}
        />
        <text x="60" y="57" textAnchor="middle" dominantBaseline="middle"
          fontSize="22" fontWeight="700" fill={color}
          fontFamily="-apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif">
          {score}
        </text>
        <text x="60" y="73" textAnchor="middle" dominantBaseline="middle"
          fontSize="10" fill="rgba(255,255,255,0.35)"
          fontFamily="-apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif">
          {label}
        </text>
      </svg>
      <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{t("health")}</span>
    </div>
  );
}

type OptStatus = "idle" | "running" | "done" | "error";

function extractFreed(output: string): string {
  const match = /freed\s+([\d.]+\s+[KMGT]?B)/i.exec(output);
  return match ? match[1] : "";
}

export default function Dashboard() {
  const { t } = useTranslation("dashboard");
  const m = useMetrics(2000);
  const watched = useWatchedProcesses();
  const zombies = watched.filter((p) => p.status === "zombie");
  const [optStatus, setOptStatus] = useState<OptStatus>("idle");
  const [optLines, setOptLines] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const [lastRun, setLastRun] = useState<{ time: string; freed: string } | null>(() => {
    const raw = localStorage.getItem("macmole_last_run");
    if (!raw) return null;
    try { return JSON.parse(raw) as { time: string; freed: string }; }
    catch { return null; }
  });

  useEffect(() => {
    EventsOn("command:output", (line: string) => {
      setOptLines((prev) => [...prev, line]);
    });
    EventsOn("command:phase", (label: string) => {
      setOptLines((prev) => [...prev, label]);
    });
    return () => {
      EventsOff("command:output");
      EventsOff("command:phase");
    };
  }, []);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [optLines]);

  const runAll = async () => {
    setOptStatus("running");
    setOptLines([]);
    try {
      const result = await RunAll(false);
      setOptStatus(result.success ? "done" : "error");
      if (result.error) setOptLines((prev) => [...prev, "Error: " + result.error]);
      if (result.success) {
        const entry = { time: new Date().toLocaleString(), freed: extractFreed(result.output) };
        localStorage.setItem("macmole_last_run", JSON.stringify(entry));
        setLastRun(entry);
      }
    } catch {
      setOptStatus("error");
    }
  };

  if (!m) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="dot-loader flex gap-1.5">
          <span />
          <span />
          <span />
        </div>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
          {t("collecting_metrics")}
        </p>
      </div>
    );
  }

  const score = healthScore(m.cpu.usage, m.memory.used_percent, m.disk.used_percent);

  return (
    <div className="flex flex-col gap-4 animate-fade-in-up">
      {zombies.length > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
          style={{
            background: "rgba(239,68,68,0.05)",
            border: "1px solid rgba(239,68,68,0.12)",
            color: "#fca5a5",
          }}
        >
          <AlertCircle size={14} className="flex-shrink-0" />
          <span>
            {zombies.length > 1
              ? t("zombie_alert_plural", { count: zombies.length })
              : t("zombie_alert", { count: zombies.length })}
          </span>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">{m.host.hostname}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Clock size={11} style={{ color: "rgba(255,255,255,0.3)" }} />
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              {m.host.platform} {m.host.platform_version} · up {fmtUptime(m.host.uptime_seconds)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <ScoreRing score={score} />

          {/* Optimize All button + info tooltip */}
          <TooltipProvider delayDuration={300}>
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-1.5">
                <button
                  disabled={optStatus === "running"}
                  onClick={runAll}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50 no-drag"
            style={
              optStatus === "done"
                ? {
                    background: "linear-gradient(135deg,#065f46,#059669)",
                    color: "rgba(255,255,255,0.9)",
                    boxShadow: "0 4px 16px rgba(16,185,129,0.18)",
                  }
                : optStatus === "error"
                  ? { background: "linear-gradient(135deg,#7f1d1d,#dc2626)", color: "rgba(255,255,255,0.9)" }
                  : optStatus === "running"
                    ? {
                        background: "rgba(139,92,246,0.12)",
                        border: "1px solid rgba(139,92,246,0.22)",
                        color: "rgba(255,255,255,0.6)",
                      }
                    : {
                        background: "linear-gradient(135deg,rgba(139,92,246,0.85),rgba(99,102,241,0.85))",
                        color: "#fff",
                        boxShadow: "0 4px 16px rgba(139,92,246,0.20)",
                      }
            }
          >
            {optStatus === "running" ? (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" className="animate-spin-ring">
                  <circle
                    cx="7"
                    cy="7"
                    r="5.5"
                    fill="none"
                    stroke="rgba(255,255,255,0.3)"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M7 1.5 A5.5 5.5 0 0 1 12.5 7"
                    fill="none"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                {t("optimizing")}
              </>
            ) : optStatus === "done" ? (
              <>
                <CheckCircle2 size={14} /> {t("done")}
              </>
            ) : optStatus === "error" ? (
              <>
                <XCircle size={14} /> {t("failed")}
              </>
            ) : (
              <>
                <Zap size={14} /> {t("optimize_all")}
              </>
            )}
                </button>

                {/* Info tooltip */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="no-drag rounded p-1 text-white/30 hover:text-white/60 transition-colors">
                      <Info size={13} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="font-medium text-white/90 mb-1">{t("optimize_all_what")}</p>
                    <p className="text-white/60 mb-1">✅ {t("optimize_all_covers")}</p>
                    <p className="text-amber-400/80">⚠️ {t("optimize_all_excludes")}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </TooltipProvider>
        </div>
      </div>
      {lastRun && optStatus === "idle" && (
        <div className="text-xs text-center" style={{ color: "rgba(255,255,255,0.25)" }}>
          {t("last_run", { time: lastRun.time })}
          {lastRun.freed && (
            <span className="text-emerald-400/50 ml-1">· {lastRun.freed} {t("freed")}</span>
          )}
        </div>
      )}

      {/* Live log output */}
      {(optStatus === "running" || optLines.length > 0) && (
        <div
          ref={logRef}
          className="rounded-2xl px-4 py-3 font-mono text-xs overflow-y-auto max-h-28 flex flex-col gap-0.5 animate-fade-in"
          style={{
            background: "rgba(0,0,0,0.18)",
            border: "1px solid rgba(139,92,246,0.12)",
            color: "rgba(255,255,255,0.55)",
          }}
        >
          {optLines.map((l, i) => (
            <div
              key={i}
              className={l.startsWith("---") ? "font-semibold" : ""}
              style={{ color: l.startsWith("---") ? "rgba(139,92,246,0.9)" : undefined }}
            >
              {l || " "}
            </div>
          ))}
          {optStatus === "running" && (
            <div className="flex items-center gap-1.5 mt-1" style={{ color: "#f59e0b" }}>
              <div className="dot-loader flex gap-1">
                <span />
                <span />
                <span />
              </div>
              {t("running")}
            </div>
          )}
        </div>
      )}

      {/* Metric grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* CPU */}
        <MetricCard title={t("cpu")} icon={<Cpu size={13} />} accentColor="#8b5cf6">
          <div className="flex items-end justify-between">
            <span className="text-2xl font-bold tabular-nums text-white">
              {m.cpu.usage.toFixed(1)}
              <span className="text-sm ml-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                %
              </span>
            </span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              {m.cpu.num_cores} {t("cores")}
            </span>
          </div>
          <GaugeBar value={m.cpu.usage} />
          {m.cpu.per_core && m.cpu.per_core.length > 0 && (
            <div
              className="grid gap-1 mt-0.5"
              style={{ gridTemplateColumns: `repeat(${Math.min(m.cpu.per_core.length, 8)}, 1fr)` }}
            >
              {m.cpu.per_core.slice(0, 8).map((v, i) => (
                <GaugeBar key={i} value={v} height={3} />
              ))}
            </div>
          )}
        </MetricCard>

        {/* Memory */}
        <MetricCard title={t("memory")} icon={<MemoryStick size={13} />} accentColor="#6366f1">
          <div className="flex items-end justify-between">
            <span className="text-2xl font-bold tabular-nums text-white">
              {m.memory.used_percent.toFixed(1)}
              <span className="text-sm ml-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                %
              </span>
            </span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              {fmtBytes(m.memory.total)}
            </span>
          </div>
          <GaugeBar value={m.memory.used_percent} />
          <div
            className="flex justify-between text-xs mt-1"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            <span>{t("used")} {fmtBytes(m.memory.used)}</span>
            <span>{t("free")} {fmtBytes(m.memory.available)}</span>
          </div>
        </MetricCard>

        {/* Disk */}
        <MetricCard title={t("disk")} icon={<HardDrive size={13} />} accentColor="#06b6d4">
          <div className="flex items-end justify-between">
            <span className="text-2xl font-bold tabular-nums text-white">
              {m.disk.used_percent.toFixed(1)}
              <span className="text-sm ml-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                %
              </span>
            </span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              {fmtBytes(m.disk.total)}
            </span>
          </div>
          <GaugeBar value={m.disk.used_percent} />
          <div
            className="flex justify-between text-xs mt-1"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            <span>{t("used")} {fmtBytes(m.disk.used)}</span>
            <span>{t("free")} {fmtBytes(m.disk.free)}</span>
          </div>
        </MetricCard>

        {/* Network */}
        <MetricCard title={t("network")} icon={<Wifi size={13} />} accentColor="#10b981">
          <div className="flex flex-col gap-2.5 mt-1">
            <div className="flex justify-between items-center">
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                {t("download")}
              </span>
              <span className="text-sm font-semibold tabular-nums" style={{ color: "#34d399" }}>
                {fmtBytes(m.network.bytes_recv_per_sec)}/s
              </span>
            </div>
            <div
              className="w-full rounded-full"
              style={{ height: 3, background: "rgba(255,255,255,0.08)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, (m.network.bytes_recv_per_sec / 125e6) * 100)}%`,
                  background: "linear-gradient(90deg, #10b981, #34d399)",
                  boxShadow: "0 0 5px rgba(16,185,129,0.22)",
                  transition: "width 0.7s ease",
                }}
              />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                {t("upload")}
              </span>
              <span className="text-sm font-semibold tabular-nums" style={{ color: "#60a5fa" }}>
                {fmtBytes(m.network.bytes_sent_per_sec)}/s
              </span>
            </div>
            <div
              className="w-full rounded-full"
              style={{ height: 3, background: "rgba(255,255,255,0.08)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, (m.network.bytes_sent_per_sec / 125e6) * 100)}%`,
                  background: "linear-gradient(90deg, #3b82f6, #60a5fa)",
                  boxShadow: "0 0 5px rgba(59,130,246,0.22)",
                  transition: "width 0.7s ease",
                }}
              />
            </div>
          </div>
        </MetricCard>
      </div>

      {/* Battery + Top Processes row */}
      <div className="grid grid-cols-2 gap-3">
        {/* Battery */}
        <MetricCard title={t("battery")} icon={<BatteryMedium size={13} />} accentColor="#f59e0b">
          {m.battery && m.battery.percent >= 0 ? (
            <>
              <div className="flex items-end justify-between">
                <span className="text-2xl font-bold tabular-nums text-white">
                  {m.battery.percent}
                  <span className="text-sm ml-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                    %
                  </span>
                </span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    background:
                      m.battery.status === "Charging"
                        ? "rgba(34,197,94,0.15)"
                        : m.battery.status === "Full"
                          ? "rgba(245,158,11,0.15)"
                          : "rgba(255,255,255,0.08)",
                    color:
                      m.battery.status === "Charging"
                        ? "#4ade80"
                        : m.battery.status === "Full"
                          ? "#fbbf24"
                          : "rgba(255,255,255,0.4)",
                  }}
                >
                  {m.battery.status}
                </span>
              </div>
              <GaugeBar value={m.battery.percent} />
            </>
          ) : (
            <div
              className="flex items-center gap-2 mt-2"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              <BatteryMedium size={14} />
              <span className="text-sm">{t("desktop_no_battery")}</span>
            </div>
          )}
        </MetricCard>

        {/* Top Processes */}
        <MetricCard title={t("top_processes")} icon={<Activity size={13} />} accentColor="#f97316">
          {m.top_processes && m.top_processes.length > 0 ? (
            <div className="flex flex-col gap-1.5 mt-1">
              {m.top_processes.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-white/60 truncate flex-1">{p.name}</span>
                  <span
                    className="text-xs tabular-nums flex-shrink-0"
                    style={{ color: "rgba(249,115,22,0.85)" }}
                  >
                    {p.cpu.toFixed(1)}%
                  </span>
                  <span
                    className="text-xs tabular-nums flex-shrink-0"
                    style={{ color: "rgba(255,255,255,0.25)" }}
                  >
                    {p.memory.toFixed(1)}%
                  </span>
                </div>
              ))}
              <div
                className="flex justify-end gap-4 text-xs mt-0.5"
                style={{ color: "rgba(255,255,255,0.2)" }}
              >
                <span>{t("cpu_label")}</span>
                <span>{t("mem_label")}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.3)" }}>
              {t("no_process_data")}
            </p>
          )}
        </MetricCard>
      </div>
    </div>
  );
}
