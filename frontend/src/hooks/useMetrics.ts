import { useEffect, useState, useRef } from "react";
import { GetMetrics, GetWatchedProcesses } from "../../wailsjs/go/main/MetricsService";
import type { main } from "../../wailsjs/go/models";

export interface SystemMetrics {
  cpu: { usage: number; per_core: number[]; num_cores: number };
  memory: { total: number; used: number; available: number; used_percent: number };
  disk: { path: string; total: number; used: number; free: number; used_percent: number };
  network: { bytes_sent_per_sec: number; bytes_recv_per_sec: number };
  host: {
    hostname: string;
    os: string;
    platform: string;
    platform_version: string;
    kernel_version: string;
    uptime_seconds: number;
  };
  battery: { percent: number; status: string };
  top_processes: { name: string; cpu: number; memory: number }[];
}

export type WatchedProcess = main.WatchedProcess;

export function useMetrics(intervalMs = 2000) {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = () => {
    GetMetrics().then(setMetrics).catch(console.error);
  };

  useEffect(() => {
    fetch();
    timer.current = setInterval(fetch, intervalMs);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [intervalMs]);

  return metrics;
}

export function useWatchedProcesses(intervalMs = 10000) {
  const [procs, setProcs] = useState<WatchedProcess[]>([]);

  useEffect(() => {
    const fetchProcs = () => {
      GetWatchedProcesses()
        .then(setProcs)
        .catch(() => setProcs([]));
    };
    fetchProcs();
    const t = setInterval(fetchProcs, intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);

  return procs;
}
