import { useState, useEffect } from "react";
import {
  Settings as SettingsIcon,
  Bell,
  Moon,
  Info,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { IsLoginItem, SetLoginItem, CheckForUpdate } from "../../wailsjs/go/main/SettingsService";
import { requestNotifyPermission } from "../utils/notify";
import type { main } from "../../wailsjs/go/models";

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200 disabled:opacity-40",
        checked ? "bg-blue-500" : "bg-white/20",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transition-transform duration-200",
          checked ? "translate-x-4" : "translate-x-0.5",
        ].join(" ")}
      />
    </button>
  );
}

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-white/5 last:border-0">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm text-white/80">{label}</span>
        {description && <span className="text-xs text-white/30">{description}</span>}
      </div>
      <div className="flex-shrink-0 ml-4">{children}</div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl px-4 flex flex-col"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="flex items-center gap-2 pt-3 pb-1">
        {icon && <span className="text-white/30">{icon}</span>}
        <p className="text-xs font-semibold text-white/30 uppercase tracking-wider">{title}</p>
      </div>
      {children}
    </div>
  );
}

export default function Settings() {
  const [notifications, setNotifications] = useState(
    () => localStorage.getItem("pref_notifications") !== "false"
  );
  const [loginItem, setLoginItem] = useState(false);
  const [loginLoading, setLoginLoading] = useState(true);
  const [updateInfo, setUpdateInfo] = useState<main.UpdateInfo | null>(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [notifPermission, setNotifPermission] = useState(Notification.permission);

  useEffect(() => {
    IsLoginItem().then((v) => {
      setLoginItem(v);
      setLoginLoading(false);
    });
  }, []);

  const toggleLoginItem = async (val: boolean) => {
    setLoginLoading(true);
    const ok = await SetLoginItem(val);
    if (ok) setLoginItem(val);
    setLoginLoading(false);
  };

  const toggleNotifications = async (val: boolean) => {
    setNotifications(val);
    localStorage.setItem("pref_notifications", String(val));
    if (val) {
      const perm = await requestNotifyPermission();
      setNotifPermission(perm);
    }
  };

  const checkUpdate = async () => {
    setUpdateLoading(true);
    const info = await CheckForUpdate();
    setUpdateInfo(info);
    setUpdateLoading(false);
  };

  return (
    <div className="flex flex-col gap-5 max-w-xl">
      <div>
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <SettingsIcon size={20} className="text-white/50" /> Settings
        </h2>
        <p className="text-sm text-white/40 mt-1">Preferences and app information.</p>
      </div>

      {/* General */}
      <Section title="General" icon={<SettingsIcon size={12} />}>
        <Row
          label="Launch at Login"
          description="Start Mole automatically when you log in to macOS"
        >
          {loginLoading ? (
            <Loader2 size={14} className="animate-spin text-white/30" />
          ) : (
            <Toggle checked={loginItem} onChange={toggleLoginItem} />
          )}
        </Row>
        <Row label="Appearance" description="Dark mode is always active">
          <div className="flex items-center gap-1.5 text-xs text-white/30">
            <Moon size={12} /> Dark
          </div>
        </Row>
      </Section>

      {/* Notifications */}
      <Section title="Notifications" icon={<Bell size={12} />}>
        <Row
          label="Enable Notifications"
          description={
            notifPermission === "denied"
              ? "Blocked in System Settings — enable in macOS Notifications"
              : "Show alert when clean, optimize, or purge finishes"
          }
        >
          <Toggle
            checked={notifications && notifPermission !== "denied"}
            onChange={toggleNotifications}
            disabled={notifPermission === "denied"}
          />
        </Row>
        {notifPermission === "denied" && (
          <div className="pb-3 text-xs text-amber-400/70 flex items-center gap-1.5">
            <AlertCircle size={11} />
            Go to System Settings → Notifications → Mole to enable.
          </div>
        )}
      </Section>

      {/* Updates */}
      <Section title="Updates" icon={<RefreshCw size={12} />}>
        <Row label="Current version">
          <span className="text-xs text-white/30 tabular-nums">v0.1.0</span>
        </Row>
        <Row label="Check for update">
          <button
            onClick={checkUpdate}
            disabled={updateLoading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
            style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}
          >
            {updateLoading ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <RefreshCw size={11} />
            )}
            {updateLoading ? "Checking..." : "Check now"}
          </button>
        </Row>
        {updateInfo && (
          <div className="pb-3">
            {updateInfo.has_update ? (
              <div
                className="flex items-center justify-between rounded-lg px-3 py-2 text-xs"
                style={{
                  background: "rgba(59,130,246,0.12)",
                  border: "1px solid rgba(59,130,246,0.2)",
                }}
              >
                <span className="text-blue-400">
                  Update available: v{updateInfo.latest_version}
                </span>
                <button
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                  onClick={() => window.open?.(updateInfo.release_url)}
                >
                  Download <ExternalLink size={10} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400/70">
                <CheckCircle2 size={11} /> You&apos;re on the latest version.
              </div>
            )}
          </div>
        )}
      </Section>

      {/* About */}
      <Section title="About" icon={<Info size={12} />}>
        <Row label="Built with">
          <span className="text-xs text-white/30">Wails v2 · React · Go</span>
        </Row>
        <Row label="Mole CLI">
          <span className="text-xs text-emerald-400/70 font-mono">brew install mole</span>
        </Row>
        <Row label="Source code">
          <button
            className="flex items-center gap-1 text-xs text-blue-400/70 hover:text-blue-400 transition-colors"
            onClick={() => window.open?.("https://github.com/fishwww-ww/MacMole")}
          >
            GitHub <ExternalLink size={10} />
          </button>
        </Row>
        <Row label="Report an issue">
          <button
            className="flex items-center gap-1 text-xs text-blue-400/70 hover:text-blue-400 transition-colors"
            onClick={() => window.open?.("https://github.com/fishwww-ww/MacMole/issues")}
          >
            Open issue <ExternalLink size={10} />
          </button>
        </Row>
      </Section>

      <div className="flex items-start gap-2 text-xs text-white/20 mt-1">
        <Info size={11} className="mt-0.5 flex-shrink-0" />
        <span>
          Mole runs silently in the menu bar. Close the window to hide it; use the menu-bar icon to
          show it or quit.
        </span>
      </div>
    </div>
  );
}
