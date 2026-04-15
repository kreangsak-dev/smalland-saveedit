import { useState, useCallback, useMemo, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import type { WrappedSave } from '@/lib/saveTypes';
import { cloneSave, mergePetsDraftInto, type SaveMergePanelRef } from '@/lib/mergeSaveDrafts';
import { resolveItemSerialize } from '@/lib/resolveItemSerialize';
import WikiThumbImg, { WikiPetThumbImg } from '@/components/WikiThumbImg';
import { quantitiesPerSlotForAdd } from '@/lib/itemAddChunks';
import { getNextId } from '@/lib/saveIds';
import type { PetTraitRow } from '@/lib/api';
import { useItemCatalog } from '@/context/ItemCatalogContext';
import {
  PET_INVENTORY_BASE_SLOTS,
  PET_INCREASED_INVENTORY_MAX_STACKS,
  PET_INVENTORY_SLOTS_PER_INV_STACK,
  getPetInventorySlotCap,
  getItemDefinition,
} from '@/lib/itemDatabase';
import { Plus, Minus, Trash2, Star, ChevronDown, ChevronUp, Search, Layers, Package, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  save: WrappedSave;
  setSave: (s: WrappedSave) => void;
  fileEpoch: number;
  onDraftCommitted?: () => void;
}

const TRAIT_CAT_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  Defense: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', dot: 'bg-red-500' },
  Offense: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', dot: 'bg-amber-500' },
  Food: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200', dot: 'bg-green-500' },
  Utility: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', dot: 'bg-blue-500' },
  Bond: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200', dot: 'bg-purple-500' },
};

const PET_ATTRIBUTES = [
  { key: 'CA_Animal_Health', label: 'Health', icon: '❤️', color: 'bg-red-500' },
  { key: 'CA_Animal_Stamina', label: 'Stamina', icon: '💛', color: 'bg-amber-500' },
  { key: 'CA_Animal_Damage', label: 'Damage', icon: '⚔️', color: 'bg-orange-500' },
  { key: 'CA_Animal_Speed', label: 'Speed', icon: '⚡', color: 'bg-blue-500' },
];

/** Max companion level in the editor (game may differ). */
const PET_LEVEL_MAX = 110;

const PET_ICONS: Record<string, string> = {
  BlueTit_Domesticated: '🐦',
  AntWarrior_Black: '🐜',
  Albino_Scorpion: '🦂',
  Scorpion: '🦂',
  Hornet: '🐝',
  BP_Hawk: '🦅',
  BlueTit: '🐦',
};

function getPetIcon(classPath: string): string {
  for (const [key, icon] of Object.entries(PET_ICONS)) {
    if (classPath.includes(key)) return icon;
  }
  return '🐾';
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    Resources: '\u{1FAB5}', Minerals: '\u{1F48E}', Consumables: '\u{1F9EA}', Utility: '\u{1F527}',
    Tools: '\u{26CF}\u{FE0F}', Weapons: '\u{2694}\u{FE0F}', Ranged: '\u{1F3F9}', Gear: '\u{1FAB6}', Armor: '\u{1F6E1}\u{FE0F}',
    Eggs: '\u{1F95A}', Deployable: '\u{1F4CD}', Other: '\u{1F4E6}',
  };
  return icons[category] ?? '\u{1F4E6}';
}



function getOwningPlayer(save: WrappedSave) {
  const pcSerId = Object.keys(save.data.PlayerCharacter.Serialize)[0];
  return save.data.PlayerCharacter.Serialize[pcSerId]?.OwningPlayer;
}

interface PetViewModel {
  preserIdx: number;
  birdId: number;
  progId: number;
  class: string;
  stats: { Health: number; Energy: number };
  prog: { Level: number; XP: number; Attributes: Record<string, number>; Traits: string[]; OR: number };
  invItems: { Class: string; Id: number }[];
  charInvId?: number;
}

/** All numeric-key blobs under StoredTamedCreatures + top-level Serialize that belong to one companion. */
function collectTamedCreatureSerializeKeys(pet: {
  Id: number;
  CharInv?: { Id: number; InventoryItems?: { Id: number }[] };
  CharProgression?: { Id: number };
}): string[] {
  const keys = new Set<string>();
  keys.add(String(pet.Id));
  const pid = pet.CharProgression?.Id;
  if (pid) keys.add(String(pid));
  const ci = pet.CharInv;
  if (ci) {
    keys.add(String(ci.Id));
    for (const row of ci.InventoryItems ?? []) keys.add(String(row.Id));
  }
  return Array.from(keys);
}

function buildPetView(save: WrappedSave): PetViewModel[] {
  const crId = String(save.data.Preserialize.CreatureRelations?.Id ?? '');
  if (!crId || !save.data.Serialize[crId]) return [];
  const crBlock = save.data.Serialize[crId] as {
    StoredTamedCreatures?: {
      PreSerializeCreatures: { Class: string; Id: number; CharInv?: { Id: number; InventoryItems: { Class: string; Id: number }[] }; CharProgression?: { Id: number } }[];
      [key: string]: unknown;
    };
  };
  const stc = crBlock.StoredTamedCreatures;
  if (!stc) return [];

  return stc.PreSerializeCreatures.map((pc, i) => {
    const progId = pc.CharProgression?.Id ?? 0;
    const stats = (stc[String(pc.Id)] as { Health: number; Energy: number } | undefined) ?? { Health: 1000, Energy: 100 };
    const prog = (stc[String(progId)] as { Level: number; XP: number; Attributes: Record<string, number>; Traits: string[]; OR: number } | undefined) ?? {
      Level: 1, XP: 0, Attributes: {}, Traits: [], OR: 50,
    };
    return {
      preserIdx: i, birdId: pc.Id, progId, class: pc.Class,
      stats, prog, invItems: pc.CharInv?.InventoryItems ?? [], charInvId: pc.CharInv?.Id,
    };
  });
}

