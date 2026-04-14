// API client for Go Fiber backend

import type { ItemDefinition } from '@/lib/itemDatabaseTypes';

const API_BASE = '/api';

/** Must match `maxPlrUploadBytes` in cmd/server/main.go */
export const MAX_PLR_UPLOAD_BYTES = 1024 * 1024;

function assertPlrFileName(file: File | Blob): void {
  const name = file instanceof File ? file.name : '';
  if (!name.toLowerCase().endsWith('.plr')) {
    throw new Error('Only .plr files are allowed');
  }
}

export interface EditorConfig {
  serverSaveAvailable: boolean;
  /** Absolute path the Go server reads/writes when serverSaveAvailable (Windows auto or SMALLAND_SAVE_DIR). */
  saveDirectory?: string;
  /** `windows_default` | `env` | `upload_only` */
  saveDirectorySource?: string;
}

export async function fetchEditorConfig(): Promise<EditorConfig> {
  const res = await fetch(`${API_BASE}/config`);
  if (!res.ok) {
    // Missing /api/config (very old binary) — prefer upload-only UX.
    return { serverSaveAvailable: false };
  }
  return res.json();
}

export interface SaveFileInfo {
  name: string;
  size: number;
  modifiedAt: string;
  hasBackup: boolean;
}

export async function listSaves(): Promise<SaveFileInfo[]> {
  const res = await fetch(`${API_BASE}/saves`);
  if (!res.ok) throw new Error('Failed to list saves');
  return res.json();
}

export async function loadSave(name: string) {
  const res = await fetch(`${API_BASE}/saves/${encodeURIComponent(name)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to load save');
  }
  return res.json();
}

/** Unpack a .plr file picked from disk (any folder). Sends raw bytes to server. */
export async function unpackPlrFile(file: File | Blob): Promise<unknown> {
  assertPlrFileName(file);
  if (file.size > MAX_PLR_UPLOAD_BYTES) {
    throw new Error(`File too large (max ${MAX_PLR_UPLOAD_BYTES / 1024 / 1024} MB)`);
  }
  const plrName = file instanceof File ? file.name : '';
  const res = await fetch(`${API_BASE}/unpack`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      ...(plrName ? { 'X-Plr-Filename': plrName } : {}),
    },
    body: file,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to unpack file');
  }
  return res.json();
}

/** Repack save JSON to .plr binary for download. */
export async function repackSaveToBlob(data: unknown, downloadName: string): Promise<Blob> {
  const q = encodeURIComponent(downloadName.replace(/\.plr$/i, '') + '.plr');
  const res = await fetch(`${API_BASE}/repack?name=${q}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to repack');
  }
  return res.blob();
}

export async function saveSave(name: string, data: unknown) {
  const res = await fetch(`${API_BASE}/saves/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to save');
  }
  return res.json();
}

export async function createBackup(name: string) {
  const res = await fetch(`${API_BASE}/saves/${encodeURIComponent(name)}/backup`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to create backup');
  return res.json();
}

export async function restoreBackup(name: string) {
  const res = await fetch(`${API_BASE}/saves/${encodeURIComponent(name)}/restore`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to restore backup');
  return res.json();
}

export interface AddItemFilter {
  key: string;
  label: string;
  classes: string[];
}

export interface ItemsAPIResponse {
  items: ItemDefinition[];
  addFilters: AddItemFilter[];
}

export async function fetchItems(): Promise<ItemsAPIResponse> {
  const res = await fetch(`${API_BASE}/items`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch items');
  return res.json();
}

export interface PetClassRow {
  class: string;
  name: string;
}

export interface PetTraitRow {
  path: string;
  name: string;
  category: string;
}

export interface PetsAPIResponse {
  classes: PetClassRow[];
  traits: PetTraitRow[];
  increasedInventoryTraitPath: string;
  bondTraitCategory: string;
  bondStrengthPaths: string[];
  defaultNewPetTraitPaths: string[];
}

export async function fetchPets(): Promise<PetsAPIResponse> {
  const res = await fetch(`${API_BASE}/pets`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch pets');
  return res.json();
}

export { getWikiItemImageUrl as getItemImageUrl } from '@/lib/wikiImages';
