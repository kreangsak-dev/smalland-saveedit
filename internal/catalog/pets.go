package catalog

import (
	_ "embed"
	"encoding/json"
	"sort"
)

//go:embed pets_catalog.json
var petsCatalogJSON []byte

//go:embed pets_curated.json
var petsCuratedJSON []byte

//go:embed pet_traits.json
var petTraitsJSON []byte

// PetTraits, IncreasedInventoryTraitPath, DefaultNewPetTraitPaths — loaded from pet_traits.json in init.
var (
	PetTraits                   []PetTrait
	IncreasedInventoryTraitPath string
	DefaultNewPetTraitPaths     []string
)

// PetClasses is merged from pets_catalog.json → pets_curated.json (later wins on class). Used by GET /api/pets.
var PetClasses []PetClass

func init() {
	var ptf struct {
		Traits                      []PetTrait `json:"traits"`
		IncreasedInventoryTraitPath string     `json:"increasedInventoryTraitPath"`
		DefaultNewPetTraitPaths     []string   `json:"defaultNewPetTraitPaths"`
	}
	if err := json.Unmarshal(petTraitsJSON, &ptf); err != nil {
		panic("catalog: pet_traits.json: " + err.Error())
	}
	PetTraits = ptf.Traits
	IncreasedInventoryTraitPath = ptf.IncreasedInventoryTraitPath
	DefaultNewPetTraitPaths = ptf.DefaultNewPetTraitPaths

	var fromCatalog []PetClass
	if err := json.Unmarshal(petsCatalogJSON, &fromCatalog); err != nil {
		panic("catalog: pets_catalog.json: " + err.Error())
	}
	var fromCurated []PetClass
	if err := json.Unmarshal(petsCuratedJSON, &fromCurated); err != nil {
		panic("catalog: pets_curated.json: " + err.Error())
	}
	by := make(map[string]PetClass, len(fromCatalog)+len(fromCurated))
	for _, p := range fromCatalog {
		by[p.Class] = p
	}
	for _, p := range fromCurated {
		by[p.Class] = p
	}
	PetClasses = make([]PetClass, 0, len(by))
	for _, p := range by {
		PetClasses = append(PetClasses, p)
	}
	sort.Slice(PetClasses, func(i, j int) bool {
		if PetClasses[i].Name != PetClasses[j].Name {
			return PetClasses[i].Name < PetClasses[j].Name
		}
		return PetClasses[i].Class < PetClasses[j].Class
	})
}

// PetsAPIResponse is GET /api/pets.
type PetsAPIResponse struct {
	Classes                     []PetClass `json:"classes"`
	Traits                      []PetTrait `json:"traits"`
	IncreasedInventoryTraitPath string     `json:"increasedInventoryTraitPath"`
	BondTraitCategory           string     `json:"bondTraitCategory"`
	BondStrengthPaths           []string   `json:"bondStrengthPaths"`
	DefaultNewPetTraitPaths     []string   `json:"defaultNewPetTraitPaths"`
}

// PetsAPIPayload builds the JSON for GET /api/pets.
func PetsAPIPayload() PetsAPIResponse {
	var bond []string
	for _, t := range PetTraits {
		if t.Category == "Bond" {
			bond = append(bond, t.Path)
		}
	}
	return PetsAPIResponse{
		Classes:                     PetClasses,
		Traits:                      PetTraits,
		IncreasedInventoryTraitPath: IncreasedInventoryTraitPath,
		BondTraitCategory:           "Bond",
		BondStrengthPaths:           bond,
		DefaultNewPetTraitPaths:     DefaultNewPetTraitPaths,
	}
}
