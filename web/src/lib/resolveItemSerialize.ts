import type { ItemSerialize, WrappedSave } from '@/lib/saveTypes';

function storedTamedCreaturesMap(save: WrappedSave): Record<string, unknown> | null {
  const crId = String(save.data.Preserialize.CreatureRelations?.Id ?? '');
  if (!crId) return null;
  const crBlock = save.data.Serialize[crId] as { StoredTamedCreatures?: Record<string, unknown> } | undefined;
  const stc = crBlock?.StoredTamedCreatures;
  if (!stc || typeof stc !== 'object' || Array.isArray(stc)) return null;
  return stc as Record<string, unknown>;
}

/**
 * Player inventory items use `data.Serialize[itemId]`.
 * Companion inventory items nest under `Serialize[creatureRelationsId].StoredTamedCreatures[itemId]`.
 * Top-level wins if both exist.
 */
export function resolveItemSerialize(save: WrappedSave, itemId: number): ItemSerialize {
  const id = String(itemId);
  const top = (save.data.Serialize[id] ?? {}) as ItemSerialize;
  const stc = storedTamedCreaturesMap(save);
  const raw = stc?.[id];
  const nested =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as ItemSerialize) : ({} as ItemSerialize);
  return { ...nested, ...top };
}
