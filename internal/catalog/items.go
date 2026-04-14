package catalog

// Items is the complete static item database served by GET /api/items.
var Items = []ItemDef{
	// Resources
	{"/Game/Items/Resources/BPI_Wood.BPI_Wood_C", "Wood", "Resources", "stack"},
	{"/Game/Items/Resources/BPI_Fiber.BPI_Fiber_C", "Fiber", "Resources", "stack"},
	{"/Game/Items/Resources/BPI_Resin.BPI_Resin_C", "Resin", "Resources", "stack"},
	{"/Game/Items/Resources/BPI_Feather.BPI_Feather_C", "Feather", "Resources", "stack"},
	{"/Game/Items/Resources/BPI_Ironwood.BPI_Ironwood_C", "Ironwood", "Resources", "stack"},
	{"/Game/Items/Resources/BPI_ReishiLeather.BPI_ReishiLeather_C", "Reishi Leather", "Resources", "stack"},
	{"/Game/Items/Resources/BPI_IronIngot.BPI_IronIngot_C", "Iron Ingot", "Resources", "stack"},
	{"/Game/Items/Resources/BPI_Bottlecap.BPI_Bottlecap_C", "Bottlecap", "Resources", "stack"},
	{"/Game/Items/Resources/BPI_Screw.BPI_Screw_C", "Screw", "Resources", "stack"},
	{"/Game/Items/Resources/BPI_RefinedWood.BPI_RefinedWood_C", "Refined Wood", "Resources", "stack"},
	{"/Game/Items/Resources/BPI_Bark.BPI_Bark_C", "Bark", "Resources", "stack"},
	{"/Game/Items/Resources/BPI_Flint.BPI_Flint_C", "Flint", "Resources", "stack"},
	{"/Game/Items/Resources/BPI_Stone.BPI_Stone_C", "Stone", "Resources", "stack"},
	{"/Game/Items/Resources/BPI_StoneBrick.BPI_StoneBrick_C", "Stone Brick", "Resources", "stack"},
	{"/Game/Items/Resources/BPI_Silk.BPI_Silk_C", "Silk", "Resources", "stack"},
	{"/Game/Items/Resources/BPI_GarlicLeaf.BPI_GarlicLeaf_C", "Garlic Leaf", "Resources", "stack"},
	{"/Game/Items/Resources/BPI_FiberString.BPI_FiberString_C", "Fiber String", "Resources", "stack"},
	{"/Game/Items/Resources/BPI_Chitin.BPI_Chitin_C", "Chitin", "Resources", "stack"},
	{"/Game/Items/Resources/BPI_RefinedChitin.BPI_RefinedChitin_C", "Refined Chitin", "Resources", "stack"},
	{"/Game/Items/Resources/BPI_Pyrite.BPI_Pyrite_C", "Pyrite", "Resources", "stack"},
	{"/Game/Items/Resources/BPI_Clay.BPI_Clay_C", "Clay", "Resources", "stack"},
	{"/Game/Items/Resources/BPI_BlueTitEgg.BPI_BlueTitEgg_C", "Blue Tit Egg", "Resources", "stack"},
	{"/Game/Items/Resources/BPI_TextilePatch.BPI_TextilePatch_C", "Textile Patch", "Resources", "stack"},
	// Minerals
	{"/Game/Items/Resources/CrystalShards/BPI_CrystalShard_Winter.BPI_CrystalShard_Winter_C", "Crystal Shard (Blue)", "Minerals", "stack"},
	{"/Game/Items/Resources/CrystalShards/BPI_CrystalShard_Autumn.BPI_CrystalShard_Autumn_C", "Crystal Shard (Amber)", "Minerals", "stack"},
	{"/Game/Items/Resources/CrystalShards/BPI_CrystalShard_Spring.BPI_CrystalShard_Spring_C", "Crystal Shard (Green)", "Minerals", "stack"},
	{"/Game/Items/Resources/CrystalShards/BPI_CrystalShard_Summer.BPI_CrystalShard_Summer_C", "Crystal Shard (Purple)", "Minerals", "stack"},
	// Consumables
	{"/Game/Items/Consumables/ApotecharyTable/HealthElixir/BPI_Con_HealthElixir.BPI_Con_HealthElixir_C", "Health Elixir", "Consumables", "stack"},
	{"/Game/Items/Consumables/ApotecharyTable/StaminaTonic/BPI_Con_StaminaTonic.BPI_Con_StaminaTonic_C", "Stamina Tonic", "Consumables", "stack"},
	{"/Game/Items/Consumables/StoneOven/HerptileRoulade/BPI_Con_HerptileRoulade.BPI_Con_HerptileRoulade_C", "Herptile Roulade", "Consumables", "stack"},
	{"/Game/Items/Consumables/ApotecharyTable/PoisonAntidote/BPI_Con_PoisonAntidote.BPI_Con_PoisonAntidote_C", "Poison Antidote", "Consumables", "stack"},
	{"/Game/Items/Consumables/Workbench/DroneBandage/BPI_Con_DroneBandage.BPI_Con_DroneBandage_C", "Drone Bandage", "Consumables", "stack"},
	{"/Game/Items/Consumables/Uncooked/BugLymph/BPI_BugLymph.BPI_BugLymph_C", "Bug Lymph", "Consumables", "stack"},
	// Utility
	{"/Game/Items/Other/SummoningPebble/BPI_SummoningPebble.BPI_SummoningPebble_C", "Summoning Pebble", "Utility", "stack"},
	{"/Game/Items/Other/BPI_Coin.BPI_Coin_C", "Coin", "Utility", "stack"},
	// Tools
	{"/Game/Items/Tools/RevivalTool/BPI_RevivalTool.BPI_RevivalTool_C", "Revival Tool", "Tools", "stack"},
	{"/Game/Items/Tools/RevivalToolGuild/BPI_RevivalToolGuild.BPI_RevivalToolGuild_C", "Revival Tool (Guild)", "Tools", "stack"},
	{"/Game/Items/Tools/PyritePickaxe/BPI_PyritePickaxe.BPI_PyritePickaxe_C", "Pyrite Pickaxe", "Tools", "epic"},
	{"/Game/Items/Tools/PyriteHatchet/BPI_PyriteHatchet.BPI_PyriteHatchet_C", "Pyrite Hatchet", "Tools", "epic"},
	{"/Game/Items/Tools/BuildersHammer/BPI_BuildersHammer.BPI_BuildersHammer_C", "Builder's Hammer", "Tools", "equipment"},
	// Weapons
	{"/Game/Items/Weapons/TwoHandedSwords/PyriteGreatsword/BPI_PyriteGreatsword.BPI_PyriteGreatsword_C", "Pyrite Greatsword", "Weapons", "epic"},
	{"/Game/Items/Weapons/Spears/StingerLance/BPI_StingerLance.BPI_StingerLance_C", "Stinger Lance", "Weapons", "epic"},
	{"/Game/Items/Staffs/Wyrdweaver/BPI_Staff_Wyrdweaver.BPI_Staff_Wyrdweaver_C", "Staff Wyrdweaver", "Weapons", "epic"},
	// Ranged
	{"/Game/Items/RangedWeapons/Firearms/HandCannon/BPI_HandCannon.BPI_HandCannon_C", "Hand Cannon", "Ranged", "epic"},
	{"/Game/Items/RangedWeapons/Bow/CompositeBow/BPI_CompositeBow.BPI_CompositeBow_C", "Composite Bow", "Ranged", "epic"},
	{"/Game/Items/Projectiles/IronAmmo/BPI_IronAmmo.BPI_IronAmmo_C", "Iron Ammo", "Ranged", "stack"},
	{"/Game/Items/Projectiles/PyriteArrow/BPI_PyriteArrow.BPI_PyriteArrow_C", "Pyrite Arrow", "Ranged", "stack"},
	{"/Game/Items/RangedWeapons/Grenade/Firesand/BPI_FiresandGrenade.BPI_FiresandGrenade_C", "Firesand Grenade", "Ranged", "stack"},
	{"/Game/Items/RangedWeapons/Grenade/StinkBomb/BPI_StinkBomb.BPI_StinkBomb_C", "Stink Bomb", "Ranged", "stack"},
	// Gear
	{"/Game/Items/Gear/Wings/Eadricarus/BPI_EadricusGlidingWings.BPI_EadricusGlidingWings_C", "Eadricus Gliding Wings", "Gear", "epic"},
	// Armor: Rodent Set
	{"/Game/Items/ArmorSets/RodentSet/Helmet/Crystallized/BPI_RodentSet_HelmetCrystalized_Winter.BPI_RodentSet_HelmetCrystalized_Winter_C", "Rodent Helmet (Crystal Winter)", "Armor", "epic"},
	{"/Game/Items/ArmorSets/RodentSet/Legs/Crystallized/BPI_RodentSet_LegsCrystallized_Winter.BPI_RodentSet_LegsCrystallized_Winter_C", "Rodent Legs (Crystal Winter)", "Armor", "epic"},
	{"/Game/Items/ArmorSets/RodentSet/Torso/Crystallized/BPI_RodentSet_TorsoCrystallized_Winter.BPI_RodentSet_TorsoCrystallized_Winter_C", "Rodent Torso (Crystal Winter)", "Armor", "epic"},
	{"/Game/Items/ArmorSets/RodentSet/Arms/Crystallized/BPI_RodentSet_ArmsCrystalized_Winter.BPI_RodentSet_ArmsCrystalized_Winter_C", "Rodent Arms (Crystal Winter)", "Armor", "epic"},
	// Armor: White Rodent Set 2
	{"/Game/Items/ArmorSets/RodentSet2/Helmet/BPI_WhiteRodentSet_Helmet.BPI_WhiteRodentSet_Helmet_C", "White Rodent Helmet", "Armor", "equipment"},
	{"/Game/Items/ArmorSets/RodentSet2/Torso/BPI_WhiteRodentSet_Torso.BPI_WhiteRodentSet_Torso_C", "White Rodent Torso", "Armor", "equipment"},
	{"/Game/Items/ArmorSets/RodentSet2/Arms/BPI_WhiteRodentSet_Arms.BPI_WhiteRodentSet_Arms_C", "White Rodent Arms", "Armor", "equipment"},
	{"/Game/Items/ArmorSets/RodentSet2/Legs/BPI_WhiteRodentSet_Legs.BPI_WhiteRodentSet_Legs_C", "White Rodent Legs", "Armor", "equipment"},
	{"/Game/Items/ArmorSets/RodentSet2/Helmet/Crystallized/BPI_WhiteRodentSetCrystallized_Helmet_Winter.BPI_WhiteRodentSetCrystallized_Helmet_Winter_C", "White Rodent Helmet (Crystal Winter)", "Armor", "epic"},
	{"/Game/Items/ArmorSets/RodentSet2/Torso/Crystallized/BPI_WhiteRodentSet_TorsoCrystallized_Winter.BPI_WhiteRodentSet_TorsoCrystallized_Winter_C", "White Rodent Torso (Crystal Winter)", "Armor", "epic"},
	{"/Game/Items/ArmorSets/RodentSet2/Arms/Crystallized/BPI_WhiteRodentSet_ArmsCrystallized_Winter.BPI_WhiteRodentSet_ArmsCrystallized_Winter_C", "White Rodent Arms (Crystal Winter)", "Armor", "epic"},
	{"/Game/Items/ArmorSets/RodentSet2/Legs/Crystallized/BPI_WhiteRodentSet_LegsCrystallized_Winter.BPI_WhiteRodentSet_LegsCrystallized_Winter_C", "White Rodent Legs (Crystal Winter)", "Armor", "epic"},
	// Armor: Bee Armor 2
	{"/Game/Items/ArmorSets/BeeArmor2/Helmet/Crystallized/BPI_BeeArmor2_HelmetCrystallized_Spring.BPI_BeeArmor2_HelmetCrystallized_Spring_C", "Bee Helmet (Crystal Spring)", "Armor", "epic"},
	{"/Game/Items/ArmorSets/BeeArmor2/Torso/Crystallized/BPI_BeeArmor2_TorsoCrystallized_Spring.BPI_BeeArmor2_TorsoCrystallized_Spring_C", "Bee Torso (Crystal Spring)", "Armor", "epic"},
	{"/Game/Items/ArmorSets/BeeArmor2/Arms/Crystallized/BPI_BeeArmor2_ArmsCrystallized_Spring.BPI_BeeArmor2_ArmsCrystallized_Spring_C", "Bee Arms (Crystal Spring)", "Armor", "epic"},
	{"/Game/Items/ArmorSets/BeeArmor2/Legs/Crystallized/BPI_BeeArmor2_LegsCrystallized_Spring.BPI_BeeArmor2_LegsCrystallized_Spring_C", "Bee Legs (Crystal Spring)", "Armor", "epic"},
	// Armor: Pyrite Set
	{"/Game/Items/ArmorSets/PyriteSet/Helmet/Crystallized/BPI_PyriteSet_HelmetCrystallized_Summer.BPI_PyriteSet_HelmetCrystallized_Summer_C", "Pyrite Helmet (Crystal Summer)", "Armor", "epic"},
	{"/Game/Items/ArmorSets/PyriteSet/Torso/Crystallized/BPI_PyriteSet_TorsoCrystallized_Summer.BPI_PyriteSet_TorsoCrystallized_Summer_C", "Pyrite Torso (Crystal Summer)", "Armor", "epic"},
	{"/Game/Items/ArmorSets/PyriteSet/Arms/Crystalized/BPI_PyriteSet_ArmsCrystalized_Summer.BPI_PyriteSet_ArmsCrystalized_Summer_C", "Pyrite Arms (Crystal Summer)", "Armor", "epic"},
	{"/Game/Items/ArmorSets/PyriteSet/Legs/Crystallized/BPI_PyriteSet_LegsCrystalized_Summer.BPI_PyriteSet_LegsCrystalized_Summer_C", "Pyrite Legs (Crystal Summer)", "Armor", "epic"},
	// Armor: Scorpiolaminate
	{"/Game/Items/ArmorSets/ScorpiolaminateSet/Helmet/Crystallized/BPI_ScorpiolaminateSet_HelmetCrystallized_Autumn.BPI_ScorpiolaminateSet_HelmetCrystallized_Autumn_C", "Scorpiolaminate Helmet (Crystal Autumn)", "Armor", "epic"},
	{"/Game/Items/ArmorSets/ScorpiolaminateSet/Torso/Crystallized/BPI_ScorpiolaminateSet_TorsoCrystallized_Autumn.BPI_ScorpiolaminateSet_TorsoCrystallized_Autumn_C", "Scorpiolaminate Torso (Crystal Autumn)", "Armor", "epic"},
	{"/Game/Items/ArmorSets/ScorpiolaminateSet/Arms/Crystallized/BPI_ScorpiolaminateSet_ArmsCrystallized_Autumn.BPI_ScorpiolaminateSet_ArmsCrystallized_Autumn_C", "Scorpiolaminate Arms (Crystal Autumn)", "Armor", "epic"},
	{"/Game/Items/ArmorSets/ScorpiolaminateSet/Legs/Crystallized/BPI_ScorpiolaminateSet_LegsCrystallized_Autumn.BPI_ScorpiolaminateSet_LegsCrystallized_Autumn_C", "Scorpiolaminate Legs (Crystal Autumn)", "Armor", "epic"},
}
