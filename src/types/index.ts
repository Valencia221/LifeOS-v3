export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'cancelled';
export type Priority   = 'low' | 'medium' | 'high';
export type TxType     = 'income' | 'expense';

export interface Note {
  id: string; title: string; content_md: string; content_json: string | null;
  tags: string[]; is_deleted: boolean; created_at: string; updated_at: string;
}
export interface NotePreview { id: string; title: string; snippet: string; updated_at: string; }
export interface NoteInput { id: string | null; title: string; content_md: string; content_json: string | null; tags: string[]; }
export interface Task {
  id: string; title: string; description: string | null; due_date: string | null;
  status: TaskStatus; priority: Priority; note_id: string | null;
  is_deleted: boolean; created_at: string; updated_at: string;
}
export interface TaskInput { id: string | null; title: string; description: string | null; due_date: string | null; status: TaskStatus; priority: Priority; note_id: string | null; }
export interface TaskFilter { status: TaskStatus | null; from: string | null; to: string | null; include_deleted: boolean; }
export interface Transaction {
  id: string; amount: number; type: TxType; category: string;
  description: string | null; date: string; note_id: string | null;
  is_deleted: boolean; created_at: string; updated_at: string;
}
export interface TransactionInput { id: string | null; amount: number; type: TxType; category: string; description: string | null; date: string; note_id: string | null; }
export interface MonthlySummary { month: string; total_income: number; total_expenses: number; balance: number; by_category: { category: string; total: number; type: TxType }[]; }
export interface AppError { code: string; message: string; }
