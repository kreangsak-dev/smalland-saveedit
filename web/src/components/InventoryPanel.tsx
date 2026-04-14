import { useState, useMemo, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import type { WrappedSave, InventoryItemPreser, ItemSerialize, EquippedItemPreser } from '@/lib/saveTypes';
import { cloneSave, mergeInventoryDraftInto, type SaveMergePanelRef } from '@/lib/mergeSaveDrafts';
import { getPetInventorySlotCap } from '@/lib/itemDatabase';
import WikiThumbImg from '@/components/WikiThumbImg';
import { quantitiesPerSlotForAdd } from '@/lib/itemAddChunks';
import { getNextId, saveIdToKey, saveIdsEqual } from '@/lib/saveIds';
import { useItemCatalog } from '@/context/ItemCatalogContext';
import { Plus, Trash2, Search, Star, Layers, X, Package, ChevronDown, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  save: WrappedSave;
  setSave: (s: WrappedSave) => void;
  fileEpoch: number;
  /** Bump parent epoch after Apply so other tabs reload from `save` without resetting on Player Apply. */
  onDraftCommitted?: () => void;
}

interface BagRow {
  kind: 'bag';
  preser: InventoryItemPreser;
  ser: ItemSerialize;
  idx: number;
}

interface EquippedRow {
  kind: 'equipped';
  preser: EquippedItemPreser;
  ser: ItemSerialize;
  slot: string;
}

type InventoryRow = BagRow | EquippedRow;

const EQUIP_SLOT_LABEL: Record<string, string> = {
  head: 'Helmet',
  Helmet: 'Helmet',
  Torso: 'Torso',
  Arms: 'Arms',
  Legs: 'Legs',
  MainHand: 'Main hand',
  OffHand: 'Off hand',
  Wings: 'Wings',
  Ammunition: 'Ammunition',
  Ring: 'Ring',
  Necklace: 'Necklace',
};

function equipSlotLabel(slot: string): string {
  return EQUIP_SLOT_LABEL[slot] ?? slot;
}

// Fallback image based on category
function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    Resources: '🪵', Minerals: '💎', Consumables: '🧪', Utility: '🔧',
    Tools: '⛏️', Weapons: '⚔️', Ranged: '🏹', Gear: '🪶', Armor: '🛡️',
    Eggs: '🥚', Deployable: '📍', Other: '📦',
  };
  return icons[category] ?? '📦';
}

type BagOwned = { slots: number; qtySum: number };

function formatBagOwnedLine(
  kind: 'stack' | 'equipment' | 'epic',
  owned: BagOwned | undefined,
  emptyLabel: string | null,
): string | null {
  if (!owned || owned.slots === 0) return emptyLabel;
  if (kind === 'stack' && owned.qtySum > 0) {
    return owned.slots > 1
      ? `In bag: ${owned.qtySum.toLocaleString()} total · ${owned.slots} stacks`
      : `In bag: ${owned.qtySum.toLocaleString()} total`;
  }
  return owned.slots === 1 ? 'In bag: 1' : `In bag: ${owned.slots} slots`;
}

// Target types for adding items
type AddTarget = 'player' | { petIdx: number; petName: string };

const ADD_FILTER_STYLES: Record<string, { active: string; inactive: string }> = {
  __crystallized_gear_wings__: { active: 'bg-violet-600 text-white', inactive: 'bg-violet-100 text-violet-800 hover:bg-violet-200' },
  __special_weapons__: { active: 'bg-amber-600 text-white', inactive: 'bg-amber-100 text-amber-900 hover:bg-amber-200' },
  __ammo_arrows__: { active: 'bg-sky-600 text-white', inactive: 'bg-sky-100 text-sky-900 hover:bg-sky-200' },
};

