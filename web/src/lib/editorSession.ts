import type { WrappedSave } from '@/lib/saveTypes';

const SESSION_KEY = 'smalland-web:editor-session';
const SESSION_VER = 1;

export type EditorSessionPayload = {
  v: number;
  filename: string;
  save: WrappedSave;
};

export function readEditorSession(): EditorSessionPayload | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as EditorSessionPayload;
    if (o.v !== SESSION_VER || !o.save?._meta || !o.save?.data || typeof o.filename !== 'string' || !o.filename) {
      return null;
    }
    return o;
  } catch {
    return null;
  }
}

export function writeEditorSession(filename: string, save: WrappedSave): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const payload: EditorSessionPayload = { v: SESSION_VER, filename, save };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('editorSession: write failed (quota?)', e);
  }
}

export function clearEditorSession(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}
