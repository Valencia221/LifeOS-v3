import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import TaskPanel from './TaskPanel';

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function CalendarView() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const { tasks, loadTasks } = useAppStore();

  useEffect(() => {
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth(year, month)).padStart(2, '0')}`;
    loadTasks({ status: null, from, to, include_deleted: false });
  }, [year, month]);

  const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const days = daysInMonth(year, month);
  const firstDay = firstDayOfMonth(year, month);

  const tasksForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return tasks.filter((t) => t.due_date?.startsWith(dateStr));
  };

  const prevMonth = () => { if (month === 0) { setYear(y => y-1); setMonth(11); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y+1); setMonth(0); } else setMonth(m => m+1); };

  const selectedDateStr = selectedDay
    ? `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
    : null;

  return (
    <div className="flex flex-1 overflow-hidden" style={{ background: '#1e1e2e' }}>
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={prevMonth} style={{ color: '#89b4fa' }}>‹</button>
          <h2 className="text-xl font-bold" style={{ color: '#cdd6f4' }}>{MONTHS[month]} {year}</h2>
          <button onClick={nextMonth} style={{ color: '#89b4fa' }}>›</button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map(d => (
            <div key={d} className="text-center text-xs font-semibold py-1" style={{ color: '#6c7086' }}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
          {Array.from({ length: days }).map((_, i) => {
            const day = i + 1;
            const dayTasks = tasksForDay(day);
            const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
            const isSelected = selectedDay === day;
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                className="rounded-lg p-2 min-h-[60px] text-left transition-colors"
                style={{
                  background: isSelected ? '#313244' : isToday ? '#1e3a5f' : '#181825',
                  border: isSelected ? '1px solid #89b4fa' : '1px solid transparent',
                  color: '#cdd6f4',
                }}
              >
                <span className="text-sm font-medium" style={{ color: isToday ? '#89b4fa' : '#cdd6f4' }}>{day}</span>
                {dayTasks.slice(0, 2).map((t) => (
                  <div key={t.id} className="text-xs mt-1 truncate px-1 rounded" style={{ background: '#89b4fa22', color: '#89b4fa' }}>
                    {t.title}
                  </div>
                ))}
                {dayTasks.length > 2 && <div className="text-xs" style={{ color: '#6c7086' }}>+{dayTasks.length - 2}</div>}
              </button>
            );
          })}
        </div>
      </div>
      {selectedDateStr && (
        <TaskPanel date={selectedDateStr} onClose={() => setSelectedDay(null)} />
      )}
    </div>
  );
}
