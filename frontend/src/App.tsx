import { useState } from "react";
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
import Settings from "./pages/Settings";

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
  | "settings";

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");

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
      case "settings":
        return <Settings />;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-transparent">
      {/* Traffic-light spacer + drag handle (h-10 = 40px clears the inset buttons) */}
      <div className="drag-region h-10 w-full flex-shrink-0" />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar current={page} onNavigate={setPage} />
        <main className="no-drag flex-1 overflow-y-auto px-6 pb-6">{renderPage()}</main>
      </div>
    </div>
  );
}
