'use client';

export function MetricCard({
  label,
  value,
  unit,
  dim,
}: {
  label: string;
  value: string;
  unit?: string;
  dim?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-5 ring-1 ring-inset ring-purple-100 shadow-sm ${
        dim ? 'bg-purple-50/50' : 'bg-white'
      }`}
    >
      <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">{label}</div>
      <div className="mt-2 font-mono text-2xl font-semibold text-ink-900">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-ink-500">{unit}</span>}
      </div>
    </div>
  );
}
