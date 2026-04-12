'use client';

import { useMemo, useState } from 'react';
import type { FplPlayer, FplTeam } from './types';
import { POSITION_MAP, POSITION_COLORS } from './types';

type GWLiveStats = {
  minutes: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  goals_conceded: number;
  yellow_cards: number;
  red_cards: number;
  saves: number;
  bonus: number;
  total_points: number;
  in_dreamteam: boolean;
};

type Fixture = {
  id: number;
  event: number | null;
  home: number;
  away: number;
  home_score: number | null;
  away_score: number | null;
  finished: boolean;
  kickoff: string | null;
};

type Props = {
  squad: FplPlayer[];
  teams: FplTeam[];
  liveData: Record<string, Record<string, GWLiveStats>>;
  fixtures: Fixture[];
  currentGW: number;
  recentGWs: number[];
  captainId: number | null;
  onSetCaptain: (id: number) => void;
};

export function PointsView({
  squad,
  teams,
  liveData,
  fixtures,
  currentGW,
  recentGWs,
  captainId,
  onSetCaptain,
}: Props) {
  const [selectedGW, setSelectedGW] = useState(currentGW);
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const gwLive = liveData[String(selectedGW)] || {};
  const gwFixtures = fixtures.filter((f) => f.event === selectedGW);

  // Calculate squad points for selected GW
  const playerPoints = useMemo(() => {
    return squad.map((p) => {
      const stats = gwLive[String(p.id)];
      const basePoints = stats?.total_points ?? 0;
      const isCaptain = p.id === captainId;
      return {
        player: p,
        stats,
        basePoints,
        finalPoints: isCaptain ? basePoints * 2 : basePoints,
        isCaptain,
      };
    });
  }, [squad, gwLive, captainId]);

  const totalPoints = playerPoints.reduce((s, pp) => s + pp.finalPoints, 0);
  const highestScorer = playerPoints.reduce(
    (best, pp) => (pp.basePoints > (best?.basePoints ?? 0) ? pp : best),
    playerPoints[0],
  );

  return (
    <div className="space-y-6">
      {/* GW Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink-600">Gameweek</span>
          <select
            value={selectedGW}
            onChange={(e) => setSelectedGW(Number(e.target.value))}
            className="rounded-lg bg-white px-3 py-2 text-sm text-ink-900 ring-1 ring-inset ring-purple-200 shadow-sm"
          >
            {recentGWs.map((gw) => (
              <option key={gw} value={gw}>
                GW{gw} {gw === currentGW ? '(Current)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="rounded-xl bg-ink-500 px-5 py-3 text-center shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-white/70">
            GW{selectedGW} Total
          </div>
          <div className="font-mono text-3xl font-bold text-white">{totalPoints}</div>
        </div>
      </div>

      {/* Fixtures */}
      {gwFixtures.length > 0 && (
        <div className="rounded-xl bg-white p-4 ring-1 ring-inset ring-purple-100 shadow-sm">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-600">
            GW{selectedGW} Fixtures
          </h3>
          <div className="flex flex-wrap gap-2">
            {gwFixtures.map((f) => (
              <div
                key={f.id}
                className="rounded-lg bg-purple-50/50 px-3 py-1.5 text-xs ring-1 ring-inset ring-purple-100"
              >
                <span className="font-semibold text-ink-900">
                  {teamMap.get(f.home)?.short_name ?? '?'}
                </span>
                <span className="mx-1 text-ink-500">
                  {f.finished
                    ? `${f.home_score ?? 0} - ${f.away_score ?? 0}`
                    : 'vs'}
                </span>
                <span className="font-semibold text-ink-900">
                  {teamMap.get(f.away)?.short_name ?? '?'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Squad no seçilmemişse */}
      {squad.length === 0 && (
        <div className="rounded-xl bg-white p-8 text-center text-ink-500 ring-1 ring-inset ring-purple-100 shadow-sm">
          Build your squad first in the Squad tab to see points here.
        </div>
      )}

      {/* Player Points Table */}
      {squad.length > 0 && (
        <div className="rounded-xl bg-white ring-1 ring-inset ring-purple-100 shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-purple-200 text-xs uppercase tracking-wider text-ink-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Player</th>
                <th className="px-3 py-3 text-center font-medium">Pos</th>
                <th className="px-3 py-3 text-center font-medium">Min</th>
                <th className="px-3 py-3 text-center font-medium">G</th>
                <th className="px-3 py-3 text-center font-medium">A</th>
                <th className="px-3 py-3 text-center font-medium">CS</th>
                <th className="px-3 py-3 text-center font-medium">YC</th>
                <th className="px-3 py-3 text-center font-medium">B</th>
                <th className="px-3 py-3 text-right font-medium">Pts</th>
                <th className="px-3 py-3 text-center font-medium">C</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-100">
              {playerPoints
                .sort((a, b) => {
                  const posOrder = a.player.element_type - b.player.element_type;
                  if (posOrder !== 0) return posOrder;
                  return b.finalPoints - a.finalPoints;
                })
                .map((pp) => {
                  const pos = POSITION_MAP[pp.player.element_type];
                  return (
                    <tr
                      key={pp.player.id}
                      className={`hover:bg-purple-50 ${pp.isCaptain ? 'bg-amber-50/50' : ''} ${
                        pp.stats?.in_dreamteam ? 'bg-emerald-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ink-900">
                            {pp.player.web_name}
                          </span>
                          <span className="text-[10px] text-ink-500">
                            {teamMap.get(pp.player.team)?.short_name}
                          </span>
                          {pp.isCaptain && (
                            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-inset ring-amber-300">
                              C ×2
                            </span>
                          )}
                          {pp.stats?.in_dreamteam && (
                            <span className="text-[10px] text-emerald-600">★</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset ${POSITION_COLORS[pos]}`}
                        >
                          {pos}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-ink-600">
                        {pp.stats?.minutes ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-ink-900">
                        {pp.stats?.goals_scored ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-ink-900">
                        {pp.stats?.assists ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-ink-600">
                        {pp.stats?.clean_sheets ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-amber-600">
                        {pp.stats?.yellow_cards ? pp.stats.yellow_cards : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-ink-500">
                        {pp.stats?.bonus ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-ink-900">
                        {pp.finalPoints}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => onSetCaptain(pp.player.id)}
                          className={`rounded px-2 py-1 text-[10px] font-semibold transition ${
                            pp.isCaptain
                              ? 'bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-300'
                              : 'text-ink-400 hover:bg-purple-50 hover:text-ink-700'
                          }`}
                          title="Set as captain (×2 points)"
                        >
                          {pp.isCaptain ? '★' : '☆'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
            <tfoot className="border-t-2 border-purple-300 bg-purple-50/50">
              <tr>
                <td colSpan={8} className="px-4 py-3 text-sm font-semibold text-ink-700">
                  Total GW{selectedGW} Points
                </td>
                <td className="px-3 py-3 text-right font-mono text-xl font-bold text-ink-500">
                  {totalPoints}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Summary stats */}
      {squad.length > 0 && highestScorer && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-white p-4 ring-1 ring-inset ring-purple-100 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">
              Highest scorer
            </div>
            <div className="mt-1 font-semibold text-ink-900">
              {highestScorer.player.web_name}
            </div>
            <div className="font-mono text-lg text-ink-500">{highestScorer.basePoints} pts</div>
          </div>
          <div className="rounded-xl bg-white p-4 ring-1 ring-inset ring-purple-100 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">
              Captain bonus
            </div>
            <div className="mt-1 font-mono text-lg text-ink-900">
              +{captainId ? (gwLive[String(captainId)]?.total_points ?? 0) : 0} pts
            </div>
            <div className="text-xs text-ink-500">From ×2 captain multiplier</div>
          </div>
          <div className="rounded-xl bg-white p-4 ring-1 ring-inset ring-purple-100 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">
              Dream Team players
            </div>
            <div className="mt-1 font-mono text-lg text-ink-900">
              {playerPoints.filter((pp) => pp.stats?.in_dreamteam).length}
            </div>
            <div className="text-xs text-ink-500">★ in your squad</div>
          </div>
        </div>
      )}

      <p className="text-xs text-ink-400">
        G = Goals · A = Assists · CS = Clean Sheets · YC = Yellow Cards · B = Bonus · C = Captain (×2).
        Points from FPL official scoring. Captain gets double points.
      </p>
    </div>
  );
}
