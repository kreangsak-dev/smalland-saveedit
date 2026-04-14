import type { ItemDefinition } from './itemDatabaseTypes';
import type { AddItemFilter, PetsAPIResponse } from './api';

let itemsByClass = new Map<string, ItemDefinition>();
let addFiltersSnapshot: AddItemFilter[] = [];
let petCatalogSnapshot: PetsAPIResponse | null = null;

export function setItemCatalogPayload(items: ItemDefinition[], addFilters: AddItemFilter[]) {
  itemsByClass = new Map(items.map(i => [i.class, i]));
  addFiltersSnapshot = addFilters;
}

export function setPetCatalogPayload(pets: PetsAPIResponse) {
  petCatalogSnapshot = pets;
}

export function getAddFiltersSnapshot(): AddItemFilter[] {
  return addFiltersSnapshot;
}

export function getPetCatalogSnapshot() {
  return petCatalogSnapshot;
}

/** Fallback when class is not in server catalog (e.g. modded save). */
export function displayNameFromClassPath(classPath: string): string {
  const parts = classPath.split('/');
  const last = parts[parts.length - 1] ?? classPath;
  const name = last.split('.')[0].replace(/^BPI_/, '').replace(/^BP_/, '');
  return name.replace(/([A-Z])/g, ' $1').trim();
}

export function getItemName(classPath: string): string {
  return itemsByClass.get(classPath)?.name ?? displayNameFromClassPath(classPath);
}

export function getItemCategory(classPath: string): string {
  return itemsByClass.get(classPath)?.category ?? 'Unknown';
}

export function getItemDefinition(classPath: string): ItemDefinition | undefined {
  return itemsByClass.get(classPath);
}
