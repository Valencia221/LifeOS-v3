import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { unlockDb } from '../services/authService';

export default function LockScreen() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setUnlocked = useAppStore((s) => s.setUnlocked);

  const handleUnlock = async () => {
    if (!password) return;
    setLoading(true);
    setError(null);
    try {
      await unlockDb(password);
      setUnlocked(true);
    } catch (e: any) {
      setError(e.message ?? 'Contraseña incorrecta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#1e1e2e' }}>
      <div className="w-full max-w-sm p-8 rounded-2xl shadow-2xl" style={{ background: '#181825' }}>
        <h1 className="text-2xl font-bold mb-2 text-center" style={{ color: '#cdd6f4' }}>LifeOS</h1>
        <p className="text-sm text-center mb-6" style={{ color: '#6c7086' }}>Ingresa tu contraseña para desbloquear</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
          placeholder="Contraseña"
          className="w-full px-4 py-2 rounded-lg mb-4 outline-none"
          style={{ background: '#313244', color: '#cdd6f4', border: '1px solid #45475a' }}
        />
        {error && <p className="text-sm mb-3" style={{ color: '#f38ba8' }}>{error}</p>}
        <button
          onClick={handleUnlock}
          disabled={loading}
          className="w-full py-2 rounded-lg font-semibold transition-opacity"
          style={{ background: '#89b4fa', color: '#1e1e2e', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'Desbloqueando...' : 'Desbloquear'}
        </button>
      </div>
    </div>
  );
}
