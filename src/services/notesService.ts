import { invoke } from '@tauri-apps/api/core';
import type { Note, NoteInput, NotePreview } from '../types';

function toError(e: unknown): Error {
  if (e && typeof e === 'object' && 'message' in e) return new Error(String((e as any).message));
  return new Error(String(e));
}

export const getNotes = async (): Promise<Note[]> => {
  try { return await invoke<Note[]>('get_notes'); } catch (e) { throw toError(e); }
};
export const getNote = async (id: string): Promise<Note> => {
  try { return await invoke<Note>('get_note', { id }); } catch (e) { throw toError(e); }
};
export const saveNote = async (note: NoteInput): Promise<Note> => {
  try { return await invoke<Note>('save_note', { note }); } catch (e) { throw toError(e); }
};
export const deleteNote = async (id: string): Promise<void> => {
  try { await invoke('delete_note', { id }); } catch (e) { throw toError(e); }
};
export const searchNotes = async (query: string): Promise<NotePreview[]> => {
  try { return await invoke<NotePreview[]>('search_notes', { query }); } catch (e) { throw toError(e); }
};
