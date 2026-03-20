import { useEffect, useState } from "react";
import { LayoutDashboard, Trash2, Zap, HardDrive, Flame, Package, Settings, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { EventsOn, EventsOff } from "../../wailsjs/runtime/runtime";
import { IsMoInstalled } from "../../wailsjs/go/main/CommandService";
import type { Page } from "../App";

interface Props {
  current: Page;
  onNavigate: (page: Page) => void;
}

const nav: { id: Page; label: string; icon: React.ReactNode; group?: string }[] = [
  { id: "dashboard",  label: "Dashboard",        icon: <LayoutDashboard size={17} /> },
  { id: "cleaner",    label: "Cleaner",           icon: <Trash2 size={17} />,    group: "Tools" },
  { id: "optimizer",  label: "Optimizer",         icon: <Zap size={17} />,       group: "Tools" },
  { id: "purge",      label: "Purge",             icon: <Flame size={17} />,     group: "Tools" },
  { id: "installer",  label: "App Cleanup",       icon: <Package size={17} />,   group: "Tools" },
  { id: "analyzer",   label: "Analyzer",          icon: <HardDrive size={17} />, group: "Tools" },
  { id: "settings",   label: "Settings",          icon: <Settings size={17} /> },
];

/* Accent colors per page for the active glow */
const accentMap: Partial<Record<Page, string>> = {
  dashboard:  "#8b5cf6",
  cleaner:    "#3b82f6",
  optimizer:  "#f59e0b",
  purge:      "#f97316",
  installer:  "#10b981",
  analyzer:   "#06b6d4",
  settings:   "#94a3b8",
};

function NavBtn({ id, label, icon, current, onNavigate }: {
  id: Page; label: string; icon: React.ReactNode;
  current: Page; onNavigate: (p: Page) => void;
}) {
  const active = current === id;
  const accent = accentMap[id] ?? "#8b5cf6";

  return (
    <button
      onClick={() => onNavigate(id)}
      className="no-drag flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-200 w-full text-left relative overflow-hidden"
      style={active ? {
        background: `linear-gradient(135deg, ${accent}26, ${accent}14)`,
        border: `1px solid ${accent}40`,
        color: "#ffffff",
        fontWeight: 500,
      } : {
        background: "transparent",
        border: "1px solid transparent",
        color: "rgba(255,255,255,0.45)",
      }}
    >
      {/* Active left accent bar */}
      {active && (
        <span
          className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
          style={{ background: accent }}
        />
      )}
      <span style={{ color: active ? accent : "rgba(255,255,255,0.30)", transition: "color 0.2s" }}>
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

type CliStatus = "checking" | "ready" | "installing" | "failed";

export default function Sidebar({ current, onNavigate }: Props) {
  const [cliStatus, setCliStatus] = useState<CliStatus>("checking");
  const [failMsg, setFailMsg] = useState("");

  useEffect(() => {
    IsMoInstalled().then(ok => {
      setCliStatus(ok ? "ready" : "installing");
    });

    EventsOn("mo:installing",     () => setCliStatus("installing"));
    EventsOn("mo:ready",          () => setCliStatus("ready"));
    EventsOn("mo:install_failed", (msg: string) => {
      setCliStatus("failed");
      setFailMsg(msg);
    });

    return () => {
      EventsOff("mo:installing");
      EventsOff("mo:ready");
      EventsOff("mo:install_failed");
    };
  }, []);

  return (
    <aside
      className="drag-region flex flex-col w-52 flex-shrink-0 pb-4 px-2"
      style={{
        background: "linear-gradient(180deg, rgba(139,92,246,0.08) 0%, rgba(99,102,241,0.04) 100%)",
        borderRight: "1px solid rgba(139,92,246,0.15)",
      }}
    >
      {/* App brand */}
      <div className="no-drag px-3 pt-3 mb-5">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #8b5cf6, #6366f1)" }}
          >
            <span className="text-white text-xs font-bold">M</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-white leading-none">MacMole</h1>
            <p className="text-xs mt-0.5" style={{ color: "rgba(139,92,246,0.7)" }}>Mac Cleaner</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 flex-1">
        {nav.filter(n => !n.group && n.id !== "settings").map(({ id, label, icon }) => (
          <NavBtn key={id} id={id} label={label} icon={icon} current={current} onNavigate={onNavigate} />
        ))}

        <p className="text-xs uppercase tracking-wider px-3 pt-4 pb-1.5"
           style={{ color: "rgba(255,255,255,0.18)", letterSpacing: "0.08em" }}>
          Tools
        </p>
        {nav.filter(n => n.group === "Tools").map(({ id, label, icon }) => (
          <NavBtn key={id} id={id} label={label} icon={icon} current={current} onNavigate={onNavigate} />
        ))}

        <div className="flex-1" />
        {nav.filter(n => n.id === "settings").map(({ id, label, icon }) => (
          <NavBtn key={id} id={id} label={label} icon={icon} current={current} onNavigate={onNavigate} />
        ))}
      </nav>

      {/* CLI status */}
      <div className="no-drag px-3 pt-2 flex flex-col gap-1.5">
        {cliStatus === "installing" && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(251,191,36,0.8)" }}>
            <Loader2 size={11} className="animate-spin" />
            Installing CLI...
          </div>
        )}
        {cliStatus === "ready" && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(52,211,153,0.65)" }}>
            <CheckCircle2 size={11} />
            Mole CLI ready
          </div>
        )}
        {cliStatus === "failed" && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(248,113,113,0.8)" }} title={failMsg}>
            <AlertCircle size={11} />
            CLI not available
          </div>
        )}
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.18)" }}>v0.1.0</span>
      </div>
    </aside>
  );
}
