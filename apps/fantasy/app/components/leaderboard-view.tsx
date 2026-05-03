'use client';

import { useMemo } from 'react';
import type { FplPlayer, FplTeam } from './types';
import { POSITION_MAP, POSITION_COLORS } from './types';

type GWLiveStats = { total_points: number };

type Props = {
  players: FplPlayer[];
  teams: FplTeam[];
  squad: FplPlayer[];
  captainId: number | null;
  liveData: Record<string, Record<string, GWLiveStats>>;
  recentGWs: number[];
};

export function LeaderboardView({ players, teams, squad, captainId, liveData, recentGWs }: Props) {
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const squadIds = useMemo(() => new Set(squad.map((p) => p.id)), [squad]);

  // Sum each player's points across all loaded GWs
  const playerTotals = useMemo(() => {
    const totals = new Map<number, number>();
    for (const gw of recentGWs) {
      const gwLive = liveData[String(gw)] || {};
      for (const [pidStr, stats] of Object.entries(gwLive)) {
        const pid = Number(pidStr);
        totals.set(pid, (totals.get(pid) || 0) + (stats?.total_points ?? 0));
      }
    }
    return players
      .map((p) => ({ player: p, total: totals.get(p.id) || 0 }))
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 50);
  }, [players, liveData, recentGWs]);

  // Squad season total (with captain x2 applied per GW)
  const squadSeasonTotal = useMemo(() => {
    let total = 0;
    for (const gw of recentGWs) {
      const gwLive = liveData[String(gw)] || {};
      for (const p of squad) {
        const pts = gwLive[String(p.id)]?.total_points ?? 0;
        total += p.id === captainId ? pts * 2 : pts;
      }
    }
    return total;
  }, [squad, captainId, liveData, recentGWs]);

  const yourRank = useMemo(() => {
    // Rank squad players by season total within the leaderboard
    return squad
      .map((p) => {
        const idx = playerTotals.findIndex((r) => r.player.id === p.id);
        return { player: p, rank: idx >= 0 ? idx + 1 : null };
      })
      .filter((r) => r.rank !== null)
      .sort((a, b) => (a.rank! - b.rank!));
  }, [squad, playerTotals]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-ink-500 p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-white/70">
            Your squad — season total
          </div>
          <div className="mt-1 font-mono text-4xl font-bold text-white">{squadSeasonTotal}</div>
          <div className="mt-1 text-xs text-white/70">
            Across {recentGWs.length} loaded gameweek{recentGWs.length === 1 ? '' : 's'} · captain ×2 applied
          </div>
        </div>
        <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">
            Your squad in top 50
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {yourRank.length === 0 ? (
              <span className="text-sm text-ink-500">No squad players ranked yet.</span>
            ) : (
              yourRank.slice(0, 8).map((r) => (
                <span
                  key={r.player.id}
                  className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-ink-700 ring-1 ring-inset ring-purple-200"
                >
                  #{r.rank} {r.player.web_name}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-white ring-1 ring-inset ring-purple-100 shadow-sm">
        <div className="border-b border-purple-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-ink-900">Top 50 players — season points</h3>
          <p className="text-xs text-ink-500">Highlighted rows are in your squad.</p>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-purple-200 text-xs uppercase tracking-wider text-ink-500">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium">#</th>
              <th className="px-3 py-2.5 text-left font-medium">Player</th>
              <th className="px-3 py-2.5 text-center font-medium">Team</th>
              <th className="px-3 py-2.5 text-center font-medium">Pos</th>
              <th className="px-3 py-2.5 text-right font-medium">Total Pts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-purple-100">
            {playerTotals.map((row, i) => {
              const pos = POSITION_MAP[row.player.element_type]!;
              const inSquad = squadIds.has(row.player.id);
              return (
                <tr key={row.player.id} className={inSquad ? 'bg-amber-50/50' : 'hover:bg-purple-50'}>
                  <td className="px-3 py-2 font-mono text-ink-500">{i + 1}</td>
                  <td className="px-3 py-2 font-semibold text-ink-900">
                    {row.player.web_name}
                    {inSquad && (
                      <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-inset ring-amber-300">
                        squad
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center text-xs text-ink-600">
                    {teamMap.get(row.player.team)?.short_name ?? '?'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset ${POSITION_COLORS[pos]}`}
                    >
                      {pos}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-ink-900">{row.total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
