'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FplPlayer, FplTeam, Position } from './components/types';
import { POSITION_MAP, SQUAD_STRUCTURE, BUDGET, MAX_PER_TEAM } from './components/types';
import { PlayerPicker } from './components/player-picker';
import { SquadView } from './components/squad-view';

type FplData = {
  elements: FplPlayer[];
  teams: FplTeam[];
  fetched_at: string;
};

function loadSquad(): FplPlayer[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('inksuite-fantasy-squad');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSquad(squad: FplPlayer[]) {
  localStorage.setItem('inksuite-fantasy-squad', JSON.stringify(squad));
}

export default function FantasyPage() {
  const [data, setData] = useState<FplData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [squad, setSquad] = useState<FplPlayer[]>([]);

  useEffect(() => {
    setLoading(true);
    import('./data/fpl.json')
      .then((mod) => {
        const d = mod.default as FplData;
        setData(d);
        const saved = loadSquad();
        if (saved.length > 0) {
          const idMap = new Map(d.elements.map((p: FplPlayer) => [p.id, p]));
          const restored = saved
            .map((s: FplPlayer) => idMap.get(s.id))
            .filter((p: FplPlayer | undefined): p is FplPlayer => p !== undefined);
          setSquad(restored);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load player data'))
      .finally(() => setLoading(false));
  }, []);

  const budget = BUDGET - squad.reduce((s, p) => s + p.now_cost, 0);

  const canAdd = useCallback(
    (player: FplPlayer): boolean => {
      if (squad.some((p) => p.id === player.id)) return false;
      if (player.now_cost > budget) return false;
      const pos = POSITION_MAP[player.element_type];
      const posCount = squad.filter((p) => POSITION_MAP[p.element_type] === pos).length;
      if (posCount >= SQUAD_STRUCTURE[pos].total) return false;
      const teamCount = squad.filter((p) => p.team === player.team).length;
      if (teamCount >= MAX_PER_TEAM) return false;
      return true;
    },
    [squad, budget],
  );

  const addPlayer = useCallback(
    (player: FplPlayer) => {
      if (!canAdd(player)) return;
      const newSquad = [...squad, player];
      setSquad(newSquad);
      saveSquad(newSquad);
    },
    [squad, canAdd],
  );

  const removePlayer = useCallback(
    (playerId: number) => {
      const newSquad = squad.filter((p) => p.id !== playerId);
      setSquad(newSquad);
      saveSquad(newSquad);
    },
    [squad],
  );

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-16">
        <div className="py-24 text-center text-ink-600">Loading Premier League data…</div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-16">
        <div className="rounded-lg bg-red-50 p-6 text-center text-red-700 ring-1 ring-inset ring-red-300">
          <strong>Error:</strong> {error || 'No data available'}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-8">
        <a
          href="https://inksuite.xyz"
          className="mb-6 inline-flex items-center gap-2 rounded-lg bg-purple-100 px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-purple-200 shadow-sm transition hover:bg-purple-200 hover:text-ink-900"
        >
          ← inksuite.xyz
        </a>
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-5xl">
          Fantasy Premier League
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-700">
          Build your dream 15-player squad with a £100M budget. Max 3 players from one club.
          {' '}{data.elements.length} players available. Data updated at build time.
        </p>
        <p className="mt-1 text-xs text-ink-400">
          Last data fetch: {new Date(data.fetched_at).toLocaleString()}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <SquadView squad={squad} teams={data.teams} onRemove={removePlayer} />
        </div>
        <div className="lg:col-span-3">
          <PlayerPicker
            players={data.elements}
            teams={data.teams}
            squad={squad}
            budget={budget}
            filterPosition={null}
            onAdd={addPlayer}
          />
        </div>
      </div>

      <footer className="mt-16 border-t border-purple-200 pt-8 text-sm text-ink-500">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span>Part of Ink Suite · MIT license · Player data from FPL</span>
          <a
            href="https://github.com/erdemcrypto3/inksuite"
            className="hover:text-ink-500"
            target="_blank"
            rel="noopener noreferrer"
          >
            source →
          </a>
        </div>
      </footer>
    </main>
  );
}
