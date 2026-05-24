package main

import (
	"context"
	"fmt"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/host"
	"github.com/shirou/gopsutil/v4/mem"
	"github.com/shirou/gopsutil/v4/net"
)

// MetricsService exposes system metrics to the frontend.
type MetricsService struct {
	mu          sync.RWMutex
	prevNetSent uint64
	prevNetRecv uint64
	prevNetTime time.Time
}

func NewMetricsService() *MetricsService {
	return &MetricsService{}
}

type CPUMetrics struct {
	Usage    float64   `json:"usage"`
	PerCore  []float64 `json:"per_core"`
	NumCores int       `json:"num_cores"`
}

type MemoryMetrics struct {
	Total       uint64  `json:"total"`
	Used        uint64  `json:"used"`
	Available   uint64  `json:"available"`
	UsedPercent float64 `json:"used_percent"`
}

type DiskMetrics struct {
	Path        string  `json:"path"`
	Total       uint64  `json:"total"`
	Used        uint64  `json:"used"`
	Free        uint64  `json:"free"`
	UsedPercent float64 `json:"used_percent"`
}

type NetworkMetrics struct {
	BytesSentPerSec uint64 `json:"bytes_sent_per_sec"`
	BytesRecvPerSec uint64 `json:"bytes_recv_per_sec"`
}

type HostInfo struct {
	Hostname        string `json:"hostname"`
	OS              string `json:"os"`
	Platform        string `json:"platform"`
	PlatformVersion string `json:"platform_version"`
	KernelVersion   string `json:"kernel_version"`
	UptimeSeconds   uint64 `json:"uptime_seconds"`
}

type BatteryInfo struct {
	Percent int    `json:"percent"` // -1 = no battery / not applicable
	Status  string `json:"status"`  // "Charging" | "Discharging" | "Full" | "N/A"
}

type ProcessInfo struct {
	Name   string  `json:"name"`
	CPU    float64 `json:"cpu"`
	Memory float64 `json:"memory"`
}

// WatchedProcess represents a process flagged as high-resource or zombie.
type WatchedProcess struct {
	PID     int32   `json:"pid"`
	Name    string  `json:"name"`
	CPU     float64 `json:"cpu"`
	Memory  float64 `json:"memory"`
	Status  string  `json:"status"` // "zombie" | "high-cpu" | "high-mem"
	Command string  `json:"command"`
}

type SystemMetrics struct {
	CPU          CPUMetrics    `json:"cpu"`
	Memory       MemoryMetrics `json:"memory"`
	Disk         DiskMetrics   `json:"disk"`
	Network      NetworkMetrics `json:"network"`
	Host         HostInfo      `json:"host"`
	Battery      BatteryInfo   `json:"battery"`
	TopProcesses []ProcessInfo `json:"top_processes"`
}

// GetMetrics collects all system metrics and returns them as a single snapshot.
func (m *MetricsService) GetMetrics() SystemMetrics {
	ctx := context.Background()

	// CPU
	cpuPercent, _ := cpu.PercentWithContext(ctx, 0, false)
	cpuPerCore, _ := cpu.PercentWithContext(ctx, 0, true)
	cpuInfo, _ := cpu.InfoWithContext(ctx)
	numCores := len(cpuPerCore)
	if numCores == 0 && len(cpuInfo) > 0 {
		numCores = int(cpuInfo[0].Cores)
	}
	var cpuUsage float64
	if len(cpuPercent) > 0 {
		cpuUsage = cpuPercent[0]
	}

	// Memory
	vmStat, _ := mem.VirtualMemoryWithContext(ctx)
	var memMetrics MemoryMetrics
	if vmStat != nil {
		memMetrics = MemoryMetrics{
			Total:       vmStat.Total,
			Used:        vmStat.Used,
			Available:   vmStat.Available,
			UsedPercent: vmStat.UsedPercent,
		}
	}

	// Disk (main volume)
	diskStat, _ := disk.UsageWithContext(ctx, "/")
	var diskMetrics DiskMetrics
	if diskStat != nil {
		diskMetrics = DiskMetrics{
			Path:        "/",
			Total:       diskStat.Total,
			Used:        diskStat.Used,
			Free:        diskStat.Free,
			UsedPercent: diskStat.UsedPercent,
		}
	}

	// Network (rate calculation)
	var netMetrics NetworkMetrics
	netStats, err := net.IOCountersWithContext(ctx, false)
	if err == nil && len(netStats) > 0 {
		now := time.Now()
		sent := netStats[0].BytesSent
		recv := netStats[0].BytesRecv

		m.mu.Lock()
		if !m.prevNetTime.IsZero() {
			elapsed := now.Sub(m.prevNetTime).Seconds()
			if elapsed > 0 {
				netMetrics.BytesSentPerSec = uint64(float64(sent-m.prevNetSent) / elapsed)
				netMetrics.BytesRecvPerSec = uint64(float64(recv-m.prevNetRecv) / elapsed)
			}
		}
		m.prevNetSent = sent
		m.prevNetRecv = recv
		m.prevNetTime = now
		m.mu.Unlock()
	}

	// Host info
	hostStat, _ := host.InfoWithContext(ctx)
	var hostInfo HostInfo
	if hostStat != nil {
		hostInfo = HostInfo{
			Hostname:        hostStat.Hostname,
			OS:              hostStat.OS,
			Platform:        hostStat.Platform,
			PlatformVersion: hostStat.PlatformVersion,
			KernelVersion:   hostStat.KernelVersion,
			UptimeSeconds:   hostStat.Uptime,
		}
	}

	return SystemMetrics{
		CPU: CPUMetrics{
			Usage:    cpuUsage,
			PerCore:  cpuPerCore,
			NumCores: numCores,
		},
		Memory:       memMetrics,
		Disk:         diskMetrics,
		Network:      netMetrics,
		Host:         hostInfo,
		Battery:      collectBattery(),
		TopProcesses: collectTopProcesses(),
	}
}

