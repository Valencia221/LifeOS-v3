import { create } from 'zustand';
import * as authService from '../services/authService';
import * as notesService from '../services/notesService';
import * as tasksService from '../services/tasksService';
import * as financeService from '../services/financeService';
import type { Note, NoteInput, Task, TaskInput, TaskFilter, Transaction, TransactionInput, MonthlySummary } from '../types';

type ActiveView = 'notes' | 'calendar' | 'finance' | 'settings';

interface AppState {
  // auth
  isFirstRun: boolean;
  isUnlocked: boolean;
  setFirstRun: (v: boolean) => void;
  setUnlocked: (v: boolean) => void;

  // ui
  activeView: ActiveView;
  sidebarCollapsed: boolean;
  setView: (v: ActiveView) => void;
  toggleSidebar: () => void;

  // notes
  notes: Note[];
  activeNoteId: string | null;
  notesLoading: boolean;
  notesError: string | null;
  setActiveNoteId: (id: string | null) => void;
  loadNotes: () => Promise<void>;
  upsertNote: (note: NoteInput) => Promise<Note>;
  removeNote: (id: string) => Promise<void>;

  // tasks
  tasks: Task[];
  tasksLoading: boolean;
  tasksError: string | null;
  loadTasks: (filter: TaskFilter) => Promise<void>;
  upsertTask: (task: TaskInput) => Promise<Task>;
  setStatus: (id: string, status: string) => Promise<void>;
  removeTask: (id: string) => Promise<void>;

  // finance
  month: string;
  transactions: Transaction[];
  summary: MonthlySummary | null;
  financeLoading: boolean;
  financeError: string | null;
  setMonth: (m: string) => void;
  loadMonth: (month: string) => Promise<void>;
  addTx: (tx: TransactionInput) => Promise<void>;
}

const currentMonth = () => new Date().toISOString().slice(0, 7);

export const useAppStore = create<AppState>((set, get) => ({
  // auth
  isFirstRun: false,
  isUnlocked: false,
  setFirstRun: (v) => set({ isFirstRun: v }),
  setUnlocked: (v) => set({ isUnlocked: v }),

  // ui
  activeView: 'notes',
  sidebarCollapsed: false,
  setView: (v) => set({ activeView: v }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  // notes
  notes: [],
  activeNoteId: null,
  notesLoading: false,
  notesError: null,
  setActiveNoteId: (id) => set({ activeNoteId: id }),
  loadNotes: async () => {
    set({ notesLoading: true, notesError: null });
    try {
      const notes = await notesService.getNotes();
      set({ notes, notesLoading: false });
    } catch (e: any) {
      set({ notesLoading: false, notesError: e.message });
    }
  },
  upsertNote: async (note) => {
    const saved = await notesService.saveNote(note);
    set((s) => {
      const idx = s.notes.findIndex((n) => n.id === saved.id);
      const notes = idx >= 0
        ? s.notes.map((n) => (n.id === saved.id ? saved : n))
        : [saved, ...s.notes];
      return { notes };
    });
    return saved;
  },
  removeNote: async (id) => {
    await notesService.deleteNote(id);
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
  },

  // tasks
  tasks: [],
  tasksLoading: false,
  tasksError: null,
  loadTasks: async (filter) => {
    set({ tasksLoading: true, tasksError: null });
    try {
      const tasks = await tasksService.getTasks(filter);
      set({ tasks, tasksLoading: false });
    } catch (e: any) {
      set({ tasksLoading: false, tasksError: e.message });
    }
  },
  upsertTask: async (task) => {
    const saved = task.id
      ? await tasksService.updateTask(task)
      : await tasksService.createTask(task);
    set((s) => {
      const idx = s.tasks.findIndex((t) => t.id === saved.id);
      const tasks = idx >= 0
        ? s.tasks.map((t) => (t.id === saved.id ? saved : t))
        : [...s.tasks, saved];
      return { tasks };
    });
    return saved;
  },
  setStatus: async (id, status) => {
    await tasksService.updateTaskStatus(id, status);
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, status: status as any } : t)),
    }));
  },
  removeTask: async (id) => {
    await tasksService.deleteTask(id);
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
  },

  // finance
  month: currentMonth(),
  transactions: [],
  summary: null,
  financeLoading: false,
  financeError: null,
  setMonth: (m) => set({ month: m }),
  loadMonth: async (month) => {
    set({ financeLoading: true, financeError: null, month });
    try {
      const [transactions, summary] = await Promise.all([
        financeService.getTransactions(month),
        financeService.getMonthlySummary(month),
      ]);
      set({ transactions, summary, financeLoading: false });
    } catch (e: any) {
      set({ financeLoading: false, financeError: e.message });
    }
  },
  addTx: async (tx) => {
    await financeService.addTransaction(tx);
    await get().loadMonth(get().month);
  },
}));
