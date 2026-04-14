package catalog

// AddItemFilter is a curated add-item sidebar tab (beyond category).
type AddItemFilter struct {
	Key     string   `json:"key"`
	Label   string   `json:"label"`
	Classes []string `json:"classes"`
}

// AddItemFilters matches former frontend filter modules (class lists only on server).
var AddItemFilters = []AddItemFilter{
	{
		Key:   "__crystallized_gear_wings__",
		Label: "Cryst. sets + Wings",
		Classes: []string{
			"/Game/Items/Gear/Wings/Eadricarus/BPI_EadricusGlidingWings.BPI_EadricusGlidingWings_C",
			"/Game/Items/ArmorSets/RodentSet/Helmet/Crystallized/BPI_RodentSet_HelmetCrystalized_Winter.BPI_RodentSet_HelmetCrystalized_Winter_C",
			"/Game/Items/ArmorSets/RodentSet/Legs/Crystallized/BPI_RodentSet_LegsCrystallized_Winter.BPI_RodentSet_LegsCrystallized_Winter_C",
			"/Game/Items/ArmorSets/RodentSet/Torso/Crystallized/BPI_RodentSet_TorsoCrystallized_Winter.BPI_RodentSet_TorsoCrystallized_Winter_C",
			"/Game/Items/ArmorSets/RodentSet/Arms/Crystallized/BPI_RodentSet_ArmsCrystalized_Winter.BPI_RodentSet_ArmsCrystalized_Winter_C",
			"/Game/Items/ArmorSets/RodentSet2/Helmet/Crystallized/BPI_WhiteRodentSetCrystallized_Helmet_Winter.BPI_WhiteRodentSetCrystallized_Helmet_Winter_C",
			"/Game/Items/ArmorSets/RodentSet2/Torso/Crystallized/BPI_WhiteRodentSet_TorsoCrystallized_Winter.BPI_WhiteRodentSet_TorsoCrystallized_Winter_C",
			"/Game/Items/ArmorSets/RodentSet2/Arms/Crystallized/BPI_WhiteRodentSet_ArmsCrystallized_Winter.BPI_WhiteRodentSet_ArmsCrystallized_Winter_C",
			"/Game/Items/ArmorSets/RodentSet2/Legs/Crystallized/BPI_WhiteRodentSet_LegsCrystallized_Winter.BPI_WhiteRodentSet_LegsCrystallized_Winter_C",
			"/Game/Items/ArmorSets/BeeArmor2/Helmet/Crystallized/BPI_BeeArmor2_HelmetCrystallized_Spring.BPI_BeeArmor2_HelmetCrystallized_Spring_C",
			"/Game/Items/ArmorSets/BeeArmor2/Torso/Crystallized/BPI_BeeArmor2_TorsoCrystallized_Spring.BPI_BeeArmor2_TorsoCrystallized_Spring_C",
			"/Game/Items/ArmorSets/BeeArmor2/Arms/Crystallized/BPI_BeeArmor2_ArmsCrystallized_Spring.BPI_BeeArmor2_ArmsCrystallized_Spring_C",
			"/Game/Items/ArmorSets/BeeArmor2/Legs/Crystallized/BPI_BeeArmor2_LegsCrystallized_Spring.BPI_BeeArmor2_LegsCrystallized_Spring_C",
			"/Game/Items/ArmorSets/PyriteSet/Helmet/Crystallized/BPI_PyriteSet_HelmetCrystallized_Summer.BPI_PyriteSet_HelmetCrystallized_Summer_C",
			"/Game/Items/ArmorSets/PyriteSet/Torso/Crystallized/BPI_PyriteSet_TorsoCrystallized_Summer.BPI_PyriteSet_TorsoCrystallized_Summer_C",
			"/Game/Items/ArmorSets/PyriteSet/Arms/Crystalized/BPI_PyriteSet_ArmsCrystalized_Summer.BPI_PyriteSet_ArmsCrystalized_Summer_C",
			"/Game/Items/ArmorSets/PyriteSet/Legs/Crystallized/BPI_PyriteSet_LegsCrystalized_Summer.BPI_PyriteSet_LegsCrystalized_Summer_C",
			"/Game/Items/ArmorSets/ScorpiolaminateSet/Helmet/Crystallized/BPI_ScorpiolaminateSet_HelmetCrystallized_Autumn.BPI_ScorpiolaminateSet_HelmetCrystallized_Autumn_C",
			"/Game/Items/ArmorSets/ScorpiolaminateSet/Torso/Crystallized/BPI_ScorpiolaminateSet_TorsoCrystallized_Autumn.BPI_ScorpiolaminateSet_TorsoCrystallized_Autumn_C",
			"/Game/Items/ArmorSets/ScorpiolaminateSet/Arms/Crystallized/BPI_ScorpiolaminateSet_ArmsCrystallized_Autumn.BPI_ScorpiolaminateSet_ArmsCrystallized_Autumn_C",
			"/Game/Items/ArmorSets/ScorpiolaminateSet/Legs/Crystallized/BPI_ScorpiolaminateSet_LegsCrystallized_Autumn.BPI_ScorpiolaminateSet_LegsCrystallized_Autumn_C",
		},
	},
	{
		Key:   "__special_weapons__",
		Label: "Special weapons",
		Classes: []string{
			"/Game/Items/Weapons/TwoHandedSwords/PyriteGreatsword/BPI_PyriteGreatsword.BPI_PyriteGreatsword_C",
			"/Game/Items/Weapons/Spears/StingerLance/BPI_StingerLance.BPI_StingerLance_C",
			"/Game/Items/Staffs/Wyrdweaver/BPI_Staff_Wyrdweaver.BPI_Staff_Wyrdweaver_C",
			"/Game/Items/RangedWeapons/Firearms/HandCannon/BPI_HandCannon.BPI_HandCannon_C",
			"/Game/Items/Projectiles/IronAmmo/BPI_IronAmmo.BPI_IronAmmo_C",
			"/Game/Items/RangedWeapons/Bow/RecurveBow/BPI_RecurveBow.BPI_RecurveBow_C",
			"/Game/Items/RangedWeapons/Bow/CompositeBow/BPI_CompositeBow.BPI_CompositeBow_C",
		},
	},
	{
		Key:   "__ammo_arrows__",
		Label: "Ammo & arrows",
		Classes: []string{
			"/Game/Items/Projectiles/IronAmmo/BPI_IronAmmo.BPI_IronAmmo_C",
			"/Game/Items/Projectiles/PyriteArrow/BPI_PyriteArrow.BPI_PyriteArrow_C",
			"/Game/Items/Projectiles/FireArrow/BPI_FireArrow.BPI_FireArrow_C",
			"/Game/Items/Projectiles/PoisonArrow/BPI_PoisonArrow.BPI_PoisonArrow_C",
			"/Game/Items/Projectiles/LongArrow/BPI_LongArrow.BPI_LongArrow_C",
		},
	},
}
