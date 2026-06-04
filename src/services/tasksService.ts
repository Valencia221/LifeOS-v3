import { invoke } from '@tauri-apps/api/core';
import type { Task, TaskInput, TaskFilter } from '../types';

function toError(e: unknown): Error {
  if (e && typeof e === 'object' && 'message' in e) return new Error(String((e as any).message));
  return new Error(String(e));
}

export const getTasks = async (filter: TaskFilter): Promise<Task[]> => {
  try { return await invoke<Task[]>('get_tasks', { filter }); } catch (e) { throw toError(e); }
};
export const createTask = async (task: TaskInput): Promise<Task> => {
  try { return await invoke<Task>('create_task', { task }); } catch (e) { throw toError(e); }
};
export const updateTask = async (task: TaskInput): Promise<Task> => {
  try { return await invoke<Task>('update_task', { task }); } catch (e) { throw toError(e); }
};
export const updateTaskStatus = async (id: string, status: string): Promise<void> => {
  try { await invoke('update_task_status', { id, status }); } catch (e) { throw toError(e); }
};
export const deleteTask = async (id: string): Promise<void> => {
  try { await invoke('delete_task', { id }); } catch (e) { throw toError(e); }
};
