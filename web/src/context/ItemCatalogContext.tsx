import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchItems, fetchPets, type AddItemFilter, type PetsAPIResponse } from '@/lib/api';
import type { ItemDefinition } from '@/lib/itemDatabaseTypes';
import {
  setItemCatalogPayload,
  setPetCatalogPayload,
  getItemName as storeGetItemName,
  getItemCategory as storeGetItemCategory,
  getItemDefinition,
} from '@/lib/itemCatalogStore';
import { Loader2 } from 'lucide-react';

export interface ItemCatalogContextValue {
  items: ItemDefinition[];
  itemCategories: string[];
  addFilters: AddItemFilter[];
  getItemName: (classPath: string) => string;
  getItemCategory: (classPath: string) => string;
  getItem: (classPath: string) => ItemDefinition | undefined;
  pets: PetsAPIResponse;
}

const ItemCatalogContext = createContext<ItemCatalogContextValue | null>(null);

function buildCategoryTabs(items: ItemDefinition[]): string[] {
  const cats = Array.from(new Set(items.map(i => i.category))).sort();
  return ['All', ...cats];
}

export function ItemCatalogProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<ItemCatalogContextValue | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [itemsRes, petsRes] = await Promise.all([fetchItems(), fetchPets()]);
        if (cancelled) return;
        setItemCatalogPayload(itemsRes.items, itemsRes.addFilters);
        setPetCatalogPayload(petsRes);
        const itemCategories = buildCategoryTabs(itemsRes.items);
        setValue({
          items: itemsRes.items,
          itemCategories,
          addFilters: itemsRes.addFilters,
          getItemName: storeGetItemName,
          getItemCategory: storeGetItemCategory,
          getItem: getItemDefinition,
          pets: petsRes,
        });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load catalog');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm font-medium text-red-600">Could not load item / pet catalog</p>
        <p className="max-w-md text-xs text-gray-500">{error}</p>
        <p className="text-xs text-gray-400">Start the Go server so /api/items and /api/pets are available.</p>
      </div>
    );
  }

  if (!value) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 text-gray-500">
        <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
        <p className="text-sm">Loading catalog…</p>
      </div>
    );
  }

  return <ItemCatalogContext.Provider value={value}>{children}</ItemCatalogContext.Provider>;
}

export function useItemCatalog(): ItemCatalogContextValue {
  const v = useContext(ItemCatalogContext);
  if (!v) throw new Error('useItemCatalog must be used inside ItemCatalogProvider');
  return v;
}

/** Optional: avoid throwing when provider is absent (not used if we always wrap). */
export function useItemCatalogOptional(): ItemCatalogContextValue | null {
  return useContext(ItemCatalogContext);
}
