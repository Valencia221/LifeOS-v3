import { invoke } from '@tauri-apps/api/core';

function toError(e: unknown): Error {
  if (e && typeof e === 'object' && 'message' in e) return new Error(String((e as any).message));
  return new Error(String(e));
}

export const isFirstRun = async (): Promise<boolean> => {
  try { return await invoke<boolean>('is_first_run'); } catch (e) { throw toError(e); }
};
export const setupDb = async (name: string, password: string): Promise<void> => {
  try { await invoke('setup_db', { name, password }); } catch (e) { throw toError(e); }
};
export const unlockDb = async (password: string): Promise<void> => {
  try { await invoke('unlock_db', { password }); } catch (e) { throw toError(e); }
};
export const lockDb = async (): Promise<void> => {
  try { await invoke('lock_db'); } catch (e) { throw toError(e); }
};
