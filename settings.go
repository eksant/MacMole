package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"
)

// SettingsService provides system-level settings for the frontend.
type SettingsService struct{}

func NewSettingsService() *SettingsService {
	return &SettingsService{}
}

// IsLoginItem returns true if Mole is registered as a login item.
func (s *SettingsService) IsLoginItem() bool {
	out, err := exec.Command("osascript", "-e",
		`tell application "System Events" to get the name of every login item`).Output()
	if err != nil {
		return false
	}
	return strings.Contains(strings.ToLower(string(out)), "mole")
}

// SetLoginItem adds or removes Mole from the macOS login items via AppleScript.
func (s *SettingsService) SetLoginItem(enabled bool) bool {
	var script string
	if enabled {
		script = `tell application "System Events" to make login item at end with properties {name:"Mole", path:"/Applications/Mole.app", hidden:false}`
	} else {
		script = `tell application "System Events" to delete login item "Mole"`
	}
	err := exec.Command("osascript", "-e", script).Run() // #nosec G204 — hardcoded AppleScript, no user input
	return err == nil
}

// UpdateInfo holds release metadata from GitHub.
type UpdateInfo struct {
	HasUpdate      bool   `json:"has_update"`
	LatestVersion  string `json:"latest_version"`
	CurrentVersion string `json:"current_version"`
	ReleaseURL     string `json:"release_url"`
}

const currentVersion = "0.2.0"
const githubReleasesAPI = "https://api.github.com/repos/fishwww-ww/MacMole/releases/latest"

// CheckForUpdate fetches the latest GitHub release and compares with the current version.
func (s *SettingsService) CheckForUpdate() UpdateInfo {
	info := UpdateInfo{
		CurrentVersion: currentVersion,
		HasUpdate:      false,
	}

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Get(githubReleasesAPI)
	if err != nil {
		return info
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return info
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	if err != nil {
		return info
	}

	var release struct {
		TagName string `json:"tag_name"`
		HTMLURL string `json:"html_url"`
	}
	if err := json.Unmarshal(body, &release); err != nil {
		return info
	}

	latest := strings.TrimPrefix(release.TagName, "v")
	info.LatestVersion = latest
	info.ReleaseURL = release.HTMLURL
	info.HasUpdate = isNewerVersion(latest, currentVersion)

	return info
}

// HasFullDiskAccess reports whether the app has Full Disk Access by probing the
// system TCC database — a path that requires FDA and does NOT trigger a dialog.
func (s *SettingsService) HasFullDiskAccess() bool {
	f, err := os.Open("/Library/Application Support/com.apple.TCC/TCC.db")
	if err != nil {
		return false
	}
	_ = f.Close()
	return true
}

// OpenPrivacySettings opens System Settings → Privacy & Security → Full Disk Access.
func (s *SettingsService) OpenPrivacySettings() {
	_ = exec.Command("open", "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles").Start() // #nosec G204 — hardcoded URL scheme
}

// isNewerVersion compares semver strings, returns true if a > b.
func isNewerVersion(a, b string) bool {
	pa := parseSemver(a)
	pb := parseSemver(b)
	for i := 0; i < 3; i++ {
		if pa[i] > pb[i] {
			return true
		}
		if pa[i] < pb[i] {
			return false
		}
	}
	return false
}

func parseSemver(v string) [3]int {
	var major, minor, patch int
	_, _ = fmt.Sscanf(v, "%d.%d.%d", &major, &minor, &patch)
	return [3]int{major, minor, patch}
}
