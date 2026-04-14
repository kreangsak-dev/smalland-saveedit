package catalog

import "strings"

// WikiImageSlug converts an item display name to the wiki.gg File:... slug fragment.
func WikiImageSlug(name string) string {
	slug := strings.ReplaceAll(name, " ", "_")
	slug = strings.ReplaceAll(slug, "(", "%28")
	slug = strings.ReplaceAll(slug, ")", "%29")
	slug = strings.ReplaceAll(slug, "'", "%27")
	return slug
}
