'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FplPlayer, FplTeam, Position } from './components/types';
import { POSITION_MAP, SQUAD_STRUCTURE, BUDGET, MAX_PER_TEAM } from './components/types';
import { PlayerPicker } from './components/player-picker';
import { SquadView } from './components/squad-view';
import { PointsView } from './components/points-view';
import { LeaderboardView } from './components/leaderboard-view';
import { InkWalletProvider, ConnectButton } from '@inksuite/wallet';

type MainTab = 'squad' | 'points' | 'leaderboard';

type FplData = {
  elements: FplPlayer[];
  teams: FplTeam[];
  current_gw: number;
  completed_gws: number[];
  recent_gws: number[];
  live: Record<string, Record<string, any>>;
  fixtures: any[];
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

function loadCaptain(): number | null {
  if (typeof window === 'undefined') return null;
  const val = localStorage.getItem('inksuite-fantasy-captain');
  return val ? Number(val) : null;
}

function saveCaptain(id: number) {
  localStorage.setItem('inksuite-fantasy-captain', String(id));
}

function FantasyContent() {
  const [data, setData] = useState<FplData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [squad, setSquad] = useState<FplPlayer[]>([]);
  const [captainId, setCaptainId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<MainTab>('squad');

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
        setCaptainId(loadCaptain());
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
      if (captainId === playerId) setCaptainId(null);
    },
    [squad, captainId],
  );

  const handleSetCaptain = useCallback((id: number) => {
    setCaptainId(id);
    saveCaptain(id);
  }, []);

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
        <div className="mb-6 flex items-center justify-between">
          <a
            href="https://inksuite.xyz"
            className="inline-flex items-center gap-2 rounded-lg bg-purple-100 px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-purple-200 shadow-sm transition hover:bg-purple-200 hover:text-ink-900"
          >
            ← inksuite.xyz
          </a>
          <ConnectButton showBalance={false} />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-5xl">
          Fantasy Premier League
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-700">
          Build your dream squad, pick a captain, track gameweek points.
          {' '}{data.elements.length} players · GW{data.current_gw} · Data from FPL API.
        </p>
        <p className="mt-1 text-xs text-ink-400">
          Last update: {new Date(data.fetched_at).toLocaleString()}
        </p>
      </header>

      {/* Tab bar */}
      <div className="mb-8 flex gap-1 rounded-lg bg-purple-50/50 p-1 ring-1 ring-inset ring-purple-100">
        {(['squad', 'points', 'leaderboard'] as MainTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-md px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === tab
                ? 'bg-ink-500 text-white shadow-sm'
                : 'text-ink-600 hover:bg-purple-50 hover:text-ink-800'
            }`}
          >
            {tab === 'squad'
              ? `Squad (${squad.length}/15)`
              : tab === 'points'
                ? `Points — GW${data.current_gw}`
                : 'Leaderboard'}
          </button>
        ))}
      </div>

      {/* Squad tab */}
      {activeTab === 'squad' && (
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
      )}

      {/* Points tab */}
      {activeTab === 'points' && (
        <PointsView
          squad={squad}
          teams={data.teams}
          liveData={data.live || {}}
          fixtures={data.fixtures || []}
          currentGW={data.current_gw}
          recentGWs={data.recent_gws || []}
          captainId={captainId}
          onSetCaptain={handleSetCaptain}
        />
      )}

      {/* Leaderboard tab */}
      {activeTab === 'leaderboard' && (
        <LeaderboardView
          players={data.elements}
          teams={data.teams}
          squad={squad}
          captainId={captainId}
          liveData={data.live || {}}
          recentGWs={data.recent_gws || []}
        />
      )}

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

export default function FantasyPage() {
  return (
    <InkWalletProvider>
      <FantasyContent />
    </InkWalletProvider>
  );
}
