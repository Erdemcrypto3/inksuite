'use client';

import type { FplPlayer, FplTeam, Position } from './types';
import { POSITION_MAP, POSITION_COLORS, POSITION_LABELS, BUDGET, SQUAD_STRUCTURE } from './types';
import { useMemo } from 'react';

type Props = {
  squad: FplPlayer[];
  teams: FplTeam[];
  onRemove: (playerId: number) => void;
};

function formatCost(cost: number): string {
  return `£${(cost / 10).toFixed(1)}M`;
}

export function SquadView({ squad, teams, onRemove }: Props) {
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const totalCost = squad.reduce((s, p) => s + p.now_cost, 0);
  const remaining = BUDGET - totalCost;
  const totalPoints = squad.reduce((s, p) => s + p.total_points, 0);

  const grouped = useMemo(() => {
    const groups: Record<Position, FplPlayer[]> = { GKP: [], DEF: [], MID: [], FWD: [] };
    squad.forEach((p) => {
      const pos = POSITION_MAP[p.element_type]!;
      groups[pos].push(p);
    });
    return groups;
  }, [squad]);

  const positions: Position[] = ['GKP', 'DEF', 'MID', 'FWD'];

  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-inset ring-purple-100 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-600">
          Your Squad ({squad.length}/15)
        </h3>
        <div className="flex gap-3 text-xs">
          <span className="text-ink-600">
            Budget: <span className={`font-mono font-semibold ${remaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCost(remaining)}</span>
          </span>
          <span className="text-ink-600">
            Value: <span className="font-mono font-semibold text-ink-900">{formatCost(totalCost)}</span>
          </span>
          <span className="text-ink-600">
            Points: <span className="font-mono font-semibold text-ink-500">{totalPoints}</span>
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {positions.map((pos) => {
          const structure = SQUAD_STRUCTURE[pos];
          const players = grouped[pos];
          const emptySlots = structure.total - players.length;

          return (
            <div key={pos}>
              <div className="mb-1 flex items-center gap-2">
                <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${POSITION_COLORS[pos]}`}>
                  {pos}
                </span>
                <span className="text-xs text-ink-500">
                  {POSITION_LABELS[pos]} ({players.length}/{structure.total})
                </span>
              </div>
              <div className="grid grid-cols-1 gap-1">
                {players.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg bg-purple-50/50 px-3 py-2 ring-1 ring-inset ring-purple-100"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-ink-900">{p.web_name}</span>
                      <span className="text-[10px] text-ink-500">
                        {teamMap.get(p.team)?.short_name}
                      </span>
                      {p.status !== 'a' && (
                        <span className="text-[10px] text-amber-600">
                          {p.status === 'i' ? '🤕' : p.status === 'd' ? '⚠️' : '❌'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] text-ink-600">{formatCost(p.now_cost)}</span>
                      <span className="font-mono text-[10px] font-semibold text-ink-500">{p.total_points}pts</span>
                      <button
                        onClick={() => onRemove(p.id)}
                        className="rounded px-1.5 py-0.5 text-[10px] text-red-500 hover:bg-red-50 hover:text-red-700"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
                {Array.from({ length: emptySlots }, (_, i) => (
                  <div
                    key={`empty-${pos}-${i}`}
                    className="flex items-center justify-center rounded-lg border-2 border-dashed border-purple-200 px-3 py-2 text-[10px] text-ink-400"
                  >
                    Empty {pos} slot
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {squad.length === 15 && remaining >= 0 && (
        <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-center text-sm font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-300">
          Squad complete!
        </div>
      )}
      {remaining < 0 && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-center text-sm font-semibold text-red-700 ring-1 ring-inset ring-red-300">
          Over budget by {formatCost(Math.abs(remaining))}! Remove players to fit.
        </div>
      )}
    </div>
  );
}
