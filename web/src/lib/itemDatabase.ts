/**
 * Item / pet display names and categories come from the Go API (see ItemCatalogProvider).
 * This module re-exports types and pet slot math only — no blueprint class paths in the bundle.
 */
export type { ItemDefinition, ItemKind } from './itemDatabaseTypes';
export {
  getItemName,
  getItemCategory,
  getItemDefinition,
  displayNameFromClassPath,
} from './itemCatalogStore';
export {
  PET_INVENTORY_BASE_SLOTS,
  PET_INCREASED_INVENTORY_MAX_STACKS,
  PET_INVENTORY_SLOTS_PER_INV_STACK,
  getPetInventorySlotCap,
} from './petInventoryConstants';
