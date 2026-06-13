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
  ShieldCheck,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { IsLoginItem, SetLoginItem, CheckForUpdate, OpenPrivacySettings } from "../../wailsjs/go/main/SettingsService";
import { requestNotifyPermission } from "../utils/notify";
import type { main } from "../../wailsjs/go/models";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

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
  const { t } = useTranslation("settings");
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
          <SettingsIcon size={20} className="text-white/50" /> {t("title")}
        </h2>
        <p className="text-sm text-white/40 mt-1">{t("description")}</p>
      </div>

      {/* Privacy & Security */}
      <Section title={t("sections.privacy")} icon={<ShieldCheck size={12} />}>
        <div className="py-3 flex flex-col gap-3">
          <p className="text-xs text-white/45 leading-relaxed">{t("privacy.subtitle")}</p>
          <div className="flex flex-col gap-2">
            <div
              className="flex items-start gap-3 rounded-xl p-3"
              style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.15)" }}
            >
              <ShieldCheck size={14} className="mt-0.5 flex-shrink-0" style={{ color: "#a78bfa" }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white/90">{t("privacy.fda_label")}</p>
                <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{t("privacy.fda_desc")}</p>
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="self-start text-xs"
            onClick={() => void OpenPrivacySettings()}
          >
            <ExternalLink size={12} className="mr-1.5" />
            {t("privacy.open_button")}
          </Button>
        </div>
      </Section>

      {/* General */}
      <Section title={t("sections.general")} icon={<SettingsIcon size={12} />}>
        <Row
          label={t("general.launch_at_login")}
          description={t("general.launch_at_login_desc")}
        >
          {loginLoading ? (
            <Loader2 size={14} className="animate-spin text-white/30" />
          ) : (
            <Switch checked={loginItem} onCheckedChange={toggleLoginItem} />
          )}
        </Row>
        <Row label={t("general.appearance")} description={t("general.appearance_desc")}>
          <div className="flex items-center gap-1.5 text-xs text-white/30">
            <Moon size={12} /> {t("general.dark")}
          </div>
        </Row>
      </Section>

      {/* Notifications */}
      <Section title={t("sections.notifications")} icon={<Bell size={12} />}>
        <Row
          label={t("notifications.enable_notifications")}
          description={
            notifPermission === "denied"
              ? t("notifications.notifications_blocked")
              : t("notifications.enable_notifications_desc")
          }
        >
          <Switch
            checked={notifications && notifPermission !== "denied"}
            onCheckedChange={toggleNotifications}
            disabled={notifPermission === "denied"}
          />
        </Row>
        {notifPermission === "denied" && (
          <div className="pb-3 text-xs text-amber-400/70 flex items-center gap-1.5">
            <AlertCircle size={11} />
            {t("notifications.go_to_system_settings")}
          </div>
        )}
      </Section>

      {/* Updates */}
      <Section title={t("sections.updates")} icon={<RefreshCw size={12} />}>
        <Row label={t("updates.current_version")}>
          <span className="text-xs text-white/30 tabular-nums">v0.2.0</span>
        </Row>
        <Row label={t("updates.check_for_update")}>
          <Button variant="ghost" size="sm" onClick={checkUpdate} disabled={updateLoading} className="gap-1.5 text-xs text-white/70">
            {updateLoading ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <RefreshCw size={11} />
            )}
            {updateLoading ? t("updates.checking") : t("updates.check_now")}
          </Button>
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
                  {t("updates.update_available", { version: updateInfo.latest_version })}
                </span>
                <Button variant="ghost" size="sm" className="gap-1 text-xs text-blue-400/70 hover:text-blue-400"
                  onClick={() => window.open?.(updateInfo.release_url)}>
                  {t("updates.download")} <ExternalLink size={10} />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400/70">
                <CheckCircle2 size={11} /> {t("updates.up_to_date")}
              </div>
            )}
          </div>
        )}
      </Section>

      {/* About */}
      <Section title={t("sections.about")} icon={<Info size={12} />}>
        <Row label={t("about.built_with")}>
          <span className="text-xs text-white/30">{t("about.built_with_value")}</span>
        </Row>
        <Row label={t("about.mole_cli")}>
          <span className="text-xs text-emerald-400/70 font-mono">{t("about.mole_cli_value")}</span>
        </Row>
        <Row label={t("about.source_code")}>
          <Button variant="ghost" size="sm" className="gap-1 text-xs text-blue-400/70 hover:text-blue-400"
            onClick={() => window.open?.("https://github.com/fishwww-ww/MacMole")}>
            {t("about.github")} <ExternalLink size={10} />
          </Button>
        </Row>
        <Row label={t("about.report_issue")}>
          <Button variant="ghost" size="sm" className="gap-1 text-xs text-blue-400/70 hover:text-blue-400"
            onClick={() => window.open?.("https://github.com/fishwww-ww/MacMole/issues")}>
            {t("about.open_issue")} <ExternalLink size={10} />
          </Button>
        </Row>
      </Section>

      <div className="flex items-start gap-2 text-xs text-white/20 mt-1">
        <Info size={11} className="mt-0.5 flex-shrink-0" />
        <span>{t("footer")}</span>
      </div>
    </div>
  );
}
