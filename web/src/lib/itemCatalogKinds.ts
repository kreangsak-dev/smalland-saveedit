import type { ItemKind } from '@/lib/itemDatabaseTypes';

/** True when the catalog class is armor / weapons / epic gear — stored on PlayerEquipment, not the bag grid. */
export function isCatalogGearKind(kind: ItemKind | undefined): boolean {
  return kind === 'equipment' || kind === 'epic';
}
