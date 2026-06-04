import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useAppStore } from '../store/useAppStore';
import type { NoteInput } from '../types';

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

export default function NoteEditor() {
  const { activeNoteId, notes, upsertNote } = useAppStore();
  const note = notes.find((n) => n.id === activeNoteId);
  const [title, setTitle] = useState(note?.title ?? '');
  const [saving, setSaving] = useState(false);
  const saveRef = useRef<(input: NoteInput) => Promise<void>>();

  const editor = useEditor({
    extensions: [StarterKit],
    content: note?.content_json ? JSON.parse(note.content_json) : note?.content_md ?? '',
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none outline-none min-h-[400px] p-4',
        style: 'color:#cdd6f4',
      },
    },
  });

  const persist = useCallback(
    debounce(async (input: NoteInput) => {
      setSaving(true);
      try { await upsertNote(input); } finally { setSaving(false); }
    }, 800),
    [upsertNote]
  );

  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      const content_json = JSON.stringify(editor.getJSON());
      const content_md = editor.storage.markdown?.getMarkdown?.() ?? editor.getText();
      persist({ id: activeNoteId ?? null, title, content_md, content_json, tags: note?.tags ?? [] });
    };
    editor.on('update', handler);
    return () => { editor.off('update', handler); };
  }, [editor, title, activeNoteId, note?.tags, persist]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    if (!editor) return;
    const content_json = JSON.stringify(editor.getJSON());
    const content_md = editor.getText();
    persist({ id: activeNoteId ?? null, title: e.target.value, content_md, content_json, tags: note?.tags ?? [] });
  };

  if (!activeNoteId && !note) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: '#6c7086' }}>
        <p>Selecciona o crea una nota</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: '#1e1e2e' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b" style={{ borderColor: '#313244' }}>
        {[
          { label: 'B', action: () => editor?.chain().focus().toggleBold().run(), active: editor?.isActive('bold') },
          { label: 'I', action: () => editor?.chain().focus().toggleItalic().run(), active: editor?.isActive('italic') },
          { label: 'H1', action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(), active: editor?.isActive('heading', { level: 1 }) },
          { label: 'H2', action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), active: editor?.isActive('heading', { level: 2 }) },
          { label: 'UL', action: () => editor?.chain().focus().toggleBulletList().run(), active: editor?.isActive('bulletList') },
          { label: 'OL', action: () => editor?.chain().focus().toggleOrderedList().run(), active: editor?.isActive('orderedList') },
          { label: '<>', action: () => editor?.chain().focus().toggleCodeBlock().run(), active: editor?.isActive('codeBlock') },
        ].map(({ label, action, active }) => (
          <button
            key={label}
            onClick={action}
            className="px-2 py-1 text-xs rounded font-mono"
            style={{ background: active ? '#89b4fa' : '#313244', color: active ? '#1e1e2e' : '#cdd6f4' }}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-xs" style={{ color: '#6c7086' }}>
          {saving ? 'Guardando...' : 'Guardado'}
        </span>
      </div>
      <input
        value={title}
        onChange={handleTitleChange}
        placeholder="Título de la nota"
        className="w-full px-6 py-4 text-2xl font-bold outline-none"
        style={{ background: '#1e1e2e', color: '#cdd6f4', borderBottom: '1px solid #313244' }}
      />
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
