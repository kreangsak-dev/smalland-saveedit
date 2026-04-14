package catalog

import (
	_ "embed"
	"encoding/json"
	"sort"
)

//go:embed pets_fnames.json
var petsFnamesJSON []byte

//go:embed pets_extra.json
var petsExtraJSON []byte

// petClassesCurated — hand-picked labels (emoji). Merge order: pets_fnames.json → pets_extra.json → this slice (later wins).
var petClassesCurated = []PetClass{
	{"/Game/Pawns/Animals/BlueTit_Domesticated/BP_BlueTit_Domesticated.BP_BlueTit_Domesticated_C", "\U0001f426 Blue Tit (Domesticated)"},
	{"/Game/Pawns/Animals/Ants/AntWarrior_Black/BP_AntWarrior_Black.BP_AntWarrior_Black_C", "\U0001f41c Black Ant Warrior"},
	{"/Game/Pawns/Animals/AlbinoScorpion/Companion_Wyrdweaver/BP_Albino_Scorpion_Comp_Wyrdweaver.BP_Albino_Scorpion_Comp_Wyrdweaver_C", "\U0001f982 Albino Scorpion (Wyrdweaver)"},
	{"/Game/Pawns/Animals/Scorpion/BP_Scorpion.BP_Scorpion_C", "\U0001f982 Scorpion"},
	{"/Game/Pawns/Animals/Hornet/BP_Hornet.BP_Hornet_C", "\U0001f41d Black Hornet"},
}

// PetClasses is merged from FNames scan + optional extras + curated. Used by GET /api/pets.
var PetClasses []PetClass

