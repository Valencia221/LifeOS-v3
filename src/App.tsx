import { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import { isFirstRun } from './services/authService';
import Sidebar from './components/Sidebar';
import LockScreen from './components/LockScreen';
import OnboardingModal from './components/OnboardingModal';
import NotesList from './components/NotesList';
import NoteEditor from './components/NoteEditor';
import CalendarView from './components/CalendarView';
import FinanceDashboard from './components/FinanceDashboard';

export default function App() {
  const { isFirstRun: firstRun, isUnlocked, setFirstRun, activeView } = useAppStore();

  useEffect(() => {
    isFirstRun().then(setFirstRun).catch(() => {});
  }, []);

  if (firstRun) return <OnboardingModal />;
  if (!isUnlocked) return <LockScreen />;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#1e1e2e' }}>
      <Sidebar />
      <main className="flex flex-1 overflow-hidden">
        {activeView === 'notes' && (
          <>
            <NotesList />
            <NoteEditor />
          </>
        )}
        {activeView === 'calendar' && <CalendarView />}
        {activeView === 'finance' && <FinanceDashboard />}
        {activeView === 'settings' && (
          <div className="flex-1 p-8" style={{ color: '#cdd6f4' }}>
            <h2 className="text-xl font-bold mb-4">Configuración</h2>
            <p style={{ color: '#6c7086' }}>Próximamente más opciones.</p>
          </div>
        )}
      </main>
    </div>
  );
}
