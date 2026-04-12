'use client';

import { useState, useMemo } from 'react';
import type { FplPlayer, FplTeam, Position } from './types';
import { POSITION_MAP, POSITION_COLORS, MAX_PER_TEAM } from './types';

type Props = {
  players: FplPlayer[];
  teams: FplTeam[];
  squad: FplPlayer[];
  budget: number;
  filterPosition: Position | null;
  onAdd: (player: FplPlayer) => void;
};

export function PlayerPicker({ players, teams, squad, budget, filterPosition, onAdd }: Props) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'cost' | 'points' | 'form'>('points');
  const [posFilter, setPosFilter] = useState<Position | 'ALL'>(filterPosition ?? 'ALL');
  const [teamFilter, setTeamFilter] = useState<number | 0>(0);

  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const squadIds = useMemo(() => new Set(squad.map((p) => p.id)), [squad]);
  const teamCounts = useMemo(() => {
    const counts = new Map<number, number>();
    squad.forEach((p) => counts.set(p.team, (counts.get(p.team) || 0) + 1));
    return counts;
  }, [squad]);

  const filtered = useMemo(() => {
    let list = players;
    if (posFilter !== 'ALL') {
      const typeNum = Object.entries(POSITION_MAP).find(([, v]) => v === posFilter)?.[0];
      if (typeNum) list = list.filter((p) => p.element_type === Number(typeNum));
    }
    if (teamFilter > 0) list = list.filter((p) => p.team === teamFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.web_name.toLowerCase().includes(q) ||
          p.first_name.toLowerCase().includes(q) ||
          p.second_name.toLowerCase().includes(q),
      );
    }
    list = [...list].sort((a, b) =>
      sortBy === 'cost' ? b.now_cost - a.now_cost :
      sortBy === 'form' ? Number(b.form) - Number(a.form) :
      b.total_points - a.total_points,
    );
    return list.slice(0, 50);
  }, [players, posFilter, teamFilter, search, sortBy]);

  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-inset ring-purple-100 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-600">
        Pick Players
      </h3>

      <div className="mb-3 flex flex-wrap gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search player…"
          className="flex-1 min-w-[140px] rounded-lg bg-purple-50/50 px-3 py-2 text-xs text-ink-900 ring-1 ring-inset ring-purple-200 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-ink-500"
        />
        <select
          value={posFilter}
          onChange={(e) => setPosFilter(e.target.value as Position | 'ALL')}
          className="rounded-lg bg-purple-50/50 px-2 py-2 text-xs text-ink-900 ring-1 ring-inset ring-purple-200"
        >
          <option value="ALL">All Pos</option>
          <option value="GKP">GKP</option>
          <option value="DEF">DEF</option>
          <option value="MID">MID</option>
          <option value="FWD">FWD</option>
        </select>
        <select
          value={teamFilter}
          onChange={(e) => setTeamFilter(Number(e.target.value))}
          className="rounded-lg bg-purple-50/50 px-2 py-2 text-xs text-ink-900 ring-1 ring-inset ring-purple-200"
        >
          <option value={0}>All Teams</option>
          {teams.sort((a, b) => a.name.localeCompare(b.name)).map((t) => (
            <option key={t.id} value={t.id}>{t.short_name}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'cost' | 'points' | 'form')}
          className="rounded-lg bg-purple-50/50 px-2 py-2 text-xs text-ink-900 ring-1 ring-inset ring-purple-200"
        >
          <option value="points">Points ↓</option>
          <option value="cost">Price ↓</option>
          <option value="form">Form ↓</option>
        </select>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-white border-b border-purple-200 text-ink-500 uppercase tracking-wider">
            <tr>
              <th className="px-2 py-2 text-left">Player</th>
              <th className="px-2 py-2 text-center">Pos</th>
              <th className="px-2 py-2 text-center">Team</th>
              <th className="px-2 py-2 text-right">£</th>
              <th className="px-2 py-2 text-right">Pts</th>
              <th className="px-2 py-2 text-right">Form</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-purple-50">
            {filtered.map((p) => {
              const pos = POSITION_MAP[p.element_type];
              const inSquad = squadIds.has(p.id);
              const teamFull = (teamCounts.get(p.team) || 0) >= MAX_PER_TEAM;
              const tooExpensive = p.now_cost > budget;
              const disabled = inSquad || teamFull || tooExpensive;

              return (
                <tr key={p.id} className={`hover:bg-purple-50 ${disabled ? 'opacity-40' : ''}`}>
                  <td className="px-2 py-2">
                    <span className="font-semibold text-ink-900">{p.web_name}</span>
                    {p.status !== 'a' && (
                      <span className="ml-1 text-[10px] text-amber-600" title={p.news}>
                        {p.status === 'i' ? '🤕' : p.status === 'd' ? '⚠️' : '❌'}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset ${POSITION_COLORS[pos]}`}>
                      {pos}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center text-ink-600">
                    {teamMap.get(p.team)?.short_name ?? '?'}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-ink-700">
                    {(p.now_cost / 10).toFixed(1)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono font-semibold text-ink-900">
                    {p.total_points}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-ink-600">
                    {p.form}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      onClick={() => !disabled && onAdd(p)}
                      disabled={disabled}
                      className={`rounded px-2 py-1 text-[10px] font-semibold ${
                        disabled
                          ? 'bg-purple-50 text-ink-300 cursor-not-allowed'
                          : 'bg-ink-500 text-white hover:bg-ink-700'
                      }`}
                    >
                      {inSquad ? 'In squad' : teamFull ? 'Team full' : tooExpensive ? 'No budget' : '+ Add'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
