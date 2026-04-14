import { useCallback, useEffect, useState, useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
import type { WrappedSave, ItemSerialize } from '@/lib/saveTypes';
import { cloneSave, mergeEquipmentDraftInto, type SaveMergePanelRef } from '@/lib/mergeSaveDrafts';
import { getNextId, saveIdToKey, saveIdsEqual } from '@/lib/saveIds';
import { isCatalogGearKind } from '@/lib/itemCatalogKinds';
import { useItemCatalog } from '@/context/ItemCatalogContext';
import type { ItemDefinition } from '@/lib/itemDatabaseTypes';
import WikiThumbImg from '@/components/WikiThumbImg';
import { Star, Save, RotateCcw, Trash2, Search, X, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  save: WrappedSave;
  setSave: (s: WrappedSave) => void;
  fileEpoch: number;
  onDraftCommitted?: () => void;
}

// ── Fixed slot definitions — order matches in-game equipment screen (8 slots) ──
const SLOTS: { value: string; label: string; icon: string }[] = [
  { value: 'MainHand',   label: 'Main Hand',      icon: '\u2694\uFE0F' },
  { value: 'OffHand',    label: 'Off Hand',        icon: '\u{1F6E1}\uFE0F' },
  { value: 'Ammunition', label: 'Arrows / Ammo',   icon: '\u{1F3F9}' },
  { value: 'Torso',      label: 'Torso',           icon: '\u{1F455}' },
  { value: 'head',       label: 'Helmet',          icon: '\u{1FA96}' },
  { value: 'Arms',       label: 'Arms',            icon: '\u{1F9BE}' },
  { value: 'Wings',      label: 'Wings',           icon: '\u{1FAB6}' },
  { value: 'Legs',       label: 'Legs',            icon: '\u{1F456}' },
];

const SLOT_GRADIENT: Record<string, string> = {
  MainHand: 'from-red-500 to-red-700',
  OffHand: 'from-cyan-500 to-cyan-700',
  Ammunition: 'from-amber-500 to-amber-700',
  Torso: 'from-emerald-500 to-emerald-700',
  head: 'from-blue-500 to-blue-700',
  Arms: 'from-orange-500 to-orange-700',
  Wings: 'from-teal-500 to-teal-700',
  Legs: 'from-purple-500 to-purple-700',
};

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    Armor: '\u{1F6E1}\uFE0F', Weapons: '\u2694\uFE0F', Ranged: '\u{1F3F9}',
    Gear: '\u{1FAB6}', Tools: '\u26CF\uFE0F', Other: '\u{1F4E6}',
  };
  return icons[category] ?? '\u{1F4E6}';
}

/** Heuristic: higher score = item more likely belongs in this slot. */
function slotRelevance(slot: string, cls: string): number {
  const lc = cls.toLowerCase();
  switch (slot) {
    case 'head':       return lc.includes('/helmet/') || lc.includes('_helmet') ? 10 : lc.includes('armorsets/') ? 1 : 0;
    case 'Torso':      return lc.includes('/torso/') ? 10 : lc.includes('armorsets/') ? 1 : 0;
    case 'Arms':       return lc.includes('/arms/') ? 10 : lc.includes('armorsets/') ? 1 : 0;
    case 'Legs':       return lc.includes('/legs/') ? 10 : lc.includes('armorsets/') ? 1 : 0;
    case 'MainHand':   return lc.includes('/weapons/') || lc.includes('/staffs/') || lc.includes('/tools/') || lc.includes('/rangedweapons/') ? 10 : 0;
    case 'OffHand':    return lc.includes('shield') ? 10 : 0;
    case 'Wings':      return lc.includes('/wings/') || lc.includes('gliding') ? 10 : 0;
    case 'Ammunition': return lc.includes('/projectiles/') || lc.includes('arrow') || lc.includes('ammo') || lc.includes('grenade') ? 10 : 0;
    default:           return 0;
  }
}

