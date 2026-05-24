package main

import (
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

// ProcessService manages process listing and termination.
type ProcessService struct{}

func NewProcessService() *ProcessService { return &ProcessService{} }

// ProcessDetail has more info than ProcessInfo in metrics.go.
type ProcessDetail struct {
	PID     int     `json:"pid"`
	Name    string  `json:"name"`
	CPU     float64 `json:"cpu"`
	Memory  float64 `json:"memory"`
	Status  string  `json:"status"`  // "zombie" | "high-cpu" | "high-mem"
	Runtime string  `json:"runtime"` // e.g. "2:15:03"
}

// ListFlaggedProcesses returns processes that are zombie or using excessive resources.
func (p *ProcessService) ListFlaggedProcesses() []ProcessDetail {
	out, err := exec.Command("ps", "-Aceo", "pid,pcpu,pmem,stat,time,comm").Output()
	if err != nil {
		return nil
	}
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	var result []ProcessDetail
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "PID") || line == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 6 {
			continue
		}
		pid, err1 := strconv.Atoi(fields[0])
		cpuVal, err2 := strconv.ParseFloat(fields[1], 64)
		memVal, err3 := strconv.ParseFloat(fields[2], 64)
		if err1 != nil || err2 != nil || err3 != nil {
			continue
		}
		stat := fields[3]
		runtime := fields[4]
		command := strings.Join(fields[5:], " ")
		name := command
		if len(name) > 28 {
			name = name[:28]
		}

		var status string
		switch {
		case strings.Contains(stat, "Z"):
			status = "zombie"
		case cpuVal > 50:
			status = "high-cpu"
		case memVal > 10:
			status = "high-mem"
		default:
			continue
		}

		result = append(result, ProcessDetail{
			PID:     pid,
			Name:    name,
			CPU:     cpuVal,
			Memory:  memVal,
			Status:  status,
			Runtime: runtime,
		})
	}
	return result
}

// KillProcessResult describes the outcome of killing one process.
type KillProcessResult struct {
	PID     int    `json:"pid"`
	Name    string `json:"name"`
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// KillProcesses sends SIGTERM to each PID, waits 3 seconds, then SIGKILL if still running.
// PIDs must be > 1 (never kill PID 1 = launchd).
func (p *ProcessService) KillProcesses(pids []int) []KillProcessResult {
	var results []KillProcessResult
	for _, pid := range pids {
		if pid <= 1 {
			results = append(results, KillProcessResult{PID: pid, Message: "refusing to kill PID ≤1"})
			continue
		}
		proc, err := os.FindProcess(pid)
		if err != nil {
			results = append(results, KillProcessResult{PID: pid, Message: "process not found"})
			continue
		}

		// SIGTERM first
		_ = proc.Signal(os.Interrupt)

		// Wait up to 3 seconds for graceful exit
		done := make(chan error, 1)
		go func() {
			_, err := proc.Wait()
			done <- err
		}()

		select {
		case <-done:
			results = append(results, KillProcessResult{PID: pid, Success: true, Message: "terminated gracefully"})
		case <-time.After(3 * time.Second):
			if killErr := proc.Kill(); killErr != nil {
				results = append(results, KillProcessResult{PID: pid, Message: fmt.Sprintf("SIGKILL failed: %v", killErr)})
			} else {
				results = append(results, KillProcessResult{PID: pid, Success: true, Message: "force killed"})
			}
		}
	}
	return results
}
