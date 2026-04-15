package catalog

import (
	_ "embed"
	"encoding/json"
	"sort"
)

//go:embed pets_catalog.json
var petsCatalogJSON []byte

//go:embed pet_traits.json
var petTraitsJSON []byte

// PetTraits, IncreasedInventoryTraitPath, DefaultNewPetTraitPaths — loaded from pet_traits.json in init.
var (
	PetTraits                     []PetTrait
	IncreasedInventoryTraitPath   string
	DefaultNewPetTraitPaths       []string
)

// petClassesCurated — hand-picked labels (emoji). Merge order: pets_catalog.json → this slice (later wins).
var petClassesCurated = []PetClass{
	{"/Game/Pawns/Animals/BlueTit_Domesticated/BP_BlueTit_Domesticated.BP_BlueTit_Domesticated_C", "\U0001f426 Blue Tit (Domesticated)"},
	{"/Game/Pawns/Animals/Ants/AntWarrior_Black/BP_AntWarrior_Black.BP_AntWarrior_Black_C", "\U0001f41c Black Ant Warrior"},
	{"/Game/Pawns/Animals/AlbinoScorpion/Companion_Wyrdweaver/BP_Albino_Scorpion_Comp_Wyrdweaver.BP_Albino_Scorpion_Comp_Wyrdweaver_C", "\U0001f982 Albino Scorpion (Wyrdweaver)"},
	{"/Game/Pawns/Animals/Scorpion/BP_Scorpion.BP_Scorpion_C", "\U0001f982 Scorpion"},
	{"/Game/Pawns/Animals/Hornet/BP_Hornet.BP_Hornet_C", "\U0001f41d Black Hornet"},
}

// PetClasses is merged from pets_catalog.json + curated. Used by GET /api/pets.
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
	by := make(map[string]PetClass, len(fromCatalog)+len(petClassesCurated))
	for _, p := range fromCatalog {
		by[p.Class] = p
	}
	for _, p := range petClassesCurated {
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
