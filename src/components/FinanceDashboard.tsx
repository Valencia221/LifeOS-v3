import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useAppStore } from '../store/useAppStore';
import { exportTransactionsCsv } from '../services/financeService';
import type { TransactionInput } from '../types';

const CATEGORIES = ['Alimentación','Transporte','Vivienda','Salud','Educación','Entretenimiento','Salario','Freelance','Inversiones','Otro'];

export default function FinanceDashboard() {
  const { month, transactions, summary, financeLoading, financeError, loadMonth, setMonth, addTx } = useAppStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<TransactionInput, 'id' | 'note_id'>>({
    amount: 0, type: 'expense', category: 'Alimentación', description: '', date: new Date().toISOString().slice(0,10),
  });
  const [exporting, setExporting] = useState(false);

  useEffect(() => { loadMonth(month); }, [month]);

  const handleExport = async () => {
    setExporting(true);
    try { await exportTransactionsCsv(month); } catch(e: any) { alert(e.message); } finally { setExporting(false); }
  };

  const handleAdd = async () => {
    if (!form.amount || form.amount <= 0) return;
    await addTx({ ...form, id: null, note_id: null });
    setShowForm(false);
    setForm({ amount: 0, type: 'expense', category: 'Alimentación', description: '', date: new Date().toISOString().slice(0,10) });
  };

  const chartData = summary ? [
    { name: 'Resumen', Ingresos: summary.total_income, Gastos: summary.total_expenses }
  ] : [];

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ background: '#1e1e2e', color: '#cdd6f4' }}>
      <div className="flex items-center gap-4 mb-6">
        <h2 className="text-xl font-bold">Finanzas</h2>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="px-3 py-1 rounded-md text-sm outline-none"
          style={{ background: '#313244', color: '#cdd6f4' }}
        />
        <button
          onClick={handleExport}
          disabled={exporting}
          className="ml-auto px-3 py-1.5 rounded-md text-sm"
          style={{ background: '#313244', color: '#89b4fa' }}
        >
          {exporting ? 'Exportando...' : '⬇ Exportar CSV'}
        </button>
        <button
          onClick={() => setShowForm(true)}
          className="px-3 py-1.5 rounded-md text-sm font-semibold"
          style={{ background: '#89b4fa', color: '#1e1e2e' }}
        >+ Transacción</button>
      </div>

      {financeLoading && <p style={{ color: '#6c7086' }}>Cargando...</p>}
      {financeError && <p style={{ color: '#f38ba8' }}>{financeError}</p>}

      {summary && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Ingresos', value: summary.total_income, color: '#a6e3a1' },
            { label: 'Gastos', value: summary.total_expenses, color: '#f38ba8' },
            { label: 'Balance', value: summary.balance, color: summary.balance >= 0 ? '#a6e3a1' : '#f38ba8' },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-4 rounded-xl" style={{ background: '#181825' }}>
              <p className="text-sm mb-1" style={{ color: '#6c7086' }}>{label}</p>
              <p className="text-2xl font-bold" style={{ color }}>
                ${value.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
              </p>
            </div>
          ))}
        </div>
      )}

      {chartData.length > 0 && (
        <div className="p-4 rounded-xl mb-6" style={{ background: '#181825' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: '#a6adc8' }}>Ingresos vs Gastos</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" stroke="#6c7086" />
              <YAxis stroke="#6c7086" />
              <Tooltip contentStyle={{ background: '#313244', border: 'none', color: '#cdd6f4' }} />
              <Legend />
              <Bar dataKey="Ingresos" fill="#a6e3a1" radius={[4,4,0,0]} />
              <Bar dataKey="Gastos" fill="#f38ba8" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ background: '#181825' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid #313244' }}>
              {['Fecha','Tipo','Categoría','Descripción','Monto'].map(h => (
                <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: '#6c7086' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} style={{ borderBottom: '1px solid #313244' }}>
                <td className="px-4 py-3">{t.date}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded text-xs" style={{ background: t.type === 'income' ? '#a6e3a133' : '#f38ba833', color: t.type === 'income' ? '#a6e3a1' : '#f38ba8' }}>
                    {t.type === 'income' ? 'Ingreso' : 'Gasto'}
                  </span>
                </td>
                <td className="px-4 py-3">{t.category}</td>
                <td className="px-4 py-3" style={{ color: '#6c7086' }}>{t.description ?? '-'}</td>
                <td className="px-4 py-3 font-semibold" style={{ color: t.type === 'income' ? '#a6e3a1' : '#f38ba8' }}>
                  ${t.amount.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8" style={{ color: '#6c7086' }}>Sin transacciones este mes</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: '#00000088' }}>
          <div className="p-6 rounded-2xl w-full max-w-sm" style={{ background: '#181825' }}>
            <h3 className="font-bold mb-4" style={{ color: '#cdd6f4' }}>Nueva transacción</h3>
            <div className="space-y-3">
              <select
                value={form.type}
                onChange={(e) => setForm(f => ({ ...f, type: e.target.value as any }))}
                className="w-full px-3 py-2 rounded-md text-sm outline-none"
                style={{ background: '#313244', color: '#cdd6f4' }}
              >
                <option value="expense">Gasto</option>
                <option value="income">Ingreso</option>
              </select>
              <select
                value={form.category}
                onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 rounded-md text-sm outline-none"
                style={{ background: '#313244', color: '#cdd6f4' }}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                type="number"
                value={form.amount || ''}
                onChange={(e) => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
                placeholder="Monto"
                className="w-full px-3 py-2 rounded-md text-sm outline-none"
                style={{ background: '#313244', color: '#cdd6f4' }}
              />
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2 rounded-md text-sm outline-none"
                style={{ background: '#313244', color: '#cdd6f4' }}
              />
              <input
                value={form.description ?? ''}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Descripción (opcional)"
                className="w-full px-3 py-2 rounded-md text-sm outline-none"
                style={{ background: '#313244', color: '#cdd6f4' }}
              />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-md text-sm" style={{ background: '#313244', color: '#cdd6f4' }}>Cancelar</button>
              <button onClick={handleAdd} className="flex-1 py-2 rounded-md text-sm font-semibold" style={{ background: '#89b4fa', color: '#1e1e2e' }}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
