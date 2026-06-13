import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PermissionsModal, usePermissionsGuide } from "./components/PermissionsGuide";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Cleaner from "./pages/Cleaner";
import Optimizer from "./pages/Optimizer";
import Analyzer from "./pages/Analyzer";
import Purge from "./pages/Purge";
import Installer from "./pages/Installer";
import Uninstall from "./pages/Uninstall";
import Logs from "./pages/Logs";
import NodeModules from "./pages/NodeModules";
import DevCaches from "./pages/DevCaches";
import Processes from "./pages/Processes";
import History from "./pages/History";
import Settings from "./pages/Settings";
import Cleanup from "./pages/Cleanup";

export type Page =
  | "dashboard"
  | "cleaner"
  | "optimizer"
  | "analyzer"
  | "purge"
  | "installer"
  | "uninstall"
  | "logs"
  | "nodemodules"
  | "devcaches"
  | "processes"
  | "history"
  | "settings"
  | "cleanup";

function LangSwitcher() {
  const { i18n } = useTranslation('common')
  const handleLangChange = (lang: string) => {
    void i18n.changeLanguage(lang)
    localStorage.setItem('macmole_lang', lang)
  }
  return (
    <div className="no-drag flex items-center gap-1">
      {(['en', 'id'] as const).map((lang) => (
        <button
          key={lang}
          onClick={() => handleLangChange(lang)}
          className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors ${
            i18n.language === lang
              ? 'bg-white/20 text-white'
              : 'text-white/40 hover:text-white/70'
          }`}
        >
          {lang === 'en' ? '🇺🇸' : '🇮🇩'} {lang.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const { showModal, dismiss } = usePermissionsGuide();

  const renderPage = () => {
    switch (page) {
      case "dashboard":
        return <Dashboard />;
      case "cleaner":
        return <Cleaner />;
      case "optimizer":
        return <Optimizer />;
      case "analyzer":
        return <Analyzer />;
      case "purge":
        return <Purge />;
      case "installer":
        return <Installer />;
      case "uninstall":
        return <Uninstall />;
      case "logs":
        return <Logs />;
      case "nodemodules":
        return <NodeModules />;
      case "devcaches":
        return <DevCaches />;
      case "processes":
        return <Processes />;
      case "history":
        return <History />;
      case "settings":
        return <Settings />;
      case "cleanup":
        return <Cleanup />;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-transparent">
      {/* Traffic-light spacer + drag handle. LangSwitcher sits on the right, outside the drag area. */}
      <div className="drag-region h-10 w-full flex-shrink-0 flex items-center justify-end pr-4">
        <LangSwitcher />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <Sidebar current={page} onNavigate={setPage} />
        <main className="no-drag flex-1 overflow-y-auto px-6 pb-6">{renderPage()}</main>
      </div>
      {showModal && <PermissionsModal onClose={dismiss} />}
    </div>
  );
}
