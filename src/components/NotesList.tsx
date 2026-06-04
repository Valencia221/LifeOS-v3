import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { searchNotes } from '../services/notesService';
import type { NotePreview } from '../types';

export default function NotesList() {
  const { notes, activeNoteId, setActiveNoteId, loadNotes, upsertNote, notesLoading } = useAppStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NotePreview[] | null>(null);

  useEffect(() => { loadNotes(); }, []);

  useEffect(() => {
    if (!query.trim()) { setResults(null); return; }
    const t = setTimeout(async () => {
      try {
        const r = await searchNotes(query);
        setResults(r);
      } catch { setResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const handleNew = async () => {
    const n = await upsertNote({ id: null, title: 'Nueva nota', content_md: '', content_json: null, tags: [] });
    setActiveNoteId(n.id);
  };

  const list = results !== null
    ? notes.filter((n) => results.some((r) => r.id === n.id))
    : notes;

  return (
    <div className="flex flex-col h-full" style={{ width: 260, background: '#181825', borderRight: '1px solid #313244' }}>
      <div className="p-3 flex items-center gap-2 border-b" style={{ borderColor: '#313244' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar notas..."
          className="flex-1 px-3 py-1 rounded-md text-sm outline-none"
          style={{ background: '#313244', color: '#cdd6f4' }}
        />
        <button
          onClick={handleNew}
          className="p-1 rounded-md text-lg"
          style={{ color: '#89b4fa' }}
          title="Nueva nota"
        >+</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {notesLoading && <p className="text-xs text-center p-4" style={{ color: '#6c7086' }}>Cargando...</p>}
        {list.map((n) => (
          <button
            key={n.id}
            onClick={() => setActiveNoteId(n.id)}
            className="w-full text-left px-4 py-3 border-b"
            style={{
              borderColor: '#313244',
              background: activeNoteId === n.id ? '#313244' : 'transparent',
              color: '#cdd6f4',
            }}
          >
            <p className="text-sm font-medium truncate">{n.title || 'Sin título'}</p>
            <p className="text-xs mt-0.5" style={{ color: '#6c7086' }}>
              {new Date(n.updated_at).toLocaleDateString('es-CO')}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
