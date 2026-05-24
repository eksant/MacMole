import { useState, useEffect } from "react";
import { Clock, Trash2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { GetHistory, ClearHistory } from "../../wailsjs/go/main/HistoryService";
import type { main } from "../../wailsjs/go/models";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function fmtTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}


export default function History() {
  const [entries, setEntries] = useState<main.HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    GetHistory(100)
      .then((e) => setEntries(e ?? []))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load history.");
      })
      .finally(() => setLoading(false));
  };

  const clear = async () => {
    try {
      await ClearHistory();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to clear history.");
      return;
    }
    load();
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="flex flex-col gap-5 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)" }}>
              <Clock size={16} className="text-white" />
            </span>
            Operation History
          </h2>
          <p className="text-sm mt-1.5 ml-10 text-white/40">
            Audit log of all cleanup operations.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={load} disabled={loading}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button variant="ghost" size="icon" onClick={clear} disabled={entries.length === 0} className="text-red-400/70 hover:text-red-400">
            <Trash2 size={13} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-sm"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
          {error}
        </div>
      )}

      {!loading && entries.length === 0 && (
        <p className="text-white/30 text-sm mt-4">No operations recorded yet.</p>
      )}

      <div className="flex flex-col gap-1.5">
        {entries.map(e => {
          return (
            <div key={e.id} className="flex items-start gap-3 px-4 py-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              {e.success
                ? <CheckCircle2 size={15} style={{ color: "#34d399", flexShrink: 0, marginTop: 1 }} />
                : <XCircle size={15} style={{ color: "#f87171", flexShrink: 0, marginTop: 1 }} />
              }
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={
                    e.operation === "clean" ? "success" :
                    e.operation === "optimize" ? "warning" :
                    e.operation === "purge" ? "destructive" :
                    e.operation === "devcache" ? "success" :
                    e.operation === "uninstall" ? "destructive" :
                    "muted"
                  }>
                    {e.operation}
                  </Badge>
                  {e.freed_mb > 0 && (
                    <span className="text-xs text-emerald-400/70">
                      {e.freed_mb.toFixed(1)} MB freed
                    </span>
                  )}
                </div>
                {e.detail && (
                  <p className="text-xs text-white/40 mt-0.5 truncate">{e.detail}</p>
                )}
              </div>
              <span className="text-xs text-white/25 flex-shrink-0 mt-0.5">{fmtTime(e.timestamp)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
