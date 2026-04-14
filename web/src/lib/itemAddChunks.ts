import type { ItemKind } from '@/lib/itemDatabaseTypes';

/**
 * How many items to put in each inventory slot when using "Add item".
 * - `stack`: split `totalQty` into chunks capped by `maxPerSlot` (game stack limit).
 * - `equipment` / `epic`: one slot per unit (`totalQty` separate items).
 */
export function quantitiesPerSlotForAdd(kind: ItemKind, totalQty: number, maxPerSlot: number): number[] {
  if (kind === 'stack') {
    const cap = Math.max(1, Math.floor(maxPerSlot) || 1);
    const total = Math.max(0, Math.floor(totalQty));
    if (total <= 0) return [];
    const out: number[] = [];
    let left = total;
    while (left > 0) {
      const q = Math.min(left, cap);
      out.push(q);
      left -= q;
    }
    return out;
  }
  const n = Math.max(1, Math.floor(totalQty) || 1);
  return Array.from({ length: n }, () => 1);
}
