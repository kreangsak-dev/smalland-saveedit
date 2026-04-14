/** Max pet inventory slots without any Increased Inventory trait row. */
export const PET_INVENTORY_BASE_SLOTS = 8;
/** Same trait path can appear up to this many times in `Traits` (game stacking). */
export const PET_INCREASED_INVENTORY_MAX_STACKS = 6;
/** Extra inventory slots per stack of Increased Inventory (1 stack → 8 + 8 = 16 slots). */
export const PET_INVENTORY_SLOTS_PER_INV_STACK = 8;

export function getPetInventorySlotCap(increasedInventoryStacks: number): number {
  if (increasedInventoryStacks <= 0) return PET_INVENTORY_BASE_SLOTS;
  return PET_INVENTORY_BASE_SLOTS + increasedInventoryStacks * PET_INVENTORY_SLOTS_PER_INV_STACK;
}