// GetWatchedProcesses returns processes that are zombie or consuming excessive resources.
func (m *MetricsService) GetWatchedProcesses() []WatchedProcess {
	out, err := exec.Command("ps", "-Aceo", "pid,pcpu,pmem,stat,comm").Output()
	if err != nil {
		return nil
	}
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	var result []WatchedProcess
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "PID") || line == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 5 {
			continue
		}
		pid, err1 := strconv.ParseInt(fields[0], 10, 32)
		cpuVal, err2 := strconv.ParseFloat(fields[1], 64)
		memVal, err3 := strconv.ParseFloat(fields[2], 64)
		if err1 != nil || err2 != nil || err3 != nil {
			continue
		}
		stat := fields[3]
		name := filepath.Base(fields[4])
		if len(name) > 28 {
			name = name[:28]
		}

		var status string
		switch {
		case strings.Contains(stat, "Z"):
			status = "zombie"
		case cpuVal > 80:
			status = "high-cpu"
		case memVal > 15:
			status = "high-mem"
		default:
			continue
		}

		result = append(result, WatchedProcess{
			PID:     int32(pid),
			Name:    name,
			CPU:     cpuVal,
			Memory:  memVal,
			Status:  status,
			Command: fields[4],
		})
		if len(result) >= 20 {
			break
		}
	}
	return result
}

// collectBattery parses `pmset -g batt` to get current battery status.
// Returns Percent=-1 on desktops or parse errors.
func collectBattery() BatteryInfo {
	out, err := exec.Command("pmset", "-g", "batt").Output()
	if err != nil {
		return BatteryInfo{Percent: -1, Status: "N/A"}
	}
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		// Line looks like: "\t-InternalBattery-0 (id=...)	97%; discharging; 3:42 remaining present: true"
		if !strings.Contains(line, "%") {
			continue
		}
		// Extract percentage
		idx := strings.Index(line, "%")
		if idx <= 0 {
			continue
		}
		start := idx - 1
		for start > 0 && line[start-1] >= '0' && line[start-1] <= '9' {
			start--
		}
		pct, err := strconv.Atoi(strings.TrimSpace(line[start:idx]))
		if err != nil {
			continue
		}
		status := "Discharging"
		lower := strings.ToLower(line)
		switch {
		case strings.Contains(lower, "charging;") || strings.Contains(lower, "ac attached"):
			status = "Charging"
		case strings.Contains(lower, "charged") || strings.Contains(lower, "finishing charge"):
			status = "Full"
		case strings.Contains(lower, "discharging"):
			status = "Discharging"
		}
		return BatteryInfo{Percent: pct, Status: status}
	}
	return BatteryInfo{Percent: -1, Status: "N/A"}
}

// collectTopProcesses returns the top 5 processes by CPU usage.
func collectTopProcesses() []ProcessInfo {
	out, err := exec.Command("ps", "-Aceo", "pcpu,pmem,comm", "-r").Output()
	if err != nil {
		return nil
	}
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	var procs []ProcessInfo
	for _, line := range lines {
		if len(procs) >= 5 {
			break
		}
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "%CPU") || line == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 3 {
			continue
		}
		cpuVal, err1 := strconv.ParseFloat(fields[0], 64)
		memVal, err2 := strconv.ParseFloat(fields[1], 64)
		if err1 != nil || err2 != nil {
			continue
		}
		name := filepath.Base(fields[2])
		if len(name) > 24 {
			name = name[:24]
		}
		procs = append(procs, ProcessInfo{Name: name, CPU: cpuVal, Memory: memVal})
	}
	return procs
}

// FormatUptime converts seconds to human-readable uptime string.
func (m *MetricsService) FormatUptime(seconds uint64) string {
	d := seconds / 86400
	h := (seconds % 86400) / 3600
	mins := (seconds % 3600) / 60
	if d > 0 {
		return fmt.Sprintf("%dd %dh %dm", d, h, mins)
	}
	if h > 0 {
		return fmt.Sprintf("%dh %dm", h, mins)
	}
	return fmt.Sprintf("%dm", mins)
}
