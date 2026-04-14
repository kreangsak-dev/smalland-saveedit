import type { WrappedSave } from '@/lib/saveTypes';

export type WorldVec3 = { x: number; y: number; z: number };

const PRIORITY_KEYS = ['RelativeLocation', 'Translation', 'WorldLocation', 'Location'] as const;

function asVec3(v: unknown): WorldVec3 | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const x = o.X ?? o.x;
  const y = o.Y ?? o.y;
  const z = o.Z ?? o.z;
  if (typeof x === 'number' && typeof y === 'number' && typeof z === 'number') {
    return { x, y, z };
  }
  return null;
}

/** Depth-first: prefer explicit transform keys, then any {X,Y,Z} triplet (Unreal-style). */
function findLocationInObject(obj: unknown, depth: number): WorldVec3 | null {
  if (depth > 14 || obj === null || typeof obj !== 'object') return null;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const f = findLocationInObject(item, depth + 1);
      if (f) return f;
    }
    return null;
  }
  const r = obj as Record<string, unknown>;
  for (const k of PRIORITY_KEYS) {
    if (Object.prototype.hasOwnProperty.call(r, k)) {
      const v = asVec3(r[k]);
      if (v) return v;
    }
  }
  for (const v of Object.values(r)) {
    const f = findLocationInObject(v, depth + 1);
    if (f) return f;
  }
  return null;
}

const LVPL_RE = /X\s*=\s*([+-]?\d*\.?\d+(?:e[+-]?\d+)?)\s+Y\s*=\s*([+-]?\d*\.?\d+(?:e[+-]?\d+)?)\s+Z\s*=\s*([+-]?\d*\.?\d+(?:e[+-]?\d+)?)/i;

/** Last valid player location — game stores this on `PlayerDeathState` as `LVPL` text. */
function parseLvpl(save: WrappedSave): WorldVec3 | null {
  const id = save.data.Preserialize.PlayerDeathState?.Id;
  if (id == null) return null;
  const block = save.data.Serialize[String(id)] as Record<string, unknown> | undefined;
  const raw = block?.LVPL;
  if (typeof raw !== 'string') return null;
  const m = raw.match(LVPL_RE);
  if (!m) return null;
  const x = Number(m[1]);
  const y = Number(m[2]);
  const z = Number(m[3]);
  if (![x, y, z].every(n => Number.isFinite(n))) return null;
  return { x, y, z };
}

/** Best-effort world position: `LVPL` on death state, then vectors under PlayerCharacter / Serialize. */
export function extractPlayerWorldPosition(save: WrappedSave): WorldVec3 | null {
  const fromLvpl = parseLvpl(save);
  if (fromLvpl) return fromLvpl;

  const ser = save.data.PlayerCharacter.Serialize;
  const pcSerId = Object.keys(ser)[0];
  if (!pcSerId) return null;
  const pcData = ser[pcSerId];
  const fromChar = findLocationInObject(pcData, 0);
  if (fromChar) return fromChar;
  const top = save.data.Serialize[pcSerId];
  if (top !== undefined) return findLocationInObject(top, 0);
  return null;
}

export function formatWorldVec3(v: WorldVec3, decimals = 1): string {
  return `X ${v.x.toFixed(decimals)} · Y ${v.y.toFixed(decimals)} · Z ${v.z.toFixed(decimals)}`;
}

/** Same shape as in-game `PlayerDeathState` → `LVPL`. */
export function formatLvplForSave(v: WorldVec3): string {
  const fmt = (n: number) => {
    if (!Number.isFinite(n)) return '0';
    const t = n.toFixed(6).replace(/\.?0+$/, '');
    return t === '-0' ? '0' : t;
  };
  return `X=${fmt(v.x)} Y=${fmt(v.y)} Z=${fmt(v.z)}`;
}

export function parseWorldVec3Inputs(x: string, y: string, z: string): WorldVec3 | undefined {
  const a = Number(String(x).trim());
  const b = Number(String(y).trim());
  const c = Number(String(z).trim());
  if (![a, b, c].every(Number.isFinite)) return undefined;
  return { x: a, y: b, z: c };
}
