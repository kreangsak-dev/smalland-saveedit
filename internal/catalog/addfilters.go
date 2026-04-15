package catalog

import (
	_ "embed"
	"encoding/json"
)

// AddItemFilter is a curated add-item sidebar tab (beyond category).
type AddItemFilter struct {
	Key     string   `json:"key"`
	Label   string   `json:"label"`
	Classes []string `json:"classes"`
}

//go:embed addfilters.json
var addFiltersJSON []byte

var AddItemFilters []AddItemFilter

func init() {
	if err := json.Unmarshal(addFiltersJSON, &AddItemFilters); err != nil {
		panic("catalog: addfilters.json: " + err.Error())
	}
}
