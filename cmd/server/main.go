package main

import (
	"log"
	"os"

	"smalland/internal/config"
	"smalland/internal/routes"

	"github.com/gofiber/fiber/v3"
)

func main() {
	sm := config.ResolveSaveMount()
	if sm.Dir != "" {
		log.Printf("Save directory (%s): %s", sm.Source, sm.Dir)
		if _, err := os.Stat(sm.Dir); os.IsNotExist(err) {
			log.Printf("Warning: save directory does not exist: %s", sm.Dir)
		}
	} else {
		log.Printf("Upload-only mode (%s). Set SMALLAND_SAVE_DIR to a folder, or on Windows omit SMALLAND_UPLOAD_ONLY to use %%LOCALAPPDATA%%\\SMALLAND\\Saved\\SaveGames\\Players.", sm.Source)
	}

	app := fiber.New(fiber.Config{
		AppName:   "Smalland Save Editor",
		BodyLimit: 50 * 1024 * 1024, // 50MB
	})

	// allowOrigins := corsAllowOrigins()
	// log.Printf("CORS AllowOrigins: %v", allowOrigins)
	// app.Use(cors.New(cors.Config{
	// 	AllowOrigins: allowOrigins,
	// 	AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
	// 	AllowHeaders: []string{"Content-Type", "Accept"},
	// }))

	routes.Mount(app, sm)

	// app.Use("/", static.New("./web/dist", static.Config{
	// 	Browse: false,
	// }))
	// app.Get("/*", func(c fiber.Ctx) error {
	// 	return c.SendFile("./web/dist/index.html")
	// })

	log.Println("Server starting on http://localhost:3000")
	log.Fatal(app.Listen(":3000"))
}