const PetsPanel = forwardRef<SaveMergePanelRef, Props>(function PetsPanel({ save, setSave, fileEpoch, onDraftCommitted }, ref) {
  const { items, itemCategories, pets: apiPets, getItemName, getItemCategory } = useItemCatalog();
  const invTraitPath = apiPets.increasedInventoryTraitPath;
  const bondStrengthPaths = apiPets.bondStrengthPaths;
  const knownTraitSet = useMemo(() => new Set(apiPets.traits.map(t => t.path)), [apiPets.traits]);

  const petItemCategoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    counts.set('All', items.length);
    for (const cat of itemCategories) {
      if (cat === 'All') continue;
      counts.set(cat, items.filter(i => i.category === cat).length);
    }
    return counts;
  }, [items, itemCategories]);

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
    mergeInto: (base: WrappedSave) => mergePetsDraftInto(base, draftRef.current),
  }), []);

  const pets = buildPetView(draft);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [newPetClass, setNewPetClass] = useState(() => apiPets.classes[0]?.class ?? '');
  const [showAddPet, setShowAddPet] = useState(false);
  const [newPetSpeciesSearch, setNewPetSpeciesSearch] = useState('');
  const [speciesPickerOpen, setSpeciesPickerOpen] = useState(false);
  const speciesPickerRef = useRef<HTMLDivElement>(null);

  const filteredSpecies = useMemo(() => {
    const q = newPetSpeciesSearch.trim().toLowerCase();
    if (!q) return apiPets.classes;
    return apiPets.classes.filter(
      pc => pc.name.toLowerCase().includes(q) || pc.class.toLowerCase().includes(q),
    );
  }, [apiPets.classes, newPetSpeciesSearch]);

  useEffect(() => {
    if (filteredSpecies.length === 0) return;
    if (!filteredSpecies.some(pc => pc.class === newPetClass)) {
      setNewPetClass(filteredSpecies[0].class);
    }
  }, [filteredSpecies, newPetClass]);

  useEffect(() => {
    if (!speciesPickerOpen) return;
    const onDown = (e: MouseEvent) => {
      const el = speciesPickerRef.current;
      if (el && !el.contains(e.target as Node)) setSpeciesPickerOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSpeciesPickerOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [speciesPickerOpen]);

  useEffect(() => {
    if (!showAddPet) setSpeciesPickerOpen(false);
  }, [showAddPet]);

  const selectedNewSpecies = useMemo(
    () => filteredSpecies.find(pc => pc.class === newPetClass),
    [filteredSpecies, newPetClass],
  );

  // Add item to pet states
  const [addingItemForPet, setAddingItemForPet] = useState<number | null>(null);
  const [petItemSearch, setPetItemSearch] = useState('');
  const [petItemCat, setPetItemCat] = useState('All');
  const [petItemQty, setPetItemQty] = useState(100);
  const [petItemMaxStack, setPetItemMaxStack] = useState(50);
  const [petItemDur, setPetItemDur] = useState(9999);
  const [petItemEpic, setPetItemEpic] = useState(true);
  const [selectedPetItem, setSelectedPetItem] = useState<string | null>(null);
  const [petItemImgFailed, setPetItemImgFailed] = useState<Set<string>>(() => new Set());
  const [petPortraitFailed, setPetPortraitFailed] = useState<Set<number>>(() => new Set());

  const filteredPetItems = useMemo(() => {
    return items.filter(item => {
      const matchCat = petItemCat === 'All' || item.category === petItemCat;
      const matchSearch = petItemSearch === '' || item.name.toLowerCase().includes(petItemSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [items, petItemSearch, petItemCat]);

  const updatePet = useCallback((birdId: number, progId: number, updates: {
    stats?: Partial<{ Health: number; Energy: number }>;
    prog?: Partial<{ Level: number; XP: number; Attributes: Record<string, number>; Traits: string[]; OR: number }>;
  }) => {
    setDraft(prev => {
      const newSave = cloneSave(prev);
      const crId = String(newSave.data.Preserialize.CreatureRelations?.Id ?? '');
      const stc = (newSave.data.Serialize[crId] as { StoredTamedCreatures: Record<string, unknown> }).StoredTamedCreatures;
      if (updates.stats) {
        const cur = (stc[String(birdId)] ?? {}) as Record<string, unknown>;
        stc[String(birdId)] = { ...cur, ...updates.stats };
      }
      if (updates.prog && progId) {
        const cur = (stc[String(progId)] ?? {}) as Record<string, unknown>;
        stc[String(progId)] = { ...cur, ...updates.prog };
      }
      return newSave;
    });
  }, []);

  const removePet = useCallback((birdId: number, preserIdx: number) => {
    setDraft(prev => {
      const newSave = cloneSave(prev);
      const crId = String(newSave.data.Preserialize.CreatureRelations?.Id ?? '');
      const stc = (newSave.data.Serialize[crId] as {
        StoredTamedCreatures?: {
          PreSerializeCreatures: {
            Id: number;
            CharInv?: { Id: number; InventoryItems?: { Id: number }[] };
            CharProgression?: { Id: number };
          }[];
          [k: string]: unknown;
        };
      } | undefined)?.StoredTamedCreatures;
      if (!stc?.PreSerializeCreatures) return newSave;
      const pc = stc.PreSerializeCreatures[preserIdx];
      if (!pc || pc.Id !== birdId) return newSave;

      const toRemove = collectTamedCreatureSerializeKeys(pc);
      const stcMap = stc as Record<string, unknown>;
      for (const k of toRemove) {
        delete stcMap[k];
        delete newSave.data.Serialize[k];
      }
      stc.PreSerializeCreatures.splice(preserIdx, 1);

      const stableId = newSave.data.Preserialize.CreatureStable?.Id;
      if (stableId != null) {
        const sb = newSave.data.Serialize[String(stableId)] as { SerializedAnimalEntries?: unknown[] } | undefined;
        const entries = sb?.SerializedAnimalEntries;
        if (Array.isArray(entries) && sb) {
          sb.SerializedAnimalEntries = entries.filter(e => {
            if (typeof e === 'number') return e !== birdId;
            if (e && typeof e === 'object' && 'Id' in e) {
              const id = (e as { Id: unknown }).Id;
              if (typeof id === 'number') return id !== birdId;
            }
            return true;
          });
        }
      }

      return newSave;
    });
    setExpanded(null);
  }, []);

  const addPet = useCallback(() => {
    if (!newPetClass.trim() || filteredSpecies.length === 0) return;
    setDraft(prev => {
    const newSave = cloneSave(prev);
    const crId = String(newSave.data.Preserialize.CreatureRelations?.Id ?? '');
    if (!newSave.data.Serialize[crId]) newSave.data.Serialize[crId] = {};
    const crBlock = newSave.data.Serialize[crId] as Record<string, unknown>;
    if (!crBlock.StoredTamedCreatures) {
      crBlock.StoredTamedCreatures = { Version: 2, PreSerializeCreatures: [] };
    }
    const stc = crBlock.StoredTamedCreatures as { PreSerializeCreatures: unknown[]; [k: string]: unknown };
    const nextId = getNextId(newSave);
    const progId = nextId + 1;
    const owning = getOwningPlayer(newSave);

    stc.PreSerializeCreatures.push({ Class: newPetClass, Id: nextId, CharProgression: { Id: progId } });
    stc[String(nextId)] = { Health: 9999, Energy: 999, OwningPlayer: owning };
    stc[String(progId)] = {
      Level: 50, XP: 2000,
      Attributes: { CA_Animal_Health: 50, CA_Animal_Stamina: 50, CA_Animal_Damage: 50, CA_Animal_Speed: 50 },
      Traits: [...apiPets.defaultNewPetTraitPaths],
      OR: 99.0,
    };
    return newSave;
    });
    setShowAddPet(false);
    setNewPetSpeciesSearch('');
  }, [newPetClass, apiPets.defaultNewPetTraitPaths, filteredSpecies.length]);

  const addItemToPet = useCallback((petPreserIdx: number) => {
    if (!selectedPetItem) return;
    const itemDef = getItemDefinition(selectedPetItem);
    if (!itemDef) return;

    const maxStack = itemDef.kind === 'stack' ? petItemMaxStack : 1;
    const quantities = quantitiesPerSlotForAdd(itemDef.kind, petItemQty, maxStack);
    if (quantities.length === 0) return;

    const snap = draftRef.current;
    const crId = String(snap.data.Preserialize.CreatureRelations?.Id ?? '');
    const crBlock = snap.data.Serialize[crId] as { StoredTamedCreatures?: { PreSerializeCreatures: { CharInv?: { Id: number; InventoryItems: { Class: string; Id: number }[] }; CharProgression?: { Id: number } }[] } } | undefined;
    const stc0 = crBlock?.StoredTamedCreatures;
    const petPreser0 = stc0?.PreSerializeCreatures[petPreserIdx];
    if (!petPreser0 || !stc0) return;
    const progId0 = petPreser0.CharProgression?.Id ?? 0;
    const progBlock0 = ((stc0 as Record<string, unknown>)[String(progId0)] as { Traits?: string[] } | undefined) ?? {};
    const invStacks0 = (progBlock0.Traits ?? []).filter(x => x === invTraitPath).length;
    if (invStacks0 < 1) return;
    const invCount0 = petPreser0.CharInv?.InventoryItems?.length ?? 0;
    const slotCap0 = getPetInventorySlotCap(invStacks0);
    const available0 = slotCap0 - invCount0;
    if (quantities.length > available0) {
      toast.error('Not enough companion inventory slots', {
        description: `Need ${quantities.length} empty slot(s), ${available0} available.`,
      });
      return;
    }

    setDraft(prev => {
      const newSave = cloneSave(prev);
      const crId2 = String(newSave.data.Preserialize.CreatureRelations?.Id ?? '');
      const crBlock2 = newSave.data.Serialize[crId2] as { StoredTamedCreatures: { PreSerializeCreatures: { CharInv?: { Id: number; InventoryItems: { Class: string; Id: number }[] }; CharProgression?: { Id: number } }[]; [k: string]: unknown } };
      const stc = crBlock2.StoredTamedCreatures;
      const petPreser = stc.PreSerializeCreatures[petPreserIdx];
      const progId = petPreser.CharProgression?.Id ?? 0;
      const progBlock = (stc[String(progId)] as { Traits?: string[] } | undefined) ?? {};
      const invStacks = (progBlock.Traits ?? []).filter(x => x === invTraitPath).length;
      if (invStacks < 1) return prev;

      if (!petPreser.CharInv) {
        const charInvId = getNextId(newSave);
        petPreser.CharInv = { Id: charInvId, InventoryItems: [] };
        stc[String(charInvId)] = { InventoryItems: [] };
      }

      const charInvId = petPreser.CharInv.Id;
      const petInvSer = (stc[String(charInvId)] ?? { InventoryItems: [] }) as { InventoryItems: { Id: number; Idx: number }[] };
      let maxIdx = petInvSer.InventoryItems?.length ? Math.max(...petInvSer.InventoryItems.map(e => e.Idx)) : -1;

      for (const q of quantities) {
        const itemId = getNextId(newSave);
        let serEntry: Record<string, unknown> = {};
        if (itemDef.kind === 'stack') serEntry = { Quantity: q };
        else if (itemDef.kind === 'epic') serEntry = { Durability: petItemDur, QualityLevel: 4, TierOverride: 7 };
        else serEntry = { Durability: petItemDur };
        if (petItemEpic && itemDef.kind !== 'stack') {
          serEntry.QualityLevel = 4;
          serEntry.TierOverride = 7;
        }
        petPreser.CharInv.InventoryItems.push({ Class: itemDef.class, Id: itemId });
        maxIdx += 1;
        petInvSer.InventoryItems.push({ Id: itemId, Idx: maxIdx });
        stc[String(charInvId)] = petInvSer;
        stc[String(itemId)] = serEntry;
      }

      return newSave;
    });
    setSelectedPetItem(null);
    setAddingItemForPet(null);
  }, [selectedPetItem, petItemQty, petItemMaxStack, petItemDur, petItemEpic, invTraitPath]);

  const handleReset = () => setDraft(cloneSave(save));
  const handleApply = () => {
    setSave(cloneSave(draft));
    onDraftCommitted?.();
    toast.success('\u0e19\u0e33\u0e01\u0e32\u0e23\u0e41\u0e01\u0e49\u0e44\u0e02\u0e44\u0e1b\u0e43\u0e0a\u0e49\u0e41\u0e25\u0e49\u0e27', { description: 'Companions' });
  };

  const toggleTrait = useCallback((petBirdId: number, petProgId: number, traitPath: string, currentTraits: string[]) => {
    if (traitPath === invTraitPath) return;
    if (bondStrengthPaths.includes(traitPath)) {
      const hadThis = currentTraits.includes(traitPath);
      const withoutBond = currentTraits.filter(t => !bondStrengthPaths.includes(t));
      const newTraits = hadThis ? withoutBond : [...withoutBond, traitPath];
      updatePet(petBirdId, petProgId, { prog: { Traits: newTraits } });
      return;
    }
    const has = currentTraits.includes(traitPath);
    const newTraits = has ? currentTraits.filter(t => t !== traitPath) : [...currentTraits, traitPath];
    updatePet(petBirdId, petProgId, { prog: { Traits: newTraits } });
  }, [updatePet, invTraitPath, bondStrengthPaths]);

  const setIncreasedInventoryStacks = useCallback((petBirdId: number, petProgId: number, currentTraits: string[], stacks: number) => {
    const n = Math.max(0, Math.min(PET_INCREASED_INVENTORY_MAX_STACKS, stacks));
    const rest = currentTraits.filter(t => t !== invTraitPath);
    const stacksArr = Array.from({ length: n }, () => invTraitPath);
    updatePet(petBirdId, petProgId, { prog: { Traits: [...rest, ...stacksArr] } });
  }, [updatePet, invTraitPath]);

  const traitsByCategory = useMemo(() => {
    return apiPets.traits.reduce((acc, t) => {
      if (!acc[t.category]) acc[t.category] = [];
      acc[t.category].push(t);
      return acc;
    }, {} as Record<string, PetTraitRow[]>);
  }, [apiPets.traits]);

  useEffect(() => {
    if (addingItemForPet == null) return;
    const list = buildPetView(draft);
    const pet = list[addingItemForPet];
    if (!pet || !pet.prog.Traits.includes(invTraitPath)) {
      setAddingItemForPet(null);
      setSelectedPetItem(null);
    }
  }, [draft, addingItemForPet, invTraitPath]);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-100 bg-white px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Companions</h2>
            <p className="mt-0.5 text-sm text-gray-400">
              {pets.length} companion{pets.length !== 1 ? 's' : ''} · Draft edits until you apply
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              <RotateCcw size={12} /> Reset
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex items-center gap-1.5 rounded-lg bg-linear-to-r from-teal-500 to-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:shadow-md"
            >
              <Save size={12} /> Apply Changes
            </button>
            <button
              type="button"
              onClick={() => setShowAddPet(v => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-all ${showAddPet ? 'border border-gray-200 bg-gray-100 text-gray-700' : 'bg-linear-to-r from-teal-500 to-emerald-600 text-white hover:shadow-md'}`}
            >
              <Plus size={13} /> {showAddPet ? 'Close form' : 'Add Companion'}
            </button>
          </div>
        </div>

        {showAddPet && (
          <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3">
            <h3 className="mb-1.5 text-sm font-semibold text-gray-800">New companion</h3>
            <p className="mb-2 text-[10px] text-gray-500">
              {apiPets.classes.length} species in catalog{filteredSpecies.length !== apiPets.classes.length ? ` · ${filteredSpecies.length} match filter` : ''}
            </p>
            <div className="mb-2">
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-gray-400">Search species</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={newPetSpeciesSearch}
                  onChange={e => setNewPetSpeciesSearch(e.target.value)}
                  placeholder="Filter by name or path…"
                  className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto_auto]">
              <div ref={speciesPickerRef} className="relative">
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-gray-400">Species</label>
                <button
                  type="button"
                  disabled={filteredSpecies.length === 0}
                  onClick={() => setSpeciesPickerOpen(o => !o)}
                  className="flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-white py-1.5 pl-2 pr-2 text-left text-sm transition-colors hover:bg-gray-50/80 focus:outline-none focus:ring-2 focus:ring-teal-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-haspopup="listbox"
                  aria-expanded={speciesPickerOpen}
                >
                  {selectedNewSpecies ? (
                    <>
                      <WikiPetThumbImg
                        petLabel={selectedNewSpecies.name}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded-md border border-gray-100 bg-gray-50 object-cover"
                      />
                      <span className="min-w-0 flex-1 truncate font-medium text-gray-900">{selectedNewSpecies.name}</span>
                    </>
                  ) : (
                    <span className="flex-1 truncate pl-1 text-gray-400">No matches</span>
                  )}
                  <ChevronDown size={14} className={`shrink-0 text-gray-400 transition-transform ${speciesPickerOpen ? 'rotate-180' : ''}`} />
                </button>
                {speciesPickerOpen && filteredSpecies.length > 0 && (
                  <ul
                    className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                    role="listbox"
                  >
                    {filteredSpecies.map(pc => {
                      const isSel = pc.class === newPetClass;
                      return (
                        <li key={pc.class} role="option" aria-selected={isSel}>
                          <button
                            type="button"
                            onClick={() => {
                              setNewPetClass(pc.class);
                              setSpeciesPickerOpen(false);
                            }}
                            className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm transition-colors ${isSel ? 'bg-teal-50 text-teal-900' : 'text-gray-800 hover:bg-gray-50'}`}
                          >
                            <WikiPetThumbImg
                              petLabel={pc.name}
                              alt=""
                              className="h-8 w-8 shrink-0 rounded-md border border-gray-100 bg-gray-50 object-cover"
                            />
                            <span className="min-w-0 flex-1 truncate">{pc.name}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <button type="button" onClick={() => { setShowAddPet(false); setNewPetSpeciesSearch(''); }} className="rounded-lg bg-white px-3.5 py-1.5 text-xs font-medium text-gray-600 ring-1 ring-gray-200 transition-colors hover:bg-gray-50">Cancel</button>
              <button type="button" disabled={filteredSpecies.length === 0 || !newPetClass} onClick={addPet} className="inline-flex items-center justify-center gap-1 rounded-lg bg-linear-to-r from-teal-500 to-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:shadow-md disabled:pointer-events-none disabled:opacity-40">
                <Plus size={13} /> Create
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-gray-500">Creates with Lv50, high stats, default traits, and 1× Increased Inventory — adjust after adding.</p>
          </div>
        )}
      </div>

      {/* Empty state */}
      {pets.length === 0 && !showAddPet && (
        <div className="py-20 text-center">
          <span className="mb-3 block text-5xl">🐾</span>
          <p className="text-sm text-gray-400 mb-4">No companions found in this save.</p>
          <button onClick={() => setShowAddPet(true)} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-linear-to-r from-teal-500 to-emerald-600 rounded-lg">
            <Plus size={13} /> Add your first companion
          </button>
        </div>
      )}

      {/* Pet List */}
      <div className="space-y-3">
        {pets.map(pet => {
          const isOpen = expanded === pet.preserIdx;
          const petDef = apiPets.classes.find(pc => pc.class === pet.class);
          const petName = petDef?.name ?? pet.class.split('/').pop()?.split('.')[0]?.replace(/^BP_/, '').replace(/_/g, ' ') ?? 'Unknown';
          const petIcon = getPetIcon(pet.class);
          const petAttrMax = Math.max(1, Number(pet.prog.Level) || 1);
          const increasedInvStacks = pet.prog.Traits.filter(x => x === invTraitPath).length;
          const unknownTraitPaths = [...new Set(pet.prog.Traits)].filter(t => !knownTraitSet.has(t));
          const hasIncreasedInventory = increasedInvStacks > 0;
          const petInvSlotCap = getPetInventorySlotCap(increasedInvStacks);
          const canAddToPetInventory = hasIncreasedInventory && pet.invItems.length < petInvSlotCap;
          const petInvSlotsLabel = `${pet.invItems.length}/${petInvSlotCap}`;

          return (
            <div key={pet.birdId} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {/* Pet header: collapsible summary + delete (always visible) */}
              <div className="flex w-full items-stretch gap-1">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-gray-50/50"
                  onClick={() => setExpanded(isOpen ? null : pet.preserIdx)}
                  aria-expanded={isOpen}
                >
                  {!petPortraitFailed.has(pet.birdId) ? (
                    <WikiPetThumbImg
                      petLabel={petName}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-lg border border-gray-100 bg-gray-50 object-cover"
                      onBothFailed={() => setPetPortraitFailed(prev => new Set(prev).add(pet.birdId))}
                    />
                  ) : (
                    <span className="shrink-0 text-3xl leading-none" aria-hidden>{petIcon}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-900">{petName}</div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                      <span>Lv {pet.prog.Level}</span>
                      <span className="w-1 h-1 rounded-full bg-gray-300" />
                      <span>HP {Math.round(pet.stats.Health)}</span>
                      <span className="w-1 h-1 rounded-full bg-gray-300" />
                      <span>{pet.prog.Traits.length} traits</span>
                      {pet.invItems.length > 0 && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-gray-300" />
                          <span>{pet.invItems.length} items</span>
                        </>
                      )}
                    </div>
                  </div>
                  {isOpen ? <ChevronUp size={15} className="shrink-0 text-gray-400" /> : <ChevronDown size={15} className="shrink-0 text-gray-400" />}
                </button>
                <button
                  type="button"
                  title="Remove companion"
                  aria-label={`Remove companion ${petName}`}
                  onClick={() => removePet(pet.birdId, pet.preserIdx)}
                  className="my-1.5 mr-2 inline-flex shrink-0 items-center justify-center rounded-lg border border-red-100 bg-red-50/80 px-2.5 text-red-600 transition-colors hover:bg-red-100"
                >
                  <Trash2 size={14} strokeWidth={2} />
                </button>
              </div>

              {/* Expanded Content */}
              {isOpen && (
                <div className="space-y-3 border-t border-gray-100 px-4 pb-3 pt-3">
                  {/* Stats & Attributes - Two columns */}
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {/* Stats */}
                    <div className="space-y-2.5 rounded-xl bg-gray-50 px-3.5 py-3">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Stats</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: 'Health', key: 'Health' as const, max: 9999, field: 'stats' as const },
                          { label: 'Energy', key: 'Energy' as const, max: 999, field: 'stats' as const },
                        ].map(s => (
                          <div key={s.key}>
                            <label className="block text-[10px] font-medium text-gray-400 mb-1">{s.label}</label>
                            <div className="flex gap-1">
                              <input className="flex-1 px-2 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30" type="number" value={Math.round(pet.stats[s.key])} onChange={e => updatePet(pet.birdId, pet.progId, { stats: { [s.key]: Number(e.target.value) || 0 } })} />
                              <button onClick={() => updatePet(pet.birdId, pet.progId, { stats: { [s.key]: s.max } })} className="px-1.5 text-[9px] font-bold text-teal-600 bg-teal-50 rounded hover:bg-teal-100">MAX</button>
                            </div>
                          </div>
                        ))}
                        <div>
                          <label className="block text-[10px] font-medium text-gray-400 mb-1">Level</label>
                          <input
                            className="w-full px-2 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                            type="number"
                            min={1}
                            max={PET_LEVEL_MAX}
                            value={pet.prog.Level}
                            onChange={e => {
                              const lv = Math.max(1, Math.min(PET_LEVEL_MAX, Number(e.target.value) || 1));
                              const newAttrs = { ...pet.prog.Attributes };
                              for (const a of PET_ATTRIBUTES) {
                                const v = Number(newAttrs[a.key] ?? 0);
                                newAttrs[a.key] = Math.min(lv, Math.max(0, v));
                              }
                              updatePet(pet.birdId, pet.progId, { prog: { Level: lv, Attributes: newAttrs } });
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-400 mb-1">XP</label>
                          <input className="w-full px-2 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30" type="number" value={pet.prog.XP} onChange={e => updatePet(pet.birdId, pet.progId, { prog: { XP: Number(e.target.value) || 0 } })} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-gray-400 mb-1">OR (Overcharge)</label>
                        <input className="w-full px-2 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30" type="number" step="0.1" value={pet.prog.OR ?? 50} onChange={e => updatePet(pet.birdId, pet.progId, { prog: { OR: Number(e.target.value) || 0 } })} />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const lv = PET_LEVEL_MAX;
                          const newAttrs = { ...pet.prog.Attributes };
                          for (const a of PET_ATTRIBUTES) {
                            const v = Number(newAttrs[a.key] ?? 0);
                            newAttrs[a.key] = Math.min(lv, Math.max(0, v));
                          }
                          updatePet(pet.birdId, pet.progId, { stats: { Health: 9999, Energy: 999 }, prog: { Level: lv, XP: 99999, OR: 99, Attributes: newAttrs } });
                        }}
                        className="w-full py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                      >
                        ⚡ Max All Stats
                      </button>
                    </div>

                    {/* Attributes */}
                    <div className="space-y-2.5 rounded-xl bg-gray-50 px-3.5 py-3">
                      <div className="flex flex-col gap-0.5">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Attributes</h4>
                        <span className="text-[10px] text-gray-400">Cap equals companion level ({petAttrMax})</span>
                      </div>
                      {PET_ATTRIBUTES.map(attr => (
                        <div key={attr.key}>
                          <label className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400 mb-1">
                            <span>{attr.icon}</span> {attr.label}
                          </label>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${attr.color}`} style={{ width: `${Math.min(100, ((pet.prog.Attributes[attr.key] ?? 0) / petAttrMax) * 100)}%` }} />
                            </div>
                            <input
                              className="w-14 px-2 py-1 text-xs text-right bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                              type="number"
                              min={0}
                              max={petAttrMax}
                              value={pet.prog.Attributes[attr.key] ?? 0}
                              onChange={e => {
                                const n = Number(e.target.value) || 0;
                                const newAttrs = { ...pet.prog.Attributes, [attr.key]: Math.min(petAttrMax, Math.max(0, n)) };
                                updatePet(pet.birdId, pet.progId, { prog: { Attributes: newAttrs } });
                              }}
                            />
                            <button
                              type="button"
                              title={`Set to level cap (${petAttrMax})`}
                              onClick={() => {
                                const newAttrs = { ...pet.prog.Attributes, [attr.key]: petAttrMax };
                                updatePet(pet.birdId, pet.progId, { prog: { Attributes: newAttrs } });
                              }}
                              className="min-w-8 px-1.5 text-[9px] font-bold text-teal-600 bg-teal-50 rounded hover:bg-teal-100"
                            >
                              {petAttrMax}
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const maxAttrs: Record<string, number> = {};
                          PET_ATTRIBUTES.forEach(a => { maxAttrs[a.key] = petAttrMax; });
                          updatePet(pet.birdId, pet.progId, { prog: { Attributes: maxAttrs } });
                        }}
                        className="w-full py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                      >
                        ⚡ Max All Attributes (Lv {petAttrMax})
                      </button>
                    </div>
                  </div>

                  {/* Traits */}
                  <div className="rounded-xl bg-gray-50 px-3.5 py-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                        <Star size={12} /> Traits
                      </h4>
                      <span className="text-[10px] font-medium text-gray-400">{pet.prog.Traits.length} selected</span>
                    </div>
                    <div className="space-y-2">
                      {Object.entries(traitsByCategory).map(([cat, traits]) => {
                        const colors = TRAIT_CAT_COLORS[cat] ?? TRAIT_CAT_COLORS.Utility;
                        return (
                          <div key={cat}>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                              <span className={`text-[10px] font-semibold uppercase tracking-wider ${colors.text}`}>{cat}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {traits.map(t => {
                                if (t.path === invTraitPath) {
                                  const n = pet.prog.Traits.filter(x => x === invTraitPath).length;
                                  return (
                                    <div
                                      key={t.path}
                                      className={`w-full rounded-lg border px-2.5 py-1.5 ${n > 0 ? `${colors.bg} ${colors.border}` : 'border-gray-200 bg-white'}`}
                                    >
                                      <div className="flex min-w-0 flex-nowrap items-center gap-2">
                                        <span
                                          className={`min-w-0 shrink truncate text-[11px] font-medium ${n > 0 ? colors.text : 'text-gray-600'}`}
                                          title={t.name}
                                        >
                                          {t.name}
                                        </span>
                                        <div className="ml-auto flex shrink-0 items-center gap-1.5">
                                          <button
                                            type="button"
                                            aria-label="Decrease Increased Inventory stacks"
                                            disabled={n <= 0}
                                            onClick={() => setIncreasedInventoryStacks(pet.birdId, pet.progId, pet.prog.Traits, n - 1)}
                                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                                          >
                                            <Minus size={12} />
                                          </button>
                                          <span className="min-w-8 text-center text-xs font-semibold tabular-nums text-gray-900">{n}</span>
                                          <button
                                            type="button"
                                            aria-label="Increase Increased Inventory stacks"
                                            disabled={n >= PET_INCREASED_INVENTORY_MAX_STACKS}
                                            onClick={() => setIncreasedInventoryStacks(pet.birdId, pet.progId, pet.prog.Traits, n + 1)}
                                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                                          >
                                            <Plus size={12} />
                                          </button>
                                          <span className="shrink-0 text-[10px] whitespace-nowrap text-gray-400">/ {PET_INCREASED_INVENTORY_MAX_STACKS}</span>
                                        </div>
                                      </div>
                                      <p className="mt-1 text-[9px] leading-snug text-gray-400">
                                        Each stack +{PET_INVENTORY_SLOTS_PER_INV_STACK} slots (max {getPetInventorySlotCap(PET_INCREASED_INVENTORY_MAX_STACKS)} at {PET_INCREASED_INVENTORY_MAX_STACKS} stacks).
                                      </p>
                                    </div>
                                  );
                                }
                                const hasIt = pet.prog.Traits.includes(t.path);
                                return (
                                  <button
                                    type="button"
                                    key={t.path}
                                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all ${hasIt ? `${colors.bg} ${colors.text} ${colors.border}` : 'border-gray-200 bg-white text-gray-400 hover:bg-gray-50'}`}
                                    onClick={() => toggleTrait(pet.birdId, pet.progId, t.path, pet.prog.Traits)}
                                  >
                                    {t.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      {unknownTraitPaths.length > 0 && (
                        <div className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-2.5 py-2">
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-900/90">From save · not in list</p>
                          <p className="mb-1.5 text-[9px] leading-snug text-amber-900/70">Paths on this companion that are not in the editor catalog. Remove if you want to clean the save.</p>
                          <div className="flex flex-col gap-1">
                            {unknownTraitPaths.map(path => (
                              <div key={path} className="flex items-start gap-2 rounded-md border border-amber-100 bg-white/90 px-2 py-1.5">
                                <span className="min-w-0 flex-1 break-all font-mono text-[9px] text-gray-700" title={path}>{path}</span>
                                <button
                                  type="button"
                                  className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-50"
                                  onClick={() => {
                                    const next = pet.prog.Traits.filter(t => t !== path);
                                    updatePet(pet.birdId, pet.progId, { prog: { Traits: next } });
                                  }}
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pet Inventory */}
                  <div className="rounded-xl bg-gray-50 px-3.5 py-3">
                    <div className="mb-1.5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                          <Package size={12} /> Pet Inventory
                        </h4>
                        <p className="mt-1 max-w-md text-[10px] leading-snug text-gray-400">
                          Base {PET_INVENTORY_BASE_SLOTS} slots. Stack <span className="font-medium text-gray-600">Increased Inventory</span> (Utility, 1–{PET_INCREASED_INVENTORY_MAX_STACKS}) for +{PET_INVENTORY_SLOTS_PER_INV_STACK} slots per stack. Current: <span className="font-mono text-gray-600">{petInvSlotsLabel}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!canAddToPetInventory}
                        title={
                          !hasIncreasedInventory
                            ? 'Select Increased Inventory under Utility traits to enable adding items.'
                            : pet.invItems.length >= petInvSlotCap
                              ? `Pet inventory is full (${petInvSlotCap} slots).`
                              : 'Add item to this companion'
                        }
                        onClick={() => {
                          if (!canAddToPetInventory) return;
                          setAddingItemForPet(addingItemForPet === pet.preserIdx ? null : pet.preserIdx);
                          setSelectedPetItem(null);
                        }}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-600 transition-colors hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-teal-50"
                      >
                        <Plus size={12} /> Add Item
                      </button>
                    </div>

                    {pet.invItems.length === 0 && addingItemForPet !== pet.preserIdx && (
                      <p className="text-xs text-gray-400 py-2">No items in pet inventory</p>
                    )}

                    {pet.invItems.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {pet.invItems.map(item => {
                          const ser = resolveItemSerialize(draft, item.Id);
                          const qtyRaw = ser.Quantity;
                          const hasQty = qtyRaw != null && Number.isFinite(Number(qtyRaw));
                          const qty = hasQty ? Math.max(1, Math.floor(Number(qtyRaw))) : null;
                          const displayName = getItemName(item.Class);
                          const cat = getItemCategory(item.Class);
                          const imgKey = `inv:${item.Id}`;
                          const showImg = !petItemImgFailed.has(imgKey);
                          return (
                            <div key={item.Id} className="flex items-center gap-2 px-2 py-2 bg-white rounded-lg border border-gray-100 min-w-0">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-100 bg-gray-50">
                                {showImg ? (
                                  <WikiThumbImg
                                    displayName={displayName}
                                    alt=""
                                    className="h-full w-full object-cover"
                                    onBothFailed={() => setPetItemImgFailed(prev => new Set(prev).add(imgKey))}
                                  />
                                ) : (
                                  <span className="text-base leading-none" aria-hidden>{getCategoryIcon(cat)}</span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[11px] font-medium text-gray-800 leading-tight">{displayName}</div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1">
                                  {qty != null && (
                                    <span className="text-[10px] font-semibold tabular-nums text-green-800 bg-green-50 px-1.5 py-0.5 rounded ring-1 ring-green-100/80">×{qty}</span>
                                  )}
                                  {ser.QualityLevel === 4 && <span className="text-[9px] font-medium text-amber-700 bg-amber-50 px-1 py-0.5 rounded">Epic</span>}
                                  {ser.Durability !== undefined && ser.QualityLevel !== 4 && (
                                    <span className="text-[9px] font-medium text-blue-700 bg-blue-50 px-1 py-0.5 rounded">{Math.round(ser.Durability)} HP</span>
                                  )}
                                </div>
                                <div className="truncate text-[9px] text-gray-400 mt-0.5">{cat}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Add Item to Pet Panel */}
                    {addingItemForPet === pet.preserIdx && (
                      <div className="border-t border-gray-200 pt-3 mt-3 space-y-3">
                        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-teal-500/30">
                          <Search size={12} className="text-gray-400" />
                          <input className="w-full bg-transparent text-xs outline-none placeholder:text-gray-400" placeholder="Search items..." value={petItemSearch} onChange={e => setPetItemSearch(e.target.value)} />
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {itemCategories.map(cat => (
                            <button key={cat} className={`px-2 py-0.5 text-[9px] font-medium rounded-full transition-colors ${petItemCat === cat ? 'bg-teal-500 text-white' : 'bg-white text-gray-400 hover:bg-gray-100'}`} onClick={() => setPetItemCat(cat)}>{cat} ({petItemCategoryCounts.get(cat) ?? 0})</button>
                          ))}
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {filteredPetItems.map(item => {
                            const pickKey = `pick:${item.class}`;
                            const showPickImg = !petItemImgFailed.has(pickKey);
                            return (
                              <button
                                key={item.class}
                                type="button"
                                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition-all ${selectedPetItem === item.class ? 'bg-teal-50 ring-1 ring-teal-300' : 'bg-white hover:bg-gray-50'}`}
                                onClick={() => setSelectedPetItem(selectedPetItem === item.class ? null : item.class)}
                              >
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-100 bg-gray-50">
                                  {showPickImg ? (
                                    <WikiThumbImg
                                      displayName={item.name}
                                      alt=""
                                      className="h-full w-full object-cover"
                                      onBothFailed={() => setPetItemImgFailed(prev => new Set(prev).add(pickKey))}
                                    />
                                  ) : (
                                    <span className="text-base leading-none" aria-hidden>{getCategoryIcon(item.category)}</span>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-gray-800">{item.name}</div>
                                  <div className="text-[9px] text-gray-400">{item.category}</div>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-0.5">
                                  <span className={`px-1.5 py-0.5 text-[8px] font-medium rounded ${item.kind === 'epic' ? 'bg-amber-100 text-amber-600' : item.kind === 'stack' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>{item.kind}</span>
                                  {item.kind === 'stack' && (
                                    <span className="text-[10px] font-semibold tabular-nums text-gray-600">{petItemQty} total · {petItemMaxStack}/slot</span>
                                  )}
                                  {item.kind !== 'stack' && (
                                    <span className="text-[10px] font-medium tabular-nums text-gray-500">×{petItemQty} · {petItemEpic ? 'Epic' : `${petItemDur} HP`}</span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {selectedPetItem && (() => {
                          const item = getItemDefinition(selectedPetItem);
                          if (!item) return null;
                          const detailKey = `detail:${item.class}`;
                          const showDetailImg = !petItemImgFailed.has(detailKey);
                          return (
                            <div className="bg-white rounded-lg border border-teal-200 p-3 space-y-2">
                              <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-teal-100 bg-gray-50">
                                  {showDetailImg ? (
                                    <WikiThumbImg
                                      displayName={item.name}
                                      alt=""
                                      className="h-full w-full object-cover"
                                      onBothFailed={() => setPetItemImgFailed(prev => new Set(prev).add(detailKey))}
                                    />
                                  ) : (
                                    <span className="text-xl leading-none" aria-hidden>{getCategoryIcon(item.category)}</span>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-semibold text-gray-800">{item.name}</div>
                                  <div className="text-[10px] text-gray-500">{item.category}</div>
                                  {item.kind === 'stack' ? (
                                    <div className="mt-1 text-[11px] font-semibold tabular-nums text-green-700">Total: {petItemQty} · max {petItemMaxStack}/slot</div>
                                  ) : (
                                    <div className="mt-1 text-[11px] text-gray-600">
                                      {petItemQty} slot(s) · {petItemEpic ? 'Epic (Tier 7)' : `${petItemDur} HP`}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {item.kind === 'stack' ? (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Layers size={10} className="text-gray-400" />
                                    <span className="text-[10px] text-gray-400">Total qty</span>
                                    <input type="number" className="flex-1 px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded focus:outline-none" min={1} value={petItemQty} onChange={e => setPetItemQty(Math.max(1, Number(e.target.value) || 1))} />
                                    <button type="button" onClick={() => setPetItemQty(9999)} className="text-[9px] font-bold text-teal-600">MAX</button>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-gray-400 shrink-0">Max/slot</span>
                                    <input type="number" className="flex-1 px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded focus:outline-none" min={1} max={9999} value={petItemMaxStack} onChange={e => setPetItemMaxStack(Math.max(1, Number(e.target.value) || 1))} />
                                    <button type="button" onClick={() => setPetItemMaxStack(50)} className="text-[9px] font-bold text-teal-600">50</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-gray-400">Count</span>
                                    <input type="number" className="flex-1 px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded focus:outline-none" min={1} value={petItemQty} onChange={e => setPetItemQty(Math.max(1, Number(e.target.value) || 1))} />
                                    <button type="button" onClick={() => setPetItemQty(100)} className="text-[9px] font-bold text-teal-600">100</button>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-gray-400">Dur</span>
                                    <input type="number" className="flex-1 px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded focus:outline-none" min={0} value={petItemDur} onChange={e => setPetItemDur(Number(e.target.value))} />
                                    <button type="button" onClick={() => setPetItemDur(9999)} className="text-[9px] font-bold text-teal-600">MAX</button>
                                  </div>
                                  <label className="flex items-center gap-2 text-[10px]">
                                    <input type="checkbox" checked={petItemEpic} onChange={e => setPetItemEpic(e.target.checked)} className="accent-amber-500" />
                                    <span className="text-amber-700 font-medium">Epic (Tier 7)</span>
                                  </label>
                                </>
                              )}
                              <button
                                type="button"
                                disabled={!canAddToPetInventory}
                                onClick={() => addItemToPet(pet.preserIdx)}
                                className="w-full rounded-lg bg-linear-to-r from-teal-500 to-emerald-600 py-2 text-xs font-semibold text-white transition-all hover:shadow disabled:cursor-not-allowed disabled:opacity-45"
                              >
                                <Plus size={11} className="mr-1 inline" />Add to {petName}
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default PetsPanel;
