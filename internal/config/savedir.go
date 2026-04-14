package config

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

// SaveMount is the resolved on-disk folder for .plr listing and Save-to-disk.
// Dir empty means upload/download-only mode.
type SaveMount struct {
	Dir    string
	Source string // "upload_only" | "env" | "windows_default"
}

func truthyEnv(key string) bool {
	s := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
	return s == "1" || s == "true" || s == "yes" || s == "on"
}

func absDir(dir string) string {
	if dir == "" {
		return ""
	}
	if abs, err := filepath.Abs(dir); err == nil {
		return abs
	}
	return filepath.Clean(dir)
}

// ResolveSaveMount picks the folder for GET/PUT /api/saves.
//
// Order:
//  1. SMALLAND_UPLOAD_ONLY (truthy) → upload-only (Dir empty). Use on production Windows hosts.
//  2. SMALLAND_SAVE_DIR set → that folder (absolute).
//  3. Windows + LOCALAPPDATA → %LOCALAPPDATA%\SMALLAND\Saved\SaveGames\Players
//  4. Otherwise → upload-only.
func ResolveSaveMount() SaveMount {
	if truthyEnv("SMALLAND_UPLOAD_ONLY") {
		return SaveMount{Source: "upload_only"}
	}
	if v := strings.TrimSpace(os.Getenv("SMALLAND_SAVE_DIR")); v != "" {
		return SaveMount{Dir: absDir(filepath.Clean(v)), Source: "env"}
	}
	if runtime.GOOS != "windows" {
		return SaveMount{Source: "upload_only"}
	}
	local := strings.TrimSpace(os.Getenv("LOCALAPPDATA"))
	if local == "" {
		return SaveMount{Source: "upload_only"}
	}
	dir := filepath.Join(local, "SMALLAND", "Saved", "SaveGames", "Players")
	return SaveMount{Dir: absDir(dir), Source: "windows_default"}
}
