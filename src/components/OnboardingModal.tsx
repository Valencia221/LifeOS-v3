import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { setupDb } from '../services/authService';

export default function OnboardingModal() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setUnlocked = useAppStore((s) => s.setUnlocked);
  const setFirstRun = useAppStore((s) => s.setFirstRun);

  const handleSetup = async () => {
    if (!name.trim()) { setError('Ingresa tu nombre'); return; }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return; }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return; }
    setLoading(true);
    setError(null);
    try {
      await setupDb(name.trim(), password);
      setFirstRun(false);
      setUnlocked(true);
    } catch (e: any) {
      setError(e.message ?? 'Error al configurar la base de datos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#1e1e2e' }}>
      <div className="w-full max-w-sm p-8 rounded-2xl shadow-2xl" style={{ background: '#181825' }}>
        <h1 className="text-2xl font-bold mb-1" style={{ color: '#cdd6f4' }}>Bienvenido a LifeOS</h1>
        <p className="text-xs mb-6" style={{ color: '#6c7086' }}>
          Tu contraseña encripta todos tus datos. No se puede recuperar si la pierdes.
        </p>
        {[
          { label: 'Tu nombre', value: name, set: setName, type: 'text', placeholder: 'Nombre' },
          { label: 'Contraseña', value: password, set: setPassword, type: 'password', placeholder: '••••••••' },
          { label: 'Confirmar contraseña', value: confirm, set: setConfirm, type: 'password', placeholder: '••••••••' },
        ].map(({ label, value, set, type, placeholder }) => (
          <div key={label} className="mb-4">
            <label className="block text-sm mb-1" style={{ color: '#a6adc8' }}>{label}</label>
            <input
              type={type}
              value={value}
              onChange={(e) => set(e.target.value)}
              placeholder={placeholder}
              className="w-full px-4 py-2 rounded-lg outline-none"
              style={{ background: '#313244', color: '#cdd6f4', border: '1px solid #45475a' }}
            />
          </div>
        ))}
        {error && <p className="text-sm mb-3" style={{ color: '#f38ba8' }}>{error}</p>}
        <button
          onClick={handleSetup}
          disabled={loading}
          className="w-full py-2 rounded-lg font-semibold mt-2"
          style={{ background: '#89b4fa', color: '#1e1e2e', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'Configurando...' : 'Crear LifeOS'}
        </button>
      </div>
    </div>
  );
}
