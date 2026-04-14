import type { WrappedSave } from '@/lib/saveTypes';
import { formatLvplForSave, type WorldVec3 } from '@/lib/playerSaveInspect';

/** Imperative merge hook used by editor panels before writing to disk. */
export type SaveMergePanelRef = {
  mergeInto: (base: WrappedSave) => WrappedSave;
};

export function cloneSave(s: WrappedSave): WrappedSave {
  return JSON.parse(JSON.stringify(s)) as WrappedSave;
}

function jc<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

function collectSerializeIds(obj: unknown, into: Set<string>) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    obj.forEach(x => collectSerializeIds(x, into));
    return;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if ((k === 'Id' || k === 'CharInv' || k === 'CharProgression') && v && typeof v === 'object' && !Array.isArray(v)) {
      const id = (v as { Id?: number }).Id;
      if (typeof id === 'number') into.add(String(id));
    }
    if (k === 'Id' && typeof v === 'number') into.add(String(v));
    collectSerializeIds(v, into);
  }
}

/** Progression, vitals, faction CP — from live form state. `PlayerName` is not modified. */
export function mergePlayerFormInto(
  base: WrappedSave,
  form: {
    level: number;
    xp: number;
    health: number;
    energy: number;
    starvation: number;
    food: number;
    cp: number;
    /** When set, writes `LVPL` on `PlayerDeathState` serialize (if that block exists). */
    worldPos?: WorldVec3;
  },
  attrForm: Record<string, number>,
): WrappedSave {
  const newSave = cloneSave(base);

  const progId = String(newSave.data.Preserialize.PlayerProgression?.Id ?? '');
  if (progId && newSave.data.Serialize[progId]) {
    const prog = newSave.data.Serialize[progId] as Record<string, unknown>;
    prog.Level = Number(form.level);
    prog.XP = Number(form.xp);
    const currentAttrs = ((prog.Attributes as Record<string, number> | undefined) ?? {});
    const existingKeys = new Set(Object.keys(currentAttrs));
    const levelCap = Math.max(1, Math.min(100, Number(form.level) || 1));
    prog.Attributes = Object.keys(attrForm).reduce<Record<string, number>>((acc, key) => {
      const value = Math.min(levelCap, Math.max(0, Number(attrForm[key] ?? 0)));
      if (existingKeys.has(key) || value > 0) acc[key] = value;
      return acc;
    }, {});
  }

  const pcSerId = Object.keys(newSave.data.PlayerCharacter.Serialize)[0];
  if (pcSerId) {
    const pc = newSave.data.PlayerCharacter.Serialize[pcSerId];
    pc.Health = Number(form.health);
    pc.Energy = Number(form.energy);
    pc.Starvation = Number(form.starvation);
    pc.Food = Number(form.food);
  }

  const factionId = String(newSave.data.Preserialize.PlayerFactionRelations?.Id ?? '');
  if (factionId && newSave.data.Serialize[factionId]) {
    (newSave.data.Serialize[factionId] as Record<string, unknown>).CP = Number(form.cp);
  }

  const deathId = newSave.data.Preserialize.PlayerDeathState?.Id;
  if (form.worldPos !== undefined && deathId != null) {
    const key = String(deathId);
    const block = (newSave.data.Serialize[key] ?? {}) as Record<string, unknown>;
    block.LVPL = formatLvplForSave(form.worldPos);
    newSave.data.Serialize[key] = block;
  }

  return newSave;
}

/** Player inventory + pet CharInv / item serializes from inventory draft. Apply after pets merge. */
export function mergeInventoryDraftInto(base: WrappedSave, invDraft: WrappedSave): WrappedSave {
  const out = cloneSave(base);
  const d = invDraft;

  out.data.Preserialize.PlayerInventory = jc(d.data.Preserialize.PlayerInventory);

  const pInvId = String(d.data.Preserialize.PlayerInventory.Id);
  out.data.Serialize[pInvId] = jc(d.data.Serialize[pInvId]);

  for (const it of d.data.Preserialize.PlayerInventory.InventoryItems) {
    const id = String(it.Id);
    if (d.data.Serialize[id] !== undefined) {
      out.data.Serialize[id] = jc(d.data.Serialize[id]);
    }
  }

  const crId = String(d.data.Preserialize.CreatureRelations?.Id ?? '');
  const dCrBlock = d.data.Serialize[crId] as Record<string, unknown> | undefined;
  const oCrBlock = out.data.Serialize[crId] as Record<string, unknown> | undefined;
  if (!crId || !dCrBlock || !oCrBlock) return out;

  type InvPet = { Id: number; CharInv?: { Id: number; InventoryItems: { Class: string; Id: number }[] } };
  type Stc = { PreSerializeCreatures: InvPet[] };
  const dStc = dCrBlock.StoredTamedCreatures as Stc | undefined;
  const oStc = oCrBlock.StoredTamedCreatures as Stc | undefined;
  if (!dStc?.PreSerializeCreatures || !oStc?.PreSerializeCreatures) return out;

  for (const dPet of dStc.PreSerializeCreatures) {
    const oPet = oStc.PreSerializeCreatures.find((p: InvPet) => p.Id === dPet.Id);
    if (!oPet || !dPet.CharInv) continue;
    oPet.CharInv = jc(dPet.CharInv);
    const crBlock = oCrBlock;
    const dCr = dCrBlock;
    const cid = String(dPet.CharInv.Id);
    if (dCr[cid] !== undefined) crBlock[cid] = jc(dCr[cid]);
    for (const inv of dPet.CharInv.InventoryItems) {
      const iid = String(inv.Id);
      if (d.data.Serialize[iid] !== undefined) {
        out.data.Serialize[iid] = jc(d.data.Serialize[iid]);
      }
    }
  }

  return out;
}

/** Equipped gear + item serializes. */
export function mergeEquipmentDraftInto(base: WrappedSave, eqDraft: WrappedSave): WrappedSave {
  const out = cloneSave(base);
  const d = eqDraft;
  out.data.Preserialize.PlayerEquipment = jc(d.data.Preserialize.PlayerEquipment);

  const eqId = String(d.data.Preserialize.PlayerEquipment.Id);
  out.data.Serialize[eqId] = jc(d.data.Serialize[eqId]);

  for (const eq of d.data.Preserialize.PlayerEquipment.EquippedItems) {
    const id = String(eq.Id);
    if (d.data.Serialize[id] !== undefined) {
      out.data.Serialize[id] = jc(d.data.Serialize[id]);
    }
  }
  return out;
}

/** Full creature relations block + referenced Serialize rows. Run first so inventory can overlay CharInv. */
export function mergePetsDraftInto(base: WrappedSave, petDraft: WrappedSave): WrappedSave {
  const out = cloneSave(base);
  const crPr = petDraft.data.Preserialize.CreatureRelations;
  if (crPr) {
    out.data.Preserialize.CreatureRelations = jc(crPr);
  }
  const crId = String(crPr?.Id ?? '');
  if (!crId || !petDraft.data.Serialize[crId]) return out;

  const dest = out.data.Serialize[crId] as Record<string, unknown>;
  const src = petDraft.data.Serialize[crId] as Record<string, unknown>;
  for (const k of Object.keys(dest)) delete dest[k];
  Object.assign(dest, jc(src));

  const ids = new Set<string>();
  collectSerializeIds(src, ids);
  for (const id of ids) {
    if (petDraft.data.Serialize[id] !== undefined) {
      out.data.Serialize[id] = jc(petDraft.data.Serialize[id]);
    }
  }
  return out;
}