const InventoryPanel = forwardRef<SaveMergePanelRef, Props>(function InventoryPanel({ save, setSave, fileEpoch, onDraftCommitted }, ref) {
  const { items, itemCategories, addFilters, getItemName, getItemCategory, getItem, pets: petCatalog } = useItemCatalog();
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
    mergeInto: (base: WrappedSave) => mergeInventoryDraftInto(base, draftRef.current),
  }), []);

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [addSearch, setAddSearch] = useState('');
  const [addCat, setAddCat] = useState('All');
  const [addQty, setAddQty] = useState(100);
  /** Max Quantity per stack slot (game limit); only used when kind === stack. */
  const [addMaxStack, setAddMaxStack] = useState(50);
  const [addDur, setAddDur] = useState(9999);
  const [addEpic, setAddEpic] = useState(true);
  const [selectedAdd, setSelectedAdd] = useState<string | null>(null);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addTarget, setAddTarget] = useState<AddTarget>('player');
  /** Add-item list: show only classes already present in the current bag (player or selected pet). */
  const [addOnlyInBag, setAddOnlyInBag] = useState(false);
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());

  const invId = String(draft.data.Preserialize.PlayerInventory.Id);
  const preserItems = draft.data.Preserialize.PlayerInventory.InventoryItems;
  const serInvItems = (draft.data.Serialize[invId] as { InventoryItems?: { Id: number; Idx: number }[] })?.InventoryItems ?? [];
  const equipId = String(draft.data.Preserialize.PlayerEquipment.Id);
  const equippedPreser = draft.data.Preserialize.PlayerEquipment.EquippedItems;
  const equippedSlots = (draft.data.Serialize[equipId] as { EquippedItems?: { Slot: string; Id: number }[] })?.EquippedItems ?? [];
  const alignedEquippedPreser = useMemo(() => {
    const slotIds = new Set(equippedSlots.map(s => Number(s.Id)));
    return equippedPreser.filter(p => slotIds.has(Number(p.Id)));
  }, [equippedPreser, equippedSlots]);

  // Get pets for target selection
  const pets = useMemo(() => {
    const crId = String(draft.data.Preserialize.CreatureRelations?.Id ?? '');
    if (!crId || !draft.data.Serialize[crId]) return [];
    const crBlock = draft.data.Serialize[crId] as { StoredTamedCreatures?: { PreSerializeCreatures: { Class: string; Id: number; CharInv?: { Id: number; InventoryItems: { Class: string; Id: number }[] } }[] } };
    return crBlock.StoredTamedCreatures?.PreSerializeCreatures?.map((pc, i) => ({
      idx: i,
      name: pc.Class.split('/').pop()?.split('.')[0]?.replace(/^BP_/, '').replace(/_/g, ' ') ?? `Pet ${i}`,
      id: pc.Id,
      charInvId: pc.CharInv?.Id,
    })) ?? [];
  }, [draft]);

  const inventory: InventoryRow[] = useMemo(() => {
    const bagRows: BagRow[] = preserItems.map(p => {
      const serEntry = serInvItems.find(s => saveIdsEqual(s.Id, p.Id));
      const itemSer = (draft.data.Serialize[String(p.Id)] ?? {}) as ItemSerialize;
      return { kind: 'bag' as const, preser: p, ser: itemSer, idx: serEntry?.Idx ?? 0 };
    });
    const eqRows: EquippedRow[] = alignedEquippedPreser.map(p => {
      const slot = equippedSlots.find(s => saveIdsEqual(s.Id, p.Id))?.Slot ?? '?';
      const itemSer = (draft.data.Serialize[String(p.Id)] ?? {}) as ItemSerialize;
      return { kind: 'equipped' as const, preser: p, ser: itemSer, slot };
    });
    const combined = [...eqRows, ...bagRows];
    return combined.filter(e => {
      const name = getItemName(e.preser.Class).toLowerCase();
      const cat = getItemCategory(e.preser.Class);
      return (catFilter === 'All' || cat === catFilter) &&
        (search === '' || name.includes(search.toLowerCase()) || e.preser.Class.toLowerCase().includes(search.toLowerCase()));
    });
  }, [preserItems, serInvItems, alignedEquippedPreser, equippedSlots, draft.data.Serialize, search, catFilter, getItemName, getItemCategory]);

  /** Per item Class: stack rows + sum of Quantity for the add-item target bag (player or selected pet). */
  const addListOwnedByClass = useMemo(() => {
    const m = new Map<string, { slots: number; qtySum: number }>();
    const bump = (cls: string, id: number) => {
      const ser = (draft.data.Serialize[String(id)] ?? {}) as ItemSerialize;
      const o = m.get(cls) ?? { slots: 0, qtySum: 0 };
      o.slots += 1;
      if (ser.Quantity != null && Number.isFinite(Number(ser.Quantity))) {
        o.qtySum += Math.max(0, Math.floor(Number(ser.Quantity)));
      }
      m.set(cls, o);
    };

    if (addTarget === 'player') {
      for (const p of preserItems) bump(p.Class, p.Id);
    } else {
      const petIdx = addTarget.petIdx;
      const crId = String(draft.data.Preserialize.CreatureRelations?.Id ?? '');
      const crBlock = draft.data.Serialize[crId] as {
        StoredTamedCreatures?: { PreSerializeCreatures: { CharInv?: { InventoryItems: { Class: string; Id: number }[] } }[] };
      } | undefined;
      const inv = crBlock?.StoredTamedCreatures?.PreSerializeCreatures[petIdx]?.CharInv?.InventoryItems;
      if (inv) for (const it of inv) bump(it.Class, it.Id);
    }
    return m;
  }, [addTarget, preserItems, draft.data.Serialize, draft.data.Preserialize.CreatureRelations?.Id]);

  const addFilterClassSets = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const f of addFilters) {
      m.set(f.key, new Set(f.classes));
    }
    return m;
  }, [addFilters]);

  const addCategoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    counts.set('All', items.length);
    for (const cat of itemCategories) {
      if (cat === 'All') continue;
      counts.set(cat, items.filter(i => i.category === cat).length);
    }
    for (const f of addFilters) {
      const set = addFilterClassSets.get(f.key);
      if (!set) continue;
      counts.set(f.key, items.filter(i => set.has(i.class)).length);
    }
    return counts;
  }, [items, itemCategories, addFilters, addFilterClassSets]);

  const itemMatchesAddCat = useCallback(
    (item: (typeof items)[0], catKey: string) => {
      if (catKey === 'All') return true;
      const set = addFilterClassSets.get(catKey);
      if (set) return set.has(item.class);
      return item.category === catKey;
    },
    [addFilterClassSets],
  );

  const filteredAddItems = useMemo(() => {
    return items.filter(item => {
      const matchCat = itemMatchesAddCat(item, addCat);
      const matchSearch = addSearch === '' ||
        item.name.toLowerCase().includes(addSearch.toLowerCase()) ||
        item.class.toLowerCase().includes(addSearch.toLowerCase());
      const slots = addListOwnedByClass.get(item.class)?.slots ?? 0;
      const matchOwned = !addOnlyInBag || slots > 0;
      return matchCat && matchSearch && matchOwned;
    });
  }, [items, addSearch, addCat, addOnlyInBag, addListOwnedByClass, itemMatchesAddCat]);

  const updateItemSer = useCallback((itemId: number, updates: Partial<ItemSerialize>) => {
    setDraft(prev => {
      const newSave = cloneSave(prev);
      newSave.data.Serialize[String(itemId)] = {
        ...(newSave.data.Serialize[String(itemId)] as ItemSerialize ?? {}),
        ...updates,
      };
      return newSave;
    });
  }, []);

  const deleteItem = useCallback((itemId: number) => {
    setDraft(prev => {
      const newSave = cloneSave(prev);
      const key = saveIdToKey(itemId);
      const inBag = newSave.data.Preserialize.PlayerInventory.InventoryItems.some(p => saveIdsEqual(p.Id, itemId));
      const inEq = newSave.data.Preserialize.PlayerEquipment.EquippedItems.some(p => saveIdsEqual(p.Id, itemId));
      if (inBag) {
        const id = String(newSave.data.Preserialize.PlayerInventory.Id);
        newSave.data.Preserialize.PlayerInventory.InventoryItems =
          newSave.data.Preserialize.PlayerInventory.InventoryItems.filter(p => !saveIdsEqual(p.Id, itemId));
        const invSer = newSave.data.Serialize[id] as { InventoryItems?: { Id: number; Idx: number }[] };
        if (invSer?.InventoryItems) {
          invSer.InventoryItems = invSer.InventoryItems.filter(s => !saveIdsEqual(s.Id, itemId));
        }
      }
      if (inEq) {
        newSave.data.Preserialize.PlayerEquipment.EquippedItems =
          newSave.data.Preserialize.PlayerEquipment.EquippedItems.filter(p => !saveIdsEqual(p.Id, itemId));
        const eid = String(newSave.data.Preserialize.PlayerEquipment.Id);
        const eqSer = newSave.data.Serialize[eid] as { EquippedItems?: { Slot: string; Id: number }[] } | undefined;
        if (eqSer?.EquippedItems) {
          eqSer.EquippedItems = eqSer.EquippedItems.filter(e => !saveIdsEqual(e.Id, itemId));
        }
      }
      if (inBag || inEq) {
        delete newSave.data.Serialize[key];
      }
      return newSave;
    });
  }, []);

  const addItem = useCallback(() => {
    if (!selectedAdd) return;
    const itemDef = getItem(selectedAdd);
    if (!itemDef) return;

    const maxStack = itemDef.kind === 'stack' ? addMaxStack : 1;
    const quantities = quantitiesPerSlotForAdd(itemDef.kind, addQty, maxStack);
    if (quantities.length === 0) return;

    if (addTarget !== 'player') {
      const petTarget = addTarget as { petIdx: number };
      const snap = draftRef.current;
      const crId = String(snap.data.Preserialize.CreatureRelations?.Id ?? '');
      const crBlock = snap.data.Serialize[crId] as {
        StoredTamedCreatures?: {
          PreSerializeCreatures: {
            CharInv?: { Id: number; InventoryItems: { Class: string; Id: number }[] };
            CharProgression?: { Id: number };
          }[];
        };
      } | undefined;
      const stc = crBlock?.StoredTamedCreatures;
      const petPreser = stc?.PreSerializeCreatures[petTarget.petIdx];
      if (!petPreser) return;
      const progId = petPreser.CharProgression?.Id ?? 0;
      const progBlock = ((stc as Record<string, unknown>)[String(progId)] as { Traits?: string[] } | undefined) ?? {};
      const invStacks = (progBlock.Traits ?? []).filter(t => t === petCatalog.increasedInventoryTraitPath).length;
      const slotCap = getPetInventorySlotCap(invStacks);
      const invCount = petPreser.CharInv?.InventoryItems?.length ?? 0;
      const available = slotCap - invCount;
      if (quantities.length > available) {
        toast.error('Not enough companion inventory slots', {
          description: `This add needs ${quantities.length} empty slots (${quantities.length} stack line(s)). Only ${available} left.`,
        });
        return;
      }
    }

    setDraft(prev => {
      const newSave = cloneSave(prev);
      const playerInvId = String(newSave.data.Preserialize.PlayerInventory.Id);

      const pushPlayerSlot = (itemId: number, idx: number, ser: ItemSerialize) => {
        newSave.data.Preserialize.PlayerInventory.InventoryItems.push({ Class: itemDef.class, Id: itemId });
        const invSer = newSave.data.Serialize[playerInvId] as { InventoryItems: { Id: number; Idx: number }[] };
        invSer.InventoryItems.push({ Id: itemId, Idx: idx });
        newSave.data.Serialize[String(itemId)] = ser;
      };

      const pushPetSlot = (
        stc: { PreSerializeCreatures: { CharInv?: { Id: number; InventoryItems: { Class: string; Id: number }[] } }[]; [k: string]: unknown },
        petPreser: { CharInv?: { Id: number; InventoryItems: { Class: string; Id: number }[] } },
        charInvId: number,
        itemId: number,
        idx: number,
        ser: ItemSerialize,
      ) => {
        petPreser.CharInv!.InventoryItems.push({ Class: itemDef.class, Id: itemId });
        const petInvSer = (stc[String(charInvId)] ?? { InventoryItems: [] }) as { InventoryItems: { Id: number; Idx: number }[] };
        petInvSer.InventoryItems.push({ Id: itemId, Idx: idx });
        stc[String(charInvId)] = petInvSer;
        stc[String(itemId)] = ser;
      };

      if (addTarget === 'player') {
        if (!newSave.data.Serialize[playerInvId]) {
          newSave.data.Serialize[playerInvId] = { InventoryItems: [] };
        }
        const invSer = newSave.data.Serialize[playerInvId] as { InventoryItems?: { Id: number; Idx: number }[] };
        if (!invSer.InventoryItems) invSer.InventoryItems = [];
        let maxIdx = invSer.InventoryItems.length ? Math.max(...invSer.InventoryItems.map(e => e.Idx)) : -1;

        for (const q of quantities) {
          const itemId = getNextId(newSave);
          let serEntry: ItemSerialize = {};
          if (itemDef.kind === 'stack') serEntry = { Quantity: q };
          else if (itemDef.kind === 'epic') serEntry = { Durability: addDur, QualityLevel: 4, TierOverride: 7 };
          else serEntry = { Durability: addDur };
          if (addEpic && itemDef.kind !== 'stack') {
            serEntry.QualityLevel = 4;
            serEntry.TierOverride = 7;
          }
          maxIdx += 1;
          pushPlayerSlot(itemId, maxIdx, serEntry);
        }
      } else {
        const petTarget = addTarget as { petIdx: number };
        const crId = String(newSave.data.Preserialize.CreatureRelations?.Id ?? '');
        const crBlock = newSave.data.Serialize[crId] as { StoredTamedCreatures: { PreSerializeCreatures: { CharInv?: { Id: number; InventoryItems: { Class: string; Id: number }[] } }[]; [k: string]: unknown } };
        const stc = crBlock.StoredTamedCreatures;
        const petPreser = stc.PreSerializeCreatures[petTarget.petIdx];

        if (!petPreser.CharInv) {
          const charInvId = getNextId(newSave);
          petPreser.CharInv = { Id: charInvId, InventoryItems: [] };
          stc[String(charInvId)] = { InventoryItems: [] };
        }

        const charInvId = petPreser.CharInv.Id;
        const petInvSer = (stc[String(charInvId)] ?? { InventoryItems: [] }) as { InventoryItems: { Id: number; Idx: number }[] };
        let maxPetIdx = petInvSer.InventoryItems?.length ? Math.max(...petInvSer.InventoryItems.map(e => e.Idx)) : -1;

        for (const q of quantities) {
          const itemId = getNextId(newSave);
          let serEntry: ItemSerialize = {};
          if (itemDef.kind === 'stack') serEntry = { Quantity: q };
          else if (itemDef.kind === 'epic') serEntry = { Durability: addDur, QualityLevel: 4, TierOverride: 7 };
          else serEntry = { Durability: addDur };
          if (addEpic && itemDef.kind !== 'stack') {
            serEntry.QualityLevel = 4;
            serEntry.TierOverride = 7;
          }
          maxPetIdx += 1;
          pushPetSlot(stc, petPreser, charInvId, itemId, maxPetIdx, serEntry);
        }
      }

      return newSave;
    });
    setSelectedAdd(null);
  }, [selectedAdd, addQty, addMaxStack, addDur, addEpic, addTarget, getItem, petCatalog.increasedInventoryTraitPath]);

  const handleReset = () => setDraft(cloneSave(save));
  const handleApply = () => {
    setSave(cloneSave(draft));
    onDraftCommitted?.();
    toast.success('\u0e19\u0e33\u0e01\u0e32\u0e23\u0e41\u0e01\u0e49\u0e44\u0e02\u0e44\u0e1b\u0e43\u0e0a\u0e49\u0e41\u0e25\u0e49\u0e27', { description: 'Inventory' });
  };

  const getKindBadge = (ser: ItemSerialize) => {
    if (ser.Quantity !== undefined) return { label: `×${ser.Quantity}`, bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' };
    if (ser.QualityLevel === 4 && ser.TierOverride === 7) return { label: 'Epic', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' };
    if (ser.Durability !== undefined) return { label: `${Math.round(ser.Durability)} HP`, bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' };
    return { label: 'Item', bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200' };
  };

  const activeCats = useMemo(() => {
    const cats = new Set<string>();
    for (const p of preserItems) cats.add(getItemCategory(p.Class));
    for (const p of alignedEquippedPreser) cats.add(getItemCategory(p.Class));
    return ['All', ...Array.from(cats)];
  }, [preserItems, alignedEquippedPreser, getItemCategory]);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-100 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Inventory</h2>
            <p className="mt-0.5 text-sm text-gray-400">
              {preserItems.length} in bag · {alignedEquippedPreser.length} equipped · Draft until Apply
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              <RotateCcw size={12} /> Reset
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex items-center gap-1.5 rounded-lg bg-linear-to-r from-teal-500 to-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:shadow-md"
            >
              <Save size={12} /> Apply Changes
            </button>
            <button
              type="button"
              onClick={() => setShowAddPanel(v => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold shadow-sm transition-all ${showAddPanel ? 'border border-gray-200 bg-gray-100 text-gray-600' : 'bg-linear-to-r from-teal-500 to-emerald-600 text-white hover:shadow-md'}`}
            >
              {showAddPanel ? <X size={13} /> : <Plus size={13} />}
              {showAddPanel ? 'Close add panel' : 'Add Item'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-5">
        {/* Main Inventory List */}
        <div className="flex-1 min-w-0">
          {/* Search & Filters */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-teal-500/30 focus-within:border-teal-400">
                <Search size={14} className="text-gray-400 shrink-0" />
                <input
                  className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                  placeholder="Search inventory..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button onClick={() => setSearch('')} className="text-gray-300 hover:text-gray-500">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeCats.map(cat => {
                const n = cat === 'All'
                  ? preserItems.length + alignedEquippedPreser.length
                  : preserItems.filter(p => getItemCategory(p.Class) === cat).length +
                    alignedEquippedPreser.filter(p => getItemCategory(p.Class) === cat).length;
                return (
                  <button
                    key={cat}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors ${catFilter === cat ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    onClick={() => setCatFilter(cat)}
                  >
                    {cat} ({n})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Items Grid — 2 columns on md+ */}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {inventory.length === 0 && (
              <div className="col-span-full py-16 text-center text-gray-400">
                <Package size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No items found</p>
              </div>
            )}
            {inventory.map(entry => {
              const name = getItemName(entry.preser.Class);
              const cat = getItemCategory(entry.preser.Class);
              const badge = getKindBadge(entry.ser);
              const isStack = entry.ser.Quantity !== undefined;
              const isEpic = entry.ser.QualityLevel === 4 && entry.ser.TierOverride === 7;
              const hasImgError = imgErrors.has(name);
              const rowKey = entry.kind === 'equipped' ? `eq-${entry.preser.Id}` : `bag-${entry.preser.Id}`;
              const subline = entry.kind === 'equipped'
                ? `${cat} · Equipped · ${equipSlotLabel(entry.slot)}`
                : `${cat} · #${entry.idx}`;

              return (
                <div
                  key={rowKey}
                  className={`flex min-w-0 flex-col gap-2 rounded-xl border bg-white p-3 transition-all hover:shadow-sm sm:flex-row sm:items-center sm:gap-3 ${isEpic ? 'border-amber-200 bg-amber-50/30' : entry.kind === 'equipped' ? 'border-indigo-100 bg-indigo-50/20' : 'border-gray-100'}`}
                >
                  {/* Item Image */}
                  <div className="flex shrink-0 items-center gap-3 sm:contents">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center">
                      {!hasImgError ? (
                        <WikiThumbImg
                          displayName={name}
                          alt={name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          onBothFailed={() => setImgErrors(prev => new Set(prev).add(name))}
                        />
                      ) : (
                        <span className="text-lg">{getCategoryIcon(cat)}</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-sm font-medium leading-snug text-gray-900">{name}</div>
                      <div className="text-[10px] text-gray-400">{subline}</div>
                    </div>
                  </div>

                  {/* Editable fields */}
                  <div className="flex flex-wrap items-center gap-2 sm:ml-auto sm:shrink-0">
                    {isStack ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-400">Qty</span>
                        <input
                          className="w-16 px-2 py-1 text-xs text-right bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                          type="number" min={1}
                          value={entry.ser.Quantity ?? ''}
                          onChange={e => updateItemSer(entry.preser.Id, { Quantity: Number(e.target.value) || 1 })}
                        />
                      </div>
                    ) : (
                      <>
                        {entry.ser.Durability !== undefined && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-400">Dur</span>
                            <input
                              className="w-16 px-2 py-1 text-xs text-right bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                              type="number" min={0}
                              value={entry.ser.Durability !== undefined ? Math.round(entry.ser.Durability) : ''}
                              onChange={e => updateItemSer(entry.preser.Id, { Durability: Number(e.target.value) || 0 })}
                            />
                          </div>
                        )}
                        <button
                          className={`p-1.5 rounded-lg transition-colors ${isEpic ? 'text-amber-500 bg-amber-100' : 'text-gray-300 hover:text-amber-500 hover:bg-amber-50'}`}
                          onClick={() => {
                            if (isEpic) updateItemSer(entry.preser.Id, { QualityLevel: undefined, TierOverride: undefined });
                            else updateItemSer(entry.preser.Id, { QualityLevel: 4, TierOverride: 7 });
                          }}
                          title={isEpic ? 'Remove Epic' : 'Set Epic'}
                        >
                          <Star size={12} fill={isEpic ? 'currentColor' : 'none'} />
                        </button>
                      </>
                    )}
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${badge.bg} ${badge.text} border ${badge.border}`}>
                      {badge.label}
                    </span>
                    <button onClick={() => deleteItem(entry.preser.Id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Add Item Sidebar */}
        {showAddPanel && (
          <div className="w-full shrink-0 xl:w-[min(28rem,100%)] xl:max-w-md">
            <div className="sticky top-0 rounded-xl border border-gray-100 bg-white p-4 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
              <div className="flex items-center gap-2 mb-3">
                <Plus size={14} className="text-teal-500" />
                <h3 className="text-sm font-semibold text-gray-700">Add Item</h3>
              </div>

              {/* Target selector */}
              <div className="mb-3">
                <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Add to</label>
                <div className="relative">
                  <select
                    className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                    value={typeof addTarget === 'string' ? 'player' : `pet:${addTarget.petIdx}`}
                    onChange={e => {
                      if (e.target.value === 'player') setAddTarget('player');
                      else {
                        const idx = parseInt(e.target.value.split(':')[1]);
                        const pet = pets[idx];
                        if (pet) setAddTarget({ petIdx: idx, petName: pet.name });
                      }
                    }}
                  >
                    <option value="player">Player Inventory</option>
                    {pets.map((pet, i) => (
                      <option key={i} value={`pet:${i}`}>Pet: {pet.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Search */}
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg mb-3 focus-within:ring-2 focus-within:ring-teal-500/30 focus-within:border-teal-400">
                <Search size={12} className="text-gray-400" />
                <input
                  className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                  placeholder="Search items..."
                  value={addSearch}
                  onChange={e => setAddSearch(e.target.value)}
                />
              </div>

              {/* Category pills */}
              <div className="flex flex-wrap gap-1 mb-3">
                {itemCategories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    className={`px-2 py-0.5 text-[10px] font-medium rounded-full transition-colors ${addCat === cat ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    onClick={() => setAddCat(cat)}
                  >
                    {cat} ({addCategoryCounts.get(cat) ?? 0})
                  </button>
                ))}
                {addFilters.map(f => {
                  const tone = ADD_FILTER_STYLES[f.key] ?? {
                    active: 'bg-gray-700 text-white',
                    inactive: 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                  };
                  const active = addCat === f.key;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      className={`px-2 py-0.5 text-[10px] font-medium rounded-full transition-colors ${active ? tone.active : tone.inactive}`}
                      onClick={() => setAddCat(f.key)}
                    >
                      {f.label} ({addCategoryCounts.get(f.key) ?? 0})
                    </button>
                  );
                })}
              </div>

              
              <label className="mb-3 flex cursor-pointer items-center gap-2 text-[11px] text-gray-600 select-none">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-teal-600 focus:ring-teal-500/30"
                  checked={addOnlyInBag}
                  onChange={e => setAddOnlyInBag(e.target.checked)}
                />
                <span>Only items already in this bag</span>
              </label>

              {/* Item list */}
              <div className="max-h-[min(28rem,50vh)] overflow-y-auto space-y-1.5 mb-3 -mx-1 px-1">
                {filteredAddItems.map(item => {
                  const hasErr = imgErrors.has(item.name);
                  const owned = addListOwnedByClass.get(item.class);
                  const ownedLine = formatBagOwnedLine(item.kind, owned, null);
                  return (
                    <button
                      key={item.class}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all ${selectedAdd === item.class ? 'bg-teal-50 ring-1 ring-teal-300' : 'hover:bg-gray-50'}`}
                      onClick={() => setSelectedAdd(item.class === selectedAdd ? null : item.class)}
                    >
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center">
                        {!hasErr ? (
                          <WikiThumbImg
                            displayName={item.name}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onBothFailed={() => setImgErrors(prev => new Set(prev).add(item.name))}
                          />
                        ) : (
                          <span className="text-sm">{getCategoryIcon(item.category)}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium leading-snug text-gray-800 line-clamp-2">{item.name}</div>
                        <div className="text-[10px] text-gray-400">{item.category}</div>
                        {ownedLine && (
                          <div className="mt-0.5 text-[10px] font-semibold tabular-nums text-teal-700">{ownedLine}</div>
                        )}
                      </div>
                      <span className={`shrink-0 px-1.5 py-0.5 text-[9px] font-medium rounded ${item.kind === 'epic' ? 'bg-amber-100 text-amber-600' : item.kind === 'stack' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                        {item.kind}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Config for selected item */}
              {selectedAdd && (() => {
                const item = getItem(selectedAdd);
                if (!item) return null;
                const selOwnedLine = formatBagOwnedLine(item.kind, addListOwnedByClass.get(item.class), 'Not in this bag yet')!;
                return (
                  <div className="border-t border-gray-100 pt-3 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-teal-200 bg-teal-50">
                        {!imgErrors.has(item.name) ? (
                          <WikiThumbImg
                            displayName={item.name}
                            alt=""
                            className="w-full h-full object-cover"
                            onBothFailed={() => setImgErrors(prev => new Set(prev).add(item.name))}
                          />
                        ) : (
                          <span className="text-sm">{getCategoryIcon(item.category)}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold leading-snug text-gray-800">{item.name}</div>
                        <div className="mt-0.5 text-[11px] font-medium tabular-nums text-teal-700">{selOwnedLine}</div>
                      </div>
                    </div>

                    {item.kind === 'stack' ? (
                      <div className="space-y-2">
                        <div>
                          <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                            <Layers size={10} className="inline mr-1" />Total quantity
                          </label>
                          <div className="flex gap-1.5">
                            <input type="number" className="flex-1 px-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30" min={1} value={addQty} onChange={e => setAddQty(Number(e.target.value))} />
                            <button type="button" onClick={() => setAddQty(9999)} className="px-2 py-1 text-[10px] font-bold text-teal-600 bg-teal-50 rounded-lg hover:bg-teal-100">MAX</button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Max per slot</label>
                          <div className="flex gap-1.5">
                            <input type="number" className="flex-1 px-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30" min={1} max={9999} value={addMaxStack} onChange={e => setAddMaxStack(Math.max(1, Number(e.target.value) || 1))} />
                            <button type="button" onClick={() => setAddMaxStack(50)} className="px-2 py-1 text-[10px] font-bold text-teal-600 bg-teal-50 rounded-lg hover:bg-teal-100">50</button>
                          </div>
                          <p className="text-[9px] text-gray-400 mt-1">Splits into multiple inventory rows (e.g. 100 with 50 → 2×50).</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">How many (separate slots)</label>
                          <div className="flex gap-1.5">
                            <input type="number" className="flex-1 px-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30" min={1} value={addQty} onChange={e => setAddQty(Math.max(1, Number(e.target.value) || 1))} />
                            <button type="button" onClick={() => setAddQty(100)} className="px-2 py-1 text-[10px] font-bold text-teal-600 bg-teal-50 rounded-lg hover:bg-teal-100">100</button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Durability</label>
                          <div className="flex gap-1.5">
                            <input type="number" className="flex-1 px-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30" min={0} value={addDur} onChange={e => setAddDur(Number(e.target.value))} />
                            <button onClick={() => setAddDur(9999)} className="px-2 py-1 text-[10px] font-bold text-teal-600 bg-teal-50 rounded-lg hover:bg-teal-100">MAX</button>
                          </div>
                        </div>
                        <label className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer">
                          <input type="checkbox" checked={addEpic} onChange={e => setAddEpic(e.target.checked)} className="accent-amber-500" />
                          <span className="text-xs font-medium text-amber-700">Epic Quality (Tier 7)</span>
                          <Star size={12} className={addEpic ? 'text-amber-500 ml-auto' : 'text-gray-300 ml-auto'} fill={addEpic ? 'currentColor' : 'none'} />
                        </label>
                      </>
                    )}

                    <button onClick={addItem} className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-linear-to-r from-teal-500 to-emerald-600 rounded-lg shadow-sm hover:shadow-md transition-all">
                      <Plus size={13} />
                      Add to {addTarget === 'player' ? 'Player' : (addTarget as { petName: string }).petName}
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default InventoryPanel;