func init() {
	var fromFnames []PetClass
	if err := json.Unmarshal(petsFnamesJSON, &fromFnames); err != nil {
		panic("catalog: pets_fnames.json: " + err.Error())
	}
	var fromExtra []PetClass
	if err := json.Unmarshal(petsExtraJSON, &fromExtra); err != nil {
		panic("catalog: pets_extra.json: " + err.Error())
	}
	by := make(map[string]PetClass, len(fromFnames)+len(fromExtra)+len(petClassesCurated))
	for _, p := range fromFnames {
		by[p.Class] = p
	}
	for _, p := range fromExtra {
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

var (
	PetTraits = []PetTrait{
		{Path: "/Game/Pawns/Common/CharacterTraits/Sturdy/CT_Sturdy.CT_Sturdy", Name: "Sturdy", Category: "Defense"},
		{Path: "/Game/Pawns/Common/CharacterTraits/ThickChitin/CT_ThickChitin.CT_ThickChitin", Name: "Thick Chitin", Category: "Defense"},
		{Path: "/Game/Pawns/Common/CharacterTraits/Bolstered/CT_Bolstered.CT_Bolstered", Name: "Bolstered", Category: "Defense"},
		{Path: "/Game/Pawns/Common/CharacterTraits/LikeASoftPlushie/CT_LikeASoftPlushie.CT_LikeASoftPlushie", Name: "Like A Soft Plushie", Category: "Defense"},
		{Path: "/Game/Pawns/Common/CharacterTraits/TooCuteToDie/CT_TooCuteToDie.CT_TooCuteToDie", Name: "Too Cute To Die", Category: "Defense"},
		{Path: "/Game/Pawns/Common/CharacterTraits/DefensiveTactician/CT_DefensiveTactician.CT_DefensiveTactician", Name: "Defensive Tactician", Category: "Offense"},
		{Path: "/Game/Pawns/Common/CharacterTraits/Territorial/CT_Territorial.CT_Territorial", Name: "Territorial", Category: "Offense"},
		{Path: "/Game/Pawns/Common/CharacterTraits/StinkExplosion/CT_StinkExplosion.CT_StinkExplosion", Name: "Stink Explosion", Category: "Offense"},
		{Path: "/Game/Pawns/Common/CharacterTraits/Metabolism/CT_Metabolism.CT_Metabolism", Name: "Metabolism", Category: "Food"},
		{Path: "/Game/Pawns/Common/CharacterTraits/EnhancedMetabolism/CT_EnhancedMetabolism.CT_EnhancedMetabolism", Name: "Enhanced Metabolism", Category: "Food"},
		{Path: "/Game/Pawns/Common/CharacterTraits/SweetTooth/CT_SweetTooth.CT_SweetTooth", Name: "Sweet Tooth", Category: "Food"},
		{Path: "/Game/Pawns/Common/CharacterTraits/Mycologist/CT_Mycologist.CT_Mycologist", Name: "Mycologist", Category: "Food"},
		{Path: "/Game/Pawns/Common/CharacterTraits/Pollinator/CT_Pollinator.CT_Pollinator", Name: "Pollinator", Category: "Food"},
		{Path: "/Game/Pawns/Common/CharacterTraits/HiddenPouch/CT_HiddenPouch.CT_HiddenPouch", Name: "Hidden Pouch", Category: "Utility"},
		{Path: "/Game/Pawns/Common/CharacterTraits/IncreasedInventory/CT_IncreasedInventory.CT_IncreasedInventory", Name: "Increased Inventory", Category: "Utility"},
		{Path: "/Game/Pawns/Common/CharacterTraits/Excavator/CT_Excavator.CT_Excavator", Name: "Excavator", Category: "Utility"},
		{Path: "/Game/Pawns/Common/CharacterTraits/Scrapbug/CT_Scrapbug.CT_Scrapbug", Name: "Scrapbug", Category: "Utility"},
		{Path: "/Game/Pawns/Common/CharacterTraits/FastLearner/CT_FastLearner.CT_FastLearner", Name: "Fast Learner", Category: "Utility"},
		{Path: "/Game/Pawns/Common/CharacterTraits/HealingAura/CT_HealingAura.CT_HealingAura", Name: "Healing Aura", Category: "Utility"},
		{Path: "/Game/Pawns/Common/CharacterTraits/LoyalToTheEnd/CT_LoyalToTheEnd.CT_LoyalToTheEnd", Name: "Loyal To The End", Category: "Utility"},
		{Path: "/Game/Pawns/Common/CharacterTraits/ImprovedJump/CT_ImprovedJump.CT_ImprovedJump", Name: "Improved Jump", Category: "Utility"},
		{Path: "/Game/Pawns/Common/CharacterTraits/ShareTheLove/CT_ShareTheLove.CT_ShareTheLove", Name: "Share The Love", Category: "Utility"},
		{Path: "/Game/Pawns/Common/CharacterTraits/Bioluminescence/CT_Bioluminescence.CT_Bioluminescence", Name: "Bioluminescence", Category: "Utility"},
		{Path: "/Game/Pawns/Common/CharacterTraits/BondStrength/CT_BondStrength_Weakest.CT_BondStrength_Weakest", Name: "Bond Strength (Weakest)", Category: "Bond"},
		{Path: "/Game/Pawns/Common/CharacterTraits/BondStrength/CT_BondStrength_Weak.CT_BondStrength_Weak", Name: "Bond Strength (Weak)", Category: "Bond"},
		{Path: "/Game/Pawns/Common/CharacterTraits/BondStrength/CT_BondStrength_Medium.CT_BondStrength_Medium", Name: "Bond Strength (Medium)", Category: "Bond"},
		{Path: "/Game/Pawns/Common/CharacterTraits/BondStrength/CT_BondStrength_Strong.CT_BondStrength_Strong", Name: "Bond Strength (Strong)", Category: "Bond"},
		{Path: "/Game/Pawns/Common/CharacterTraits/BondStrength/CT_BondStrength_Strongest.CT_BondStrength_Strongest", Name: "Bond Strength (Strongest)", Category: "Bond"},
	}

	// IncreasedInventoryTraitPath is required to add items to companion inventory.
	IncreasedInventoryTraitPath = "/Game/Pawns/Common/CharacterTraits/IncreasedInventory/CT_IncreasedInventory.CT_IncreasedInventory"

	// DefaultNewPetTraitPaths — default rows when creating a companion in the editor.
	DefaultNewPetTraitPaths = []string{
		"/Game/Pawns/Common/CharacterTraits/HealingAura/CT_HealingAura.CT_HealingAura",
		"/Game/Pawns/Common/CharacterTraits/LoyalToTheEnd/CT_LoyalToTheEnd.CT_LoyalToTheEnd",
		"/Game/Pawns/Common/CharacterTraits/BondStrength/CT_BondStrength_Strongest.CT_BondStrength_Strongest",
		IncreasedInventoryTraitPath,
	}
)

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
