'use client';

import { useState } from 'react';

type GmRecord = {
  date: string;
  txHash: string;
};

export function GmCalendar({ records }: { records: GmRecord[] }) {
  const [monthOffset, setMonthOffset] = useState(0);

  const now = new Date();
  const viewDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun

  const gmDates = new Set(records.map((r) => r.date));
  const today = new Date().toISOString().slice(0, 10);

  const monthName = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const canGoForward = monthOffset < 0;

  return (
    <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => setMonthOffset((o) => o - 1)}
          className="rounded-lg px-3 py-1 text-sm font-medium text-ink-600 hover:bg-purple-50"
        >
          ←
        </button>
        <h3 className="text-sm font-semibold text-ink-900">{monthName}</h3>
        <button
          onClick={() => setMonthOffset((o) => o + 1)}
          disabled={!canGoForward}
          className="rounded-lg px-3 py-1 text-sm font-medium text-ink-600 hover:bg-purple-50 disabled:opacity-30"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="pb-1 text-[10px] font-semibold uppercase text-ink-400">
            {d}
          </div>
        ))}
        {days.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const hasGm = gmDates.has(dateStr);
          const isToday = dateStr === today;
          const isFuture = dateStr > today;

          return (
            <div
              key={dateStr}
              className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-medium transition ${
                hasGm
                  ? 'bg-emerald-500 text-white font-bold'
                  : isToday
                  ? 'ring-2 ring-ink-500 text-ink-900'
                  : isFuture
                  ? 'text-ink-200'
                  : 'text-ink-400 hover:bg-purple-50'
              }`}
              title={hasGm ? `gm on ${dateStr}` : undefined}
            >
              {day}
            </div>
          );
        })}
      </div>

      {records.length > 0 && (
        <div className="mt-3 flex items-center gap-3 text-[10px] text-ink-400">
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-emerald-500" /> gm sent
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded ring-2 ring-ink-500" /> today
          </span>
        </div>
      )}
    </div>
  );
}
