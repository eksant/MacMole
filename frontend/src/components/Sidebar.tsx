import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  HardDrive,
  Sparkles,
  Settings,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AppWindow,
  FileText,
  Code2,
  Activity,
  Clock,
  Archive,
  FolderX,
} from "lucide-react";
import logoSvg from "../assets/images/logo.svg";
import { EventsOn, EventsOff } from "../../wailsjs/runtime/runtime";
import { IsMoInstalled } from "../../wailsjs/go/main/CommandService";
import type { Page } from "../App";

interface Props {
  current: Page;
  onNavigate: (page: Page) => void;
}

const nav: { id: Page; label: string; icon: React.ReactNode; group?: string }[] = [
  { id: "dashboard",   label: "Dashboard",    icon: <LayoutDashboard size={17} /> },

  // Clean group
  { id: "cleanup",     label: "Cleanup",      icon: <Sparkles size={17} />,      group: "Clean" },
  { id: "devcaches",   label: "Dev Caches",   icon: <Code2 size={17} />,         group: "Clean" },

  // Manage group
  { id: "uninstall",   label: "Uninstall",    icon: <AppWindow size={17} />,     group: "Manage" },
  { id: "installer",   label: "App Cleanup",  icon: <Archive size={17} />,       group: "Manage" },
  { id: "logs",        label: "Clean Logs",   icon: <FileText size={17} />,      group: "Manage" },
  { id: "nodemodules", label: "Node Modules", icon: <FolderX size={17} />,       group: "Manage" },

  // Monitor group
  { id: "analyzer",    label: "Disk Analyzer",icon: <HardDrive size={17} />,     group: "Monitor" },
  { id: "processes",   label: "Processes",    icon: <Activity size={17} />,      group: "Monitor" },
  { id: "history",     label: "History",      icon: <Clock size={17} />,         group: "Monitor" },

  { id: "settings",    label: "Settings",     icon: <Settings size={17} /> },
];

/* Accent colors per page for the active glow */
const accentMap: Partial<Record<Page, string>> = {
  dashboard: "#8b5cf6",
  cleanup: "#3b82f6",
  installer: "#10b981",
  uninstall: "#ef4444",
  logs: "#a78bfa",
  nodemodules: "#22c55e",
  devcaches: "#10b981",
  processes: "#f97316",
  history: "#6366f1",
  analyzer: "#06b6d4",
  settings: "#94a3b8",
};

function NavBtn({
  id,
  label,
  icon,
  current,
  onNavigate,
}: {
  id: Page;
  label: string;
  icon: React.ReactNode;
  current: Page;
  onNavigate: (p: Page) => void;
}) {
  const active = current === id;
  const accent = accentMap[id] ?? "#8b5cf6";

  return (
    <button
      aria-current={active ? "page" : undefined}
      onClick={() => onNavigate(id)}
      className="no-drag flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-200 w-full text-left relative overflow-hidden"
      style={
        active
          ? {
              background: `linear-gradient(135deg, ${accent}12, ${accent}08)`,
              border: `1px solid ${accent}28`,
              color: "#ffffff",
              fontWeight: 500,
            }
          : {
              background: "transparent",
              border: "1px solid transparent",
              color: "rgba(255,255,255,0.40)",
            }
      }
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
    IsMoInstalled().then((ok) => {
      setCliStatus(ok ? "ready" : "installing");
    });

    EventsOn("mo:installing", () => setCliStatus("installing"));
    EventsOn("mo:ready", () => setCliStatus("ready"));
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
        background: "linear-gradient(180deg, rgba(139,92,246,0.05) 0%, rgba(99,102,241,0.02) 100%)",
        borderRight: "1px solid rgba(139,92,246,0.09)",
      }}
    >
      {/* App brand */}
      <div className="no-drag px-3 pt-3 mb-5">
        <div className="flex items-center gap-2">
          <img
            src={logoSvg}
            alt="MacMole"
            className="w-8 h-8 rounded-xl flex-shrink-0"
            style={{ imageRendering: "auto" }}
          />
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-white leading-none">
              Mac Mole
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "rgba(139,92,246,0.7)" }}>
              Mac Cleaner
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto">
        {/* Top-level: Dashboard only */}
        {nav.filter(n => !n.group && n.id !== "settings").map(({ id, label, icon }) => (
          <NavBtn key={id} id={id} label={label} icon={icon} current={current} onNavigate={onNavigate} />
        ))}

        {(["Clean", "Manage", "Monitor"] as const).map(groupName => (
          <div key={groupName}>
            <p className="text-xs uppercase tracking-wider px-3 pt-4 pb-1.5"
               style={{ color: "rgba(255,255,255,0.40)", letterSpacing: "0.08em" }}>
              {groupName}
            </p>
            {nav.filter(n => n.group === groupName).map(({ id, label, icon }) => (
              <NavBtn key={id} id={id} label={label} icon={icon} current={current} onNavigate={onNavigate} />
            ))}
          </div>
        ))}

        <div className="flex-1" />
        {nav.filter(n => n.id === "settings").map(({ id, label, icon }) => (
          <NavBtn key={id} id={id} label={label} icon={icon} current={current} onNavigate={onNavigate} />
        ))}
      </nav>

      {/* CLI status */}
      <div className="no-drag px-3 pt-2 flex flex-col gap-1.5">
        {cliStatus === "installing" && (
          <div
            className="flex items-center gap-1.5 text-xs"
            style={{ color: "rgba(251,191,36,0.8)" }}
          >
            <Loader2 size={11} className="animate-spin" />
            Installing CLI...
          </div>
        )}
        {cliStatus === "ready" && (
          <div
            className="flex items-center gap-1.5 text-xs"
            style={{ color: "rgba(52,211,153,0.65)" }}
          >
            <CheckCircle2 size={11} />
            Mole CLI ready
          </div>
        )}
        {cliStatus === "failed" && (
          <div
            className="flex items-center gap-1.5 text-xs"
            style={{ color: "rgba(248,113,113,0.8)" }}
            title={failMsg}
          >
            <AlertCircle size={11} />
            CLI not available
          </div>
        )}
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.18)" }}>
          v0.1.0
        </span>
      </div>
    </aside>
  );
}
