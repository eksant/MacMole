package main

import (
	"context"
	"fmt"
	"time"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/host"
	"github.com/shirou/gopsutil/v4/mem"
	"github.com/shirou/gopsutil/v4/net"
)

// MetricsService exposes system metrics to the frontend.
type MetricsService struct {
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

type SystemMetrics struct {
	CPU     CPUMetrics     `json:"cpu"`
	Memory  MemoryMetrics  `json:"memory"`
	Disk    DiskMetrics    `json:"disk"`
	Network NetworkMetrics `json:"network"`
	Host    HostInfo       `json:"host"`
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
		Memory:  memMetrics,
		Disk:    diskMetrics,
		Network: netMetrics,
		Host:    hostInfo,
	}
}

// FormatUptime converts seconds to human-readable uptime string.
func (m *MetricsService) FormatUptime(seconds uint64) string {
	d := seconds / 86400
	h := (seconds % 86400) / 3600
	min := (seconds % 3600) / 60
	if d > 0 {
		return fmt.Sprintf("%dd %dh %dm", d, h, min)
	}
	if h > 0 {
		return fmt.Sprintf("%dh %dm", h, min)
	}
	return fmt.Sprintf("%dm", min)
}
