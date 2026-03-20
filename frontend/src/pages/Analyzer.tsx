import { useEffect, useState } from "react";
import { HardDrive, FolderOpen } from "lucide-react";
import { GetDiskAnalysis } from "../../wailsjs/go/main/CommandService";

interface DiskEntry {
  name: string;
  path: string;
  size: number;
  is_dir: boolean;
}

function fmtBytes(bytes: number): string {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + " GB";
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + " MB";
  return (bytes / 1e3).toFixed(0) + " KB";
}

export default function Analyzer() {
  const [entries, setEntries] = useState<DiskEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    GetDiskAnalysis()
      .then(setEntries)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <HardDrive size={20} className="text-emerald-400" /> Disk Analyzer
        </h2>
        <p className="text-sm text-white/40 mt-1">
          Visualize disk usage and find large files.
        </p>
      </div>

      {loading && (
        <div className="text-white/30 text-sm">Scanning...</div>
      )}

      {!loading && (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => (
            <div
              key={entry.path}
              className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-default transition-all"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <FolderOpen size={16} className="text-white/30 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white font-medium">{entry.name}</div>
                <div className="text-xs text-white/30 truncate">{entry.path}</div>
              </div>
              <div className="text-xs text-white/40 tabular-nums">
                {entry.size > 0 ? fmtBytes(entry.size) : "—"}
              </div>
            </div>
          ))}
          <p className="text-xs text-white/20 mt-2 text-center">
            Tip: Run <code className="font-mono">mo analyze</code> in terminal for full interactive disk explorer.
          </p>
        </div>
      )}
    </div>
  );
}
