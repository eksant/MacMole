import { useState, useEffect } from "react";
import { ShieldCheck, FolderOpen, HardDrive, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OpenPrivacySettings } from "../../wailsjs/go/main/SettingsService";

const DISMISSED_KEY = "macmole_perms_dismissed";

export function usePermissionsGuide() {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(DISMISSED_KEY)) {
      // Slight delay so the app finishes loading before showing the modal
      const timer = setTimeout(() => setShowModal(true), 1200);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setShowModal(false);
  };

  return { showModal, dismiss };
}

interface PermissionsModalProps {
  onClose: () => void;
}

export function PermissionsModal({ onClose }: PermissionsModalProps) {
  const { t } = useTranslation("settings");

  const handleOpen = () => {
    void OpenPrivacySettings();
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
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-white/30 hover:text-white/70 transition-colors"
        >
          <X size={14} />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.25), rgba(99,102,241,0.15))", border: "1px solid rgba(139,92,246,0.2)" }}
          >
            <ShieldCheck size={26} style={{ color: "#a78bfa" }} />
          </div>
        </div>

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
            onClick={onClose}
            className="w-full rounded-xl py-2 text-xs text-white/35 hover:text-white/60 transition-colors"
          >
            {t("privacy.modal_done")}
          </button>
        </div>
      </div>
    </div>
  );
}
