// Smalland Save File Types

export interface OwningPlayer {
  PlayerId: string;
  LastKnownAs: string;
  EosProductId?: string;
  LastPlatform?: string;
}

export interface InventoryItemPreser {
  Class: string;
  Id: number;
}

export interface InventoryItemSer {
  Id: number;
  Idx: number;
}

export interface ItemSerialize {
  Quantity?: number;
  Durability?: number;
  QualityLevel?: number;
  TierOverride?: number;
}

export interface PlayerInventory {
  Id: number;
  InventoryItems: InventoryItemPreser[];
}

export interface EquippedItemPreser {
  Id: number;
  Class: string;
}

export interface EquippedItemSer {
  Slot: string;
  Id: number;
}

export interface HotbarEntry {
  Id?: number;
  Slot: number;
  Class: string;
}

export interface PetProgression {
  Level: number;
  XP: number;
  Attributes: Record<string, number>;
  Traits: string[];
  OR?: number;
}

export interface PetStats {
  Health: number;
  Energy: number;
  OwningPlayer?: OwningPlayer;
}

export interface PetInvEntry {
  Class: string;
  Id: number;
}

export interface PetCharInv {
  Id: number;
  InventoryItems: PetInvEntry[];
}

export interface PreSerializeCreature {
  Class: string;
  Id: number;
  CharInv?: PetCharInv;
  CharProgression?: { Id: number };
}

export interface StoredTamedCreatures {
  Version: number;
  PreSerializeCreatures: PreSerializeCreature[];
  [key: string]: unknown; // numeric IDs
}

export interface PlayerProgression {
  Level: number;
  XP: number;
  Attributes: Record<string, number>;
}

export interface PlayerCharacterSer {
  Health: number;
  Energy: number;
  OwningPlayer: OwningPlayer;
  Starvation?: number;
  Food?: number;
}

export interface SaveMeta {
  outer_magic: string;
  name_len: number;
  name: string;
  chunk_max_size: number;
}

export interface SaveData {
  PersistencyVersion: number;
  GameVersion: string;
  TimeSaved: string;
  TimeCreated: string;
  PlayerName: string;
  Preserialize: {
    PlayerNarrative: { Id: number };
    PlayerCustomizationInfo: { Id: number };
    PlayerEquipment: { Id: number; EquippedItems: EquippedItemPreser[] };
    PlayerInventory: PlayerInventory;
    PlayerQuestTracker: { Id: number; Quests: unknown[] };
    PlayerFactionRelations?: { Id: number };
    PlayerEncampment?: { Id: number };
    PlayerRecipeContainer?: { Id: number };
    PlayerDeathState?: { Id: number };
    Hotbar?: { Id: number };
    CreatureRelations?: { Id: number };
    CreatureStable?: { Id: number };
    PlayerStatTracker?: { Id: number };
    PlayerProgression?: { Id: number };
  };
  Serialize: Record<string, unknown>;
  PlayerCharacter: {
    Preserialize: { Id: number };
    Serialize: Record<string, PlayerCharacterSer>;
  };
}

export interface WrappedSave {
  _meta: SaveMeta;
  data: SaveData;
}
