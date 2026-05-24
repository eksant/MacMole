package main

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

// HistoryService persists operation audit logs to SQLite.
type HistoryService struct {
	db *sql.DB
}

// HistoryEntry is one recorded operation.
type HistoryEntry struct {
	ID        int64   `json:"id"`
	Operation string  `json:"operation"` // "clean" | "optimize" | "purge" | "devcache" | "uninstall"
	Success   bool    `json:"success"`
	Detail    string  `json:"detail"`    // e.g. "Removed 23 items. Freed 1.2 GB"
	FreedMB   float64 `json:"freed_mb"`  // 0 if unknown
	Timestamp int64   `json:"timestamp"` // Unix seconds
}

func NewHistoryService() (*HistoryService, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("cannot find home dir: %w", err)
	}
	dir := filepath.Join(home, "Library", "Application Support", "MacMole")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, fmt.Errorf("cannot create app support dir: %w", err)
	}
	dbPath := filepath.Join(dir, "history.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS history (
		id        INTEGER PRIMARY KEY AUTOINCREMENT,
		operation TEXT NOT NULL,
		success   INTEGER NOT NULL,
		detail    TEXT,
		freed_mb  REAL DEFAULT 0,
		ts        INTEGER NOT NULL
	)`)
	if err != nil {
		return nil, err
	}
	return &HistoryService{db: db}, nil
}

// Record adds one entry to the history log.
func (h *HistoryService) Record(operation string, success bool, detail string, freedMB float64) {
	_, _ = h.db.Exec(
		`INSERT INTO history (operation, success, detail, freed_mb, ts) VALUES (?,?,?,?,?)`,
		operation, success, detail, freedMB, time.Now().Unix(),
	)
}

// GetHistory returns the last N entries, newest first.
func (h *HistoryService) GetHistory(limit int) []HistoryEntry {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := h.db.Query(
		`SELECT id, operation, success, detail, freed_mb, ts FROM history ORDER BY ts DESC LIMIT ?`, limit,
	)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var result []HistoryEntry
	for rows.Next() {
		var e HistoryEntry
		var success int
		if err := rows.Scan(&e.ID, &e.Operation, &success, &e.Detail, &e.FreedMB, &e.Timestamp); err != nil {
			continue
		}
		e.Success = success == 1
		result = append(result, e)
	}
	return result
}

// ClearHistory removes all history entries.
func (h *HistoryService) ClearHistory() bool {
	_, err := h.db.Exec(`DELETE FROM history`)
	return err == nil
}
