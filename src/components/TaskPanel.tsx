import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { TaskInput } from '../types';

interface Props { date: string; onClose: () => void; }

export default function TaskPanel({ date, onClose }: Props) {
  const { tasks, upsertTask, setStatus, removeTask } = useAppStore();
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  const dayTasks = tasks.filter((t) => t.due_date?.startsWith(date));

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setAdding(true);
    const input: TaskInput = {
      id: null, title: newTitle.trim(), description: null,
      due_date: date, status: 'pending', priority: 'medium', note_id: null,
    };
    await upsertTask(input);
    setNewTitle('');
    setAdding(false);
  };

  const STATUS_COLORS: Record<string, string> = {
    pending: '#f9e2af', in_progress: '#89b4fa', done: '#a6e3a1', cancelled: '#6c7086',
  };

  return (
    <div className="flex flex-col h-full border-l" style={{ width: 300, background: '#181825', borderColor: '#313244' }}>
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#313244' }}>
        <h3 className="font-semibold" style={{ color: '#cdd6f4' }}>{date}</h3>
        <button onClick={onClose} style={{ color: '#6c7086' }}>✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {dayTasks.length === 0 && (
          <p className="text-sm text-center mt-4" style={{ color: '#6c7086' }}>Sin tareas para este día</p>
        )}
        {dayTasks.map((t) => (
          <div key={t.id} className="mb-2 p-3 rounded-lg" style={{ background: '#313244' }}>
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm" style={{ color: '#cdd6f4' }}>{t.title}</span>
              <button onClick={() => removeTask(t.id)} style={{ color: '#f38ba8', fontSize: 12 }}>✕</button>
            </div>
            <div className="flex gap-2 mt-2">
              {(['pending','in_progress','done'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(t.id, s)}
                  className="text-xs px-2 py-0.5 rounded"
                  style={{
                    background: t.status === s ? STATUS_COLORS[s] + '33' : 'transparent',
                    color: STATUS_COLORS[s],
                    border: `1px solid ${t.status === s ? STATUS_COLORS[s] : '#45475a'}`,
                  }}
                >
                  {s === 'pending' ? 'Pendiente' : s === 'in_progress' ? 'En curso' : 'Hecho'}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="p-3 border-t" style={{ borderColor: '#313244' }}>
        <div className="flex gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Nueva tarea..."
            className="flex-1 px-3 py-1.5 rounded-md text-sm outline-none"
            style={{ background: '#313244', color: '#cdd6f4' }}
          />
          <button
            onClick={handleAdd}
            disabled={adding}
            className="px-3 py-1.5 rounded-md text-sm font-semibold"
            style={{ background: '#89b4fa', color: '#1e1e2e' }}
          >+</button>
        </div>
      </div>
    </div>
  );
}
