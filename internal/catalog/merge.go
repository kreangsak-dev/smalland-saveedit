package catalog

import (
	_ "embed"
	"encoding/json"
	"sort"
)

//go:embed items_fnames.json
var itemsFnamesJSON []byte

// AllItems is fnames bulk merged with curated Items (Items wins on duplicate Class).
var AllItems []ItemDef

func init() {
	byClass := make(map[string]ItemDef)
	var fnames []ItemDef
	if err := json.Unmarshal(itemsFnamesJSON, &fnames); err != nil {
		panic("catalog: items_fnames.json: " + err.Error())
	}
	for _, it := range fnames {
		byClass[it.Class] = it
	}
	for _, it := range Items {
		byClass[it.Class] = it
	}
	AllItems = make([]ItemDef, 0, len(byClass))
	for _, it := range byClass {
		AllItems = append(AllItems, it)
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
