import { useAppStore } from '../store/useAppStore';
import { lockDb } from '../services/authService';

const NAV = [
  { view: 'notes', label: 'Notas', icon: '📝' },
  { view: 'calendar', label: 'Calendario', icon: '📅' },
  { view: 'finance', label: 'Finanzas', icon: '💰' },
  { view: 'settings', label: 'Ajustes', icon: '⚙️' },
] as const;

export default function Sidebar() {
  const { activeView, sidebarCollapsed, setView, toggleSidebar, setUnlocked } = useAppStore();

  const handleLock = async () => {
    await lockDb();
    setUnlocked(false);
  };

  return (
    <aside
      className="flex flex-col h-full transition-all duration-200"
      style={{ width: sidebarCollapsed ? 56 : 200, background: '#181825', borderRight: '1px solid #313244' }}
    >
      <div className="flex items-center justify-between p-3">
        {!sidebarCollapsed && (
          <span className="font-bold text-lg" style={{ color: '#89b4fa' }}>LifeOS</span>
        )}
        <button onClick={toggleSidebar} className="p-1 rounded" style={{ color: '#6c7086' }}>
          {sidebarCollapsed ? '→' : '←'}
        </button>
      </div>
      <nav className="flex-1 mt-2">
        {NAV.map(({ view, label, icon }) => (
          <button
            key={view}
            onClick={() => setView(view)}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors"
            style={{
              color: activeView === view ? '#89b4fa' : '#cdd6f4',
              background: activeView === view ? '#313244' : 'transparent',
            }}
          >
            <span className="text-base">{icon}</span>
            {!sidebarCollapsed && <span>{label}</span>}
          </button>
        ))}
      </nav>
      <button
        onClick={handleLock}
        className="m-3 px-3 py-2 rounded-lg text-sm"
        style={{ background: '#313244', color: '#f38ba8' }}
      >
        {sidebarCollapsed ? '🔒' : '🔒 Bloquear'}
      </button>
    </aside>
  );
}
