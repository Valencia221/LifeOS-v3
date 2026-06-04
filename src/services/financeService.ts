import { invoke } from '@tauri-apps/api/core';
import type { Transaction, TransactionInput, MonthlySummary } from '../types';

function toError(e: unknown): Error {
  if (e && typeof e === 'object' && 'message' in e) return new Error(String((e as any).message));
  return new Error(String(e));
}

export const addTransaction = async (tx: TransactionInput): Promise<Transaction> => {
  try { return await invoke<Transaction>('add_transaction', { tx }); } catch (e) { throw toError(e); }
};
export const getTransactions = async (month: string): Promise<Transaction[]> => {
  try { return await invoke<Transaction[]>('get_transactions', { month }); } catch (e) { throw toError(e); }
};
export const getMonthlySummary = async (month: string): Promise<MonthlySummary> => {
  try { return await invoke<MonthlySummary>('get_monthly_summary', { month }); } catch (e) { throw toError(e); }
};
export const exportTransactionsCsv = async (month: string): Promise<string> => {
  try { return await invoke<string>('export_transactions_csv', { month }); } catch (e) { throw toError(e); }
};