/** Two-handed weapons occupy MainHand and block OffHand. */
function isTwoHanded(cls: string): boolean {
  const lc = cls.toLowerCase();
  return lc.includes('twohandedsword') || lc.includes('greatsword')
    || lc.includes('/bow/') || lc.includes('compositebow')
    || lc.includes('/spear') || lc.includes('stingerlance')
    || lc.includes('/staffs/') || lc.includes('staff_')
    || lc.includes('handcannon') || lc.includes('firearms');
}

type SlotItem = { id: number; class: string; ser: ItemSerialize };

const EquipmentPanel = forwardRef<SaveMergePanelRef, Props>(function EquipmentPanel({ save, setSave, fileEpoch, onDraftCommitted }, ref) {
  const { items, getItemName, getItem } = useItemCatalog();
  const [draft, setDraft] = useState(() => cloneSave(save));
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const lastEpochRef = useRef(fileEpoch);
  useEffect(() => {
    if (lastEpochRef.current === fileEpoch) return;
    lastEpochRef.current = fileEpoch;
    setDraft(cloneSave(save));
  }, [fileEpoch, save]);

  useImperativeHandle(ref, () => ({
    mergeInto: (base: WrappedSave) => mergeEquipmentDraftInto(base, draftRef.current),
  }), []);

  // ── Data from draft ──
  const equipId = String(draft.data.Preserialize.PlayerEquipment.Id);
  const equippedPreser = draft.data.Preserialize.PlayerEquipment.EquippedItems;
  const equippedSer = (draft.data.Serialize[equipId] as { EquippedItems?: { Slot: string; Id: number }[] })?.EquippedItems ?? [];

  // slot name → equipped item
  const slotMap = useMemo(() => {
    const m = new Map<string, SlotItem>();
    for (const s of equippedSer) {
      const p = equippedPreser.find(pp => saveIdsEqual(pp.Id, s.Id));
      if (!p) continue;
      const ser = (draft.data.Serialize[String(s.Id)] ?? {}) as ItemSerialize;
      m.set(s.Slot, { id: s.Id, class: p.Class, ser });
    }
    return m;
  }, [equippedSer, equippedPreser, draft.data.Serialize]);

  // ── UI state ──
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [eqDur, setEqDur] = useState(9999);
  const [eqEpic, setEqEpic] = useState(true);
  const [eqStackQty, setEqStackQty] = useState(100);
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());

  // ── Picker items — sorted by relevance to selected slot ──
  const pickerItems = useMemo(() => {
    let list: ItemDefinition[] = items.filter(i => isCatalogGearKind(i.kind));
    if (selectedSlot === 'Ammunition') {
      const ammo = items.filter(i =>
        i.kind === 'stack' && (
          i.class.toLowerCase().includes('/projectiles/') ||
          i.class.toLowerCase().includes('arrow') ||
          i.class.toLowerCase().includes('ammo') ||
          i.class.toLowerCase().includes('grenade')
        ),
      );
      list = [...list, ...ammo];
    }
    if (pickerSearch) {
      const q = pickerSearch.toLowerCase();
      list = list.filter(i => i.name.toLowerCase().includes(q) || i.class.toLowerCase().includes(q));
    }
    if (selectedSlot) {
      list = [...list].sort((a, b) => {
        const d = slotRelevance(selectedSlot, b.class) - slotRelevance(selectedSlot, a.class);
        return d !== 0 ? d : a.name.localeCompare(b.name);
      });
    }
    return list;
  }, [items, selectedSlot, pickerSearch]);

  // ── Actions ──
  const updateItemSer = useCallback((itemId: number, updates: Partial<ItemSerialize>) => {
    setDraft(prev => {
      const ns = cloneSave(prev);
      ns.data.Serialize[String(itemId)] = { ...(ns.data.Serialize[String(itemId)] as ItemSerialize ?? {}), ...updates };
      return ns;
    });
  }, []);

  const removeFromSlot = useCallback((slot: string) => {
    setDraft(prev => {
      const ns = cloneSave(prev);
      const eid = String(ns.data.Preserialize.PlayerEquipment.Id);
      const eqSer = ns.data.Serialize[eid] as { EquippedItems?: { Slot: string; Id: number }[] } | undefined;
      const ids = (eqSer?.EquippedItems ?? []).filter(e => e.Slot === slot).map(e => e.Id);
      for (const id of ids) {
        ns.data.Preserialize.PlayerEquipment.EquippedItems =
          ns.data.Preserialize.PlayerEquipment.EquippedItems.filter(p => !saveIdsEqual(p.Id, id));
        if (eqSer?.EquippedItems) eqSer.EquippedItems = eqSer.EquippedItems.filter(e => !saveIdsEqual(e.Id, id));
        delete ns.data.Serialize[saveIdToKey(id)];
      }
      return ns;
    });
  }, []);

  const clearSlotInSave = (ns: WrappedSave, slotName: string) => {
    const eid = String(ns.data.Preserialize.PlayerEquipment.Id);
    const eqSer = ns.data.Serialize[eid] as { EquippedItems?: { Slot: string; Id: number }[] } | undefined;
    const ids = (eqSer?.EquippedItems ?? []).filter(e => e.Slot === slotName).map(e => e.Id);
    for (const id of ids) {
      ns.data.Preserialize.PlayerEquipment.EquippedItems =
        ns.data.Preserialize.PlayerEquipment.EquippedItems.filter(p => !saveIdsEqual(p.Id, id));
      if (eqSer?.EquippedItems) eqSer.EquippedItems = eqSer.EquippedItems.filter(e => !saveIdsEqual(e.Id, id));
      delete ns.data.Serialize[saveIdToKey(id)];
    }
  };

  const equipToSlot = useCallback((slot: string, itemClass: string) => {
    const itemDef = getItem(itemClass);
    if (!itemDef) return;

    setDraft(prev => {
      const ns = cloneSave(prev);
      const eid = String(ns.data.Preserialize.PlayerEquipment.Id);
      if (!ns.data.Serialize[eid]) ns.data.Serialize[eid] = { EquippedItems: [] };
      const eqSer = ns.data.Serialize[eid] as { EquippedItems: { Slot: string; Id: number }[] };
      if (!eqSer.EquippedItems) eqSer.EquippedItems = [];

      clearSlotInSave(ns, slot);

      if (slot === 'MainHand' && isTwoHanded(itemClass)) {
        clearSlotInSave(ns, 'OffHand');
      }

      const newId = getNextId(ns);
      let ser: ItemSerialize = {};
      if (itemDef.kind === 'stack') {
        ser = { Quantity: Math.max(1, eqStackQty) };
      } else {
        ser = { Durability: eqDur };
        if (eqEpic) { ser.QualityLevel = 4; ser.TierOverride = 7; }
      }

      ns.data.Preserialize.PlayerEquipment.EquippedItems.push({ Id: newId, Class: itemDef.class });
      eqSer.EquippedItems.push({ Slot: slot, Id: newId });
      ns.data.Serialize[String(newId)] = ser;
      return ns;
    });
    const slotLabel = SLOTS.find(s => s.value === slot)?.label ?? slot;
    const extra = slot === 'MainHand' && isTwoHanded(itemClass) ? ' (2H \u2014 Off Hand cleared)' : '';
    toast.success('Equipped', { description: `${itemDef.name} \u2192 ${slotLabel}${extra}` });
  }, [eqDur, eqEpic, eqStackQty, getItem]);

  const setAllEpic = useCallback(() => {
    setDraft(prev => {
      const ns = cloneSave(prev);
      for (const item of ns.data.Preserialize.PlayerEquipment.EquippedItems) {
        const ser = (ns.data.Serialize[String(item.Id)] ?? {}) as ItemSerialize;
        if (ser.Quantity === undefined) {
          ns.data.Serialize[String(item.Id)] = { ...ser, Durability: 9999, QualityLevel: 4, TierOverride: 7 };
        }
      }
      return ns;
    });
    toast.success('All non-stack gear set to Epic');
  }, []);

  const handleReset = () => { setDraft(cloneSave(save)); setSelectedSlot(null); };
  const handleApply = () => {
    setSave(cloneSave(draft));
    onDraftCommitted?.();
    toast.success('\u0e19\u0e33\u0e01\u0e32\u0e23\u0e41\u0e01\u0e49\u0e44\u0e02\u0e44\u0e1b\u0e43\u0e0a\u0e49\u0e41\u0e25\u0e49\u0e27', { description: 'Equipment' });
  };

  const filledCount = slotMap.size;
  const mainHandItem = slotMap.get('MainHand');
  const mainHandIs2H = mainHandItem ? isTwoHanded(mainHandItem.class) : false;
  const sel = selectedSlot;
  const selItem = sel ? slotMap.get(sel) ?? null : null;
  const selMeta = sel ? SLOTS.find(s => s.value === sel) : null;

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="rounded-xl border border-gray-100 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Equipment</h2>
            <p className="mt-0.5 text-sm text-gray-400">
              {filledCount}/{SLOTS.length} slots filled &mdash; click a slot to view or change
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50">
              <RotateCcw size={12} /> Reset
            </button>
            <button type="button" onClick={handleApply}
              className="inline-flex items-center gap-1.5 rounded-lg bg-linear-to-r from-teal-500 to-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:shadow-md">
              <Save size={12} /> Apply Changes
            </button>
            <button type="button" onClick={setAllEpic}
              className="inline-flex items-center gap-1.5 rounded-lg bg-linear-to-r from-amber-500 to-orange-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:shadow-md">
              <Star size={13} fill="currentColor" /> Make All Epic
            </button>
          </div>
        </div>
      </div>

      {/* ── Slot grid + detail panel ── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Slot list */}
        <div className="w-full shrink-0 lg:w-[260px] space-y-1.5">
          {SLOTS.map(slot => {
            const offHandLocked = slot.value === 'OffHand' && mainHandIs2H;
            const displayItem = offHandLocked ? mainHandItem ?? null : slotMap.get(slot.value) ?? null;
            const item = slotMap.get(slot.value) ?? null;
            const active = sel === slot.value;
            const mainGrad = SLOT_GRADIENT['MainHand'] ?? 'from-gray-400 to-gray-600';
            const grad = offHandLocked ? mainGrad : (SLOT_GRADIENT[slot.value] ?? 'from-gray-400 to-gray-600');
            const displayName = displayItem ? getItemName(displayItem.class) : null;
            const isEpic = item && item.ser.QualityLevel === 4 && item.ser.TierOverride === 7;
            const is2H = slot.value === 'MainHand' && item && isTwoHanded(item.class);
            const hasErr = displayName ? imgErrors.has(displayName) : true;

            return (
              <button
                key={slot.value}
                type="button"
                disabled={offHandLocked}
                onClick={() => { if (!offHandLocked) { setSelectedSlot(active ? null : slot.value); setPickerSearch(''); } }}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                  offHandLocked
                    ? 'border-gray-200 bg-white/60 opacity-75 cursor-not-allowed'
                    : active
                      ? 'border-teal-300 bg-teal-50/60 shadow-sm ring-1 ring-teal-200'
                      : item
                        ? 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                        : 'border-dashed border-gray-200 bg-gray-50/50 hover:border-gray-300 hover:bg-white'
                }`}
              >
                {/* Slot icon */}
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base ${
                  displayItem ? `bg-linear-to-br ${grad} text-white shadow-sm` : 'bg-gray-100 text-gray-400'
                }`}>
                  {displayItem && displayName && !hasErr ? (
                    <WikiThumbImg displayName={displayName} alt="" className="h-full w-full rounded-lg object-cover" loading="lazy"
                      onBothFailed={() => setImgErrors(prev => new Set(prev).add(displayName))} />
                  ) : (
                    <span className={displayItem ? '' : 'opacity-60'}>{slot.icon}</span>
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{slot.label}</span>
                    {is2H && <span className="px-1 py-px text-[9px] font-bold rounded bg-red-100 text-red-600">2H</span>}
                    {offHandLocked && <span className="px-1 py-px text-[9px] font-bold rounded bg-red-100 text-red-600">2H</span>}
                    {isEpic && <Star size={10} className="text-amber-500" fill="currentColor" />}
                  </div>
                  {displayItem && displayName ? (
                    <div className="truncate text-sm font-medium text-gray-900 leading-snug">{displayName}</div>
                  ) : (
                    <div className="text-sm text-gray-300 italic">Empty</div>
                  )}
                </div>

                <ChevronRight size={14} className={`shrink-0 transition-transform ${
                  offHandLocked ? 'text-gray-200' : active ? 'rotate-90 text-teal-500' : 'text-gray-300'
                }`} />
              </button>
            );
          })}
        </div>

        {/* Detail & picker panel */}
        <div className="flex-1 min-w-0">
          {!sel ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50 py-20 text-center">
              <span className="text-3xl opacity-30 mb-3">{'\u{1F6E1}\uFE0F'}</span>
              <p className="text-sm text-gray-400">Select a slot on the left to view or change gear</p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              {/* Slot header */}
              <div className={`flex items-center gap-3 px-5 py-3.5 bg-linear-to-r ${SLOT_GRADIENT[sel] ?? 'from-gray-400 to-gray-600'}`}>
                <span className="text-2xl">{selMeta?.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white/70">Slot</div>
                  <div className="text-lg font-bold text-white">{selMeta?.label}</div>
                </div>
                {selItem && (
                  <button type="button" onClick={() => removeFromSlot(sel)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition-colors hover:bg-red-500/80">
                    <Trash2 size={12} /> Remove
                  </button>
                )}
              </div>

              {/* Current item detail */}
              {selItem ? (() => {
                const name = getItemName(selItem.class);
                const ser = selItem.ser;
                const isStack = ser.Quantity !== undefined;
                const isEpic = ser.QualityLevel === 4 && ser.TierOverride === 7;
                const hasErr = imgErrors.has(name);
                return (
                  <div className="border-b border-gray-100 px-5 py-4">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-center">
                        {!hasErr ? (
                          <WikiThumbImg displayName={name} alt={name} className="h-full w-full object-cover"
                            onBothFailed={() => setImgErrors(prev => new Set(prev).add(name))} />
                        ) : (
                          <span className="text-xl">{selMeta?.icon}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-semibold text-gray-900">{name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {isEpic && <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-700">EPIC</span>}
                          {isStack
                            ? <span className="text-xs text-gray-400">{'\u00D7'}{ser.Quantity}</span>
                            : ser.Durability !== undefined && <span className="text-xs text-gray-400">{Math.round(ser.Durability)} HP</span>
                          }
                        </div>
                      </div>
                    </div>
                    {/* Inline edit */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {isStack ? (
                        <div className="col-span-2">
                          <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Quantity</label>
                          <div className="flex gap-1.5">
                            <input type="number" min={1} value={ser.Quantity ?? ''}
                              onChange={e => updateItemSer(selItem.id, { Quantity: Number(e.target.value) || 1 })}
                              className="flex-1 px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
                            <button type="button" onClick={() => updateItemSer(selItem.id, { Quantity: 9999 })}
                              className="px-2 py-1 text-[10px] font-bold text-teal-600 bg-teal-50 rounded-lg hover:bg-teal-100">MAX</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div>
                            <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Durability</label>
                            <div className="flex gap-1">
                              <input type="number" min={0} value={ser.Durability !== undefined ? Math.round(ser.Durability) : ''} placeholder="\u2014"
                                onChange={e => updateItemSer(selItem.id, { Durability: Number(e.target.value) })}
                                className="flex-1 min-w-0 px-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
                              <button type="button" onClick={() => updateItemSer(selItem.id, { Durability: 9999 })}
                                className="px-1.5 py-1 text-[10px] font-bold text-teal-600 bg-teal-50 rounded-lg hover:bg-teal-100 shrink-0">MAX</button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Quality</label>
                            <select value={ser.QualityLevel ?? 0}
                              onChange={e => updateItemSer(selItem.id, { QualityLevel: Number(e.target.value) })}
                              className="w-full px-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30">
                              <option value={0}>Normal</option>
                              <option value={1}>Good</option>
                              <option value={2}>Great</option>
                              <option value={3}>Excellent</option>
                              <option value={4}>EPIC</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Tier</label>
                            <input type="number" min={0} max={10} value={ser.TierOverride ?? 0}
                              onChange={e => updateItemSer(selItem.id, { TierOverride: Number(e.target.value) })}
                              className="w-full px-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
                          </div>
                          <div className="flex items-end">
                            <button type="button"
                              className={`w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${isEpic ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200'}`}
                              onClick={() => updateItemSer(selItem.id, isEpic ? { QualityLevel: 0, TierOverride: 0 } : { QualityLevel: 4, TierOverride: 7, Durability: 9999 })}>
                              <Star size={11} fill={isEpic ? 'currentColor' : 'none'} />
                              {isEpic ? 'Epic' : 'Set Epic'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })() : (
                <div className="px-5 py-6 text-center text-gray-400 text-sm border-b border-gray-100">
                  No item equipped in this slot
                </div>
              )}

              {/* ── Item picker ── */}
              <div className="px-5 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {selItem ? 'Change item' : 'Choose item to equip'}
                  </h4>
                  <button type="button" onClick={() => setSelectedSlot(null)}
                    className="p-1 text-gray-300 hover:text-gray-500 rounded-md hover:bg-gray-100">
                    <X size={14} />
                  </button>
                </div>

                {/* New-item settings */}
                <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-100 bg-gray-50/80 p-3">
                  <div className="w-24">
                    <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Durability</label>
                    <input type="number" min={0} value={eqDur} onChange={e => setEqDur(Number(e.target.value))}
                      className="w-full px-2 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
                  </div>
                  <div className="w-20">
                    <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Qty (ammo)</label>
                    <input type="number" min={1} value={eqStackQty} onChange={e => setEqStackQty(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full px-2 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
                  </div>
                  <label className="flex items-center gap-2 pb-0.5 cursor-pointer select-none">
                    <input type="checkbox" className="accent-amber-500 rounded" checked={eqEpic} onChange={e => setEqEpic(e.target.checked)} />
                    <span className="text-xs font-medium text-amber-800">Epic (Tier 7)</span>
                  </label>
                </div>

                {/* Search */}
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-teal-500/30 focus-within:border-teal-400">
                  <Search size={14} className="text-gray-400 shrink-0" />
                  <input className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                    placeholder={`Search items for ${selMeta?.label}...`}
                    value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} />
                  {pickerSearch && (
                    <button type="button" onClick={() => setPickerSearch('')} className="text-gray-300 hover:text-gray-500"><X size={14} /></button>
                  )}
                </div>

                {/* Item list */}
                <div className="max-h-[min(24rem,45vh)] overflow-y-auto -mx-1 px-1 space-y-1">
                  {pickerItems.length === 0 && (
                    <p className="text-xs text-gray-400 py-8 text-center">No matching items</p>
                  )}
                  {pickerItems.map(item => {
                    const hasErr = imgErrors.has(item.name);
                    const relevance = sel ? slotRelevance(sel, item.class) : 0;
                    return (
                      <button key={item.class} type="button"
                        onClick={() => sel && equipToSlot(sel, item.class)}
                        className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-all hover:bg-teal-50 hover:ring-1 hover:ring-teal-200 active:scale-[0.99]">
                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center">
                          {!hasErr ? (
                            <WikiThumbImg displayName={item.name} alt="" className="w-full h-full object-cover" loading="lazy"
                              onBothFailed={() => setImgErrors(prev => new Set(prev).add(item.name))} />
                          ) : (
                            <span className="text-sm">{getCategoryIcon(item.category)}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-gray-800 leading-snug line-clamp-1">{item.name}</div>
                          <div className="text-[10px] text-gray-400">{item.category}</div>
                        </div>
                        {relevance >= 10 && (
                          <span className="shrink-0 px-1.5 py-0.5 text-[9px] font-bold rounded bg-teal-100 text-teal-700">Match</span>
                        )}
                        <span className={`shrink-0 px-1.5 py-0.5 text-[9px] font-medium rounded ${item.kind === 'epic' ? 'bg-amber-100 text-amber-600' : item.kind === 'stack' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                          {item.kind}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default EquipmentPanel;
