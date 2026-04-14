import type { WrappedSave } from '@/lib/saveTypes';

/** UE/JSON saves sometimes have `Id` as number or string — use for compares and Set membership. */
export function saveIdsEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  const na = typeof a === 'number' && !Number.isNaN(a) ? a : Number(a);
  const nb = typeof b === 'number' && !Number.isNaN(b) ? b : Number(b);
  return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
}

export function saveIdToKey(id: unknown): string {
  if (typeof id === 'number' && Number.isFinite(id)) return String(id);
  const n = Number(id);
  return Number.isFinite(n) ? String(n) : String(id);
}

export function getNextId(save: WrappedSave): number {
  let max = 0;
  const walk = (o: unknown) => {
    if (o && typeof o === 'object') {
      for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
        if (k === 'Id' && typeof v === 'number' && v > max) max = v;
        walk(v);
      }
    }
  };
  walk(save.data);
  return Math.max(max + 100, 950000);
}
