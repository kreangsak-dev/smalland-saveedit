package routes

import (
	"fmt"
	"log"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"smalland/internal/catalog"
	"smalland/internal/config"
	"smalland/internal/plr"

	"github.com/gofiber/fiber/v3"
)

// SaveFileInfo is one row for GET /api/saves.
type SaveFileInfo struct {
	Name       string `json:"name"`
	Size       int64  `json:"size"`
	ModifiedAt string `json:"modifiedAt"`
	HasBackup  bool   `json:"hasBackup"`
}

// Mount registers all HTTP routes on app. sm is from config.ResolveSaveMount().
func Mount(app *fiber.App, sm config.SaveMount) {
	saveDir := sm.Dir
	app.Get("/api/health", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{"ok": true})
	})

	app.Get("/api/config", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"serverSaveAvailable":   saveDir != "",
			"saveDirectory":         saveDir,
			"saveDirectorySource":   sm.Source,
		})
	})

	app.Post("/api/unpack", func(c fiber.Ctx) error {
		data := c.Body()
		if len(data) == 0 {
			return c.Status(400).JSON(fiber.Map{"error": "Empty body"})
		}
		if len(data) > plr.MaxUploadBytes {
			return c.Status(413).JSON(fiber.Map{"error": fmt.Sprintf("File too large (max %d bytes)", plr.MaxUploadBytes)})
		}
		if fn := strings.TrimSpace(c.Get("X-Plr-Filename")); fn != "" {
			if !strings.HasSuffix(strings.ToLower(fn), ".plr") {
				return c.Status(400).JSON(fiber.Map{"error": "Only .plr files are allowed"})
			}
		}
		wrapped, err := plr.Unpack(data)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(wrapped)
	})

	app.Post("/api/repack", func(c fiber.Ctx) error {
		var wrapped plr.WrappedSave
		if err := c.Bind().JSON(&wrapped); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid JSON: " + err.Error()})
		}
		packed, err := plr.Repack(&wrapped)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Repack failed: " + err.Error()})
		}
		dl := c.Query("name", "save.plr")
		if !strings.HasSuffix(strings.ToLower(dl), ".plr") {
			dl = dl + ".plr"
		}
		c.Set("Content-Type", "application/octet-stream")
		c.Set("Content-Disposition", "attachment; filename=\""+dl+"\"")
		return c.Send(packed)
	})

	app.Get("/api/saves", func(c fiber.Ctx) error {
		if saveDir == "" {
			return c.JSON([]SaveFileInfo{})
		}
		entries, err := os.ReadDir(saveDir)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Cannot read save directory: " + err.Error()})
		}

		var files []SaveFileInfo
		for _, e := range entries {
			if e.IsDir() || !strings.HasSuffix(strings.ToLower(e.Name()), ".plr") {
				continue
			}
			info, err := e.Info()
			if err != nil {
				continue
			}
			backupPath := filepath.Join(saveDir, e.Name()+".backup")
			_, hasBackup := os.Stat(backupPath)
			files = append(files, SaveFileInfo{
				Name:       e.Name(),
				Size:       info.Size(),
				ModifiedAt: info.ModTime().Format(time.RFC3339),
				HasBackup:  hasBackup == nil,
			})
		}
		sort.Slice(files, func(i, j int) bool {
			return files[i].ModifiedAt > files[j].ModifiedAt
		})
		return c.JSON(files)
	})

	app.Get("/api/saves/:name", func(c fiber.Ctx) error {
		if saveDir == "" {
			return c.Status(503).JSON(fiber.Map{"error": "Server save folder not configured. Upload a .plr from your PC instead."})
		}
		name, _ := url.PathUnescape(c.Params("name"))
		if !strings.HasSuffix(strings.ToLower(name), ".plr") {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid file name"})
		}
		filePath := filepath.Join(saveDir, name)

		absPath, _ := filepath.Abs(filePath)
		absSaveDir, _ := filepath.Abs(saveDir)
		if !strings.HasPrefix(absPath, absSaveDir) {
			return c.Status(403).JSON(fiber.Map{"error": "Access denied"})
		}

		data, err := os.ReadFile(filePath)
		if err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "File not found: " + err.Error()})
		}

		wrapped, err := plr.Unpack(data)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Unpack failed: " + err.Error()})
		}

		return c.JSON(wrapped)
	})

	app.Put("/api/saves/:name", func(c fiber.Ctx) error {
		if saveDir == "" {
			return c.Status(503).JSON(fiber.Map{"error": "Server save folder not configured. Use Download .plr to save changes locally."})
		}
		name, _ := url.PathUnescape(c.Params("name"))
		if !strings.HasSuffix(strings.ToLower(name), ".plr") {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid file name"})
		}
		filePath := filepath.Join(saveDir, name)

		absPath, _ := filepath.Abs(filePath)
		absSaveDir, _ := filepath.Abs(saveDir)
		if !strings.HasPrefix(absPath, absSaveDir) {
			return c.Status(403).JSON(fiber.Map{"error": "Access denied"})
		}

		var wrapped plr.WrappedSave
		if err := c.Bind().JSON(&wrapped); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid JSON: " + err.Error()})
		}

		if _, err := os.Stat(filePath); err == nil {
			backupPath := filePath + ".backup"
			if _, err := os.Stat(backupPath); os.IsNotExist(err) {
				original, readErr := os.ReadFile(filePath)
				if readErr == nil {
					os.WriteFile(backupPath, original, 0644)
					log.Printf("Backup created: %s", backupPath)
				}
			}
		}

		packed, err := plr.Repack(&wrapped)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Repack failed: " + err.Error()})
		}

		if err := os.WriteFile(filePath, packed, 0644); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Write failed: " + err.Error()})
		}

		log.Printf("Save written: %s (%d bytes)", filePath, len(packed))
		return c.JSON(fiber.Map{"ok": true, "size": len(packed)})
	})

	app.Post("/api/saves/:name/backup", func(c fiber.Ctx) error {
		if saveDir == "" {
			return c.Status(503).JSON(fiber.Map{"error": "Server save folder not configured."})
		}
		name, _ := url.PathUnescape(c.Params("name"))
		filePath := filepath.Join(saveDir, name)
		absPath, _ := filepath.Abs(filePath)
		absSaveDir, _ := filepath.Abs(saveDir)
		if !strings.HasPrefix(absPath, absSaveDir) {
			return c.Status(403).JSON(fiber.Map{"error": "Access denied"})
		}

		data, err := os.ReadFile(filePath)
		if err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "File not found"})
		}

		backupName := fmt.Sprintf("%s.backup_%s", name, time.Now().Format("20060102_150405"))
		backupPath := filepath.Join(saveDir, backupName)
		if err := os.WriteFile(backupPath, data, 0644); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Backup failed: " + err.Error()})
		}

		return c.JSON(fiber.Map{"ok": true, "backup": backupName})
	})

	app.Post("/api/saves/:name/restore", func(c fiber.Ctx) error {
		if saveDir == "" {
			return c.Status(503).JSON(fiber.Map{"error": "Server save folder not configured."})
		}
		name, _ := url.PathUnescape(c.Params("name"))
		filePath := filepath.Join(saveDir, name)
		backupPath := filePath + ".backup"

		absPath, _ := filepath.Abs(filePath)
		absSaveDir, _ := filepath.Abs(saveDir)
		if !strings.HasPrefix(absPath, absSaveDir) {
			return c.Status(403).JSON(fiber.Map{"error": "Access denied"})
		}

		data, err := os.ReadFile(backupPath)
		if err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "No backup found"})
		}

		if err := os.WriteFile(filePath, data, 0644); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Restore failed: " + err.Error()})
		}

		return c.JSON(fiber.Map{"ok": true})
	})

	app.Get("/api/items", func(c fiber.Ctx) error {
		c.Set("Cache-Control", "no-store")
		return c.JSON(catalog.ItemsAPIPayload())
	})

	app.Get("/api/pets", func(c fiber.Ctx) error {
		c.Set("Cache-Control", "no-store")
		return c.JSON(catalog.PetsAPIPayload())
	})
}
