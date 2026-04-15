package catalog

import (
	_ "embed"
	"encoding/json"
	"sort"
)

//go:embed items_catalog.json
var itemsCatalogJSON []byte

// AllItems is the static item list for GET /api/items (edit internal/catalog/items_catalog.json).
var AllItems []ItemDef

func init() {
	if err := json.Unmarshal(itemsCatalogJSON, &AllItems); err != nil {
		panic("catalog: items_catalog.json: " + err.Error())
	}
	sort.Slice(AllItems, func(i, j int) bool {
		if AllItems[i].Category != AllItems[j].Category {
			return AllItems[i].Category < AllItems[j].Category
		}
		if AllItems[i].Name != AllItems[j].Name {
			return AllItems[i].Name < AllItems[j].Name
		}
		return AllItems[i].Class < AllItems[j].Class
	})
}

// ItemsAPIResponse is GET /api/items.
type ItemsAPIResponse struct {
	Items      []ItemDef       `json:"items"`
	AddFilters []AddItemFilter `json:"addFilters"`
}

func ItemsAPIPayload() ItemsAPIResponse {
	return ItemsAPIResponse{Items: AllItems, AddFilters: AddItemFilters}
}
