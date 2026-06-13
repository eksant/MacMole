import { useState, useEffect, useRef } from "react";
import { ShieldCheck, FolderOpen, HardDrive, X, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  HasFullDiskAccess,
  OpenPrivacySettings,
} from "../../wailsjs/go/main/SettingsService";

const DISMISSED_KEY = "macmole_perms_dismissed";

export function usePermissionsGuide() {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Never show if permanently dismissed
    if (localStorage.getItem(DISMISSED_KEY)) return;

    HasFullDiskAccess()
      .then((granted) => {
        if (!granted) {
          const timer = setTimeout(() => setShowModal(true), 1200);
          return () => clearTimeout(timer);
        }
        return undefined;
      })
      .catch(() => {
        // If check fails, show modal as a safe fallback
        const timer = setTimeout(() => setShowModal(true), 1200);
        return () => clearTimeout(timer);
      });
  }, []);

  const dismissTemporary = () => setShowModal(false);

  const dismissPermanent = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setShowModal(false);
  };

  return { showModal, dismissTemporary, dismissPermanent };
}

interface PermissionsModalProps {
  onDismissTemporary: () => void;
  onDismissPermanent: () => void;
}

export function PermissionsModal({
  onDismissTemporary,
  onDismissPermanent,
}: PermissionsModalProps) {
  const { t } = useTranslation("settings");
  const [granted, setGranted] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopPolling();
  }, []);

  const handleOpen = () => {
    void OpenPrivacySettings();
    // Start polling every 2s to detect when FDA is granted
    pollRef.current = setInterval(() => {
      HasFullDiskAccess()
        .then((ok) => {
          if (ok) {
            stopPolling();
            setGranted(true);
            // Auto-close after 1.5s to show the success state briefly
            setTimeout(() => onDismissPermanent(), 1500);
          }
        })
        .catch(stopPolling);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="relative w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{
          background: "linear-gradient(160deg, #1a1730 0%, #12101f 100%)",
          border: "1px solid rgba(139,92,246,0.18)",
        }}
      >
        {/* Close (temporary) */}
        <button
          onClick={onDismissTemporary}
          className="absolute right-4 top-4 rounded-lg p-1 text-white/30 hover:text-white/70 transition-colors"
        >
          <X size={14} />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500"
            style={
              granted
                ? { background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.3)" }
                : { background: "linear-gradient(135deg, rgba(139,92,246,0.25), rgba(99,102,241,0.15))", border: "1px solid rgba(139,92,246,0.2)" }
            }
          >
            {granted ? (
              <CheckCircle2 size={26} style={{ color: "#34d399" }} />
            ) : (
              <ShieldCheck size={26} style={{ color: "#a78bfa" }} />
            )}
          </div>
        </div>

        {granted ? (
          <p className="text-sm font-semibold text-emerald-400 text-center">
            {t("privacy.modal_granted")}
          </p>
        ) : (
          <>
            {/* Title + body */}
            <h2 className="text-base font-semibold text-white text-center mb-1">
              {t("privacy.modal_title")}
            </h2>
            <p className="text-xs text-white/50 text-center leading-relaxed mb-5">
              {t("privacy.modal_body")}
            </p>

            {/* Options */}
            <div className="flex flex-col gap-2 mb-4">
              <div
                className="flex items-start gap-3 rounded-xl p-3"
                style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.15)" }}
              >
                <HardDrive size={15} className="mt-0.5 flex-shrink-0" style={{ color: "#a78bfa" }} />
                <div>
                  <p className="text-xs font-semibold text-white/90">{t("privacy.fda_label")}</p>
                  <p className="text-xs text-white/45 leading-relaxed mt-0.5">{t("privacy.fda_desc")}</p>
                </div>
              </div>

              <div
                className="flex items-start gap-3 rounded-xl p-3"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <FolderOpen size={15} className="mt-0.5 flex-shrink-0" style={{ color: "#60a5fa" }} />
                <div>
                  <p className="text-xs font-semibold text-white/70">{t("privacy.files_label")}</p>
                  <p className="text-xs text-white/35 leading-relaxed mt-0.5">{t("privacy.files_desc")}</p>
                </div>
              </div>
            </div>

            {/* Tip */}
            <p className="text-xs text-amber-400/70 text-center mb-5">
              💡 {t("privacy.modal_tip")}
            </p>

            {/* Buttons */}
            <div className="flex flex-col gap-2">
              <button
                onClick={handleOpen}
                className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-all"
                style={{
                  background: "linear-gradient(135deg, rgba(139,92,246,0.85), rgba(99,102,241,0.85))",
                  boxShadow: "0 4px 16px rgba(139,92,246,0.22)",
                }}
              >
                {t("privacy.modal_open")} →
              </button>
              <button
                onClick={onDismissTemporary}
                className="w-full rounded-xl py-2 text-xs text-white/35 hover:text-white/60 transition-colors"
              >
                {t("privacy.modal_later")}
              </button>
              <button
                onClick={onDismissPermanent}
                className="w-full rounded-xl py-1.5 text-xs text-white/20 hover:text-white/40 transition-colors"
              >
                {t("privacy.modal_dismiss")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
