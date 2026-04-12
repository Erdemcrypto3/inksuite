'use client';

import { ACHIEVEMENTS, MAX_POINTS_PER_CATEGORY } from './types';

type Props = {
  totalPoints: number;
  achievementLevel: number;
};

export function AchievementTimeline({ totalPoints, achievementLevel }: Props) {
  const percentage = Math.min(1, totalPoints / MAX_POINTS_PER_CATEGORY);

  return (
    <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-ink-600">
        Achievement Progress
      </h3>

      {/* Progress bar */}
      <div className="relative mb-2">
        <div className="h-3 rounded-full bg-purple-100">
          <div
            className="h-3 rounded-full bg-gradient-to-r from-ink-400 to-ink-500 transition-all duration-500"
            style={{ width: `${percentage * 100}%` }}
          />
        </div>

        {/* Achievement markers */}
        <div className="absolute inset-0 flex items-center">
          {ACHIEVEMENTS.map((a) => {
            const left = `${a.threshold * 100}%`;
            const unlocked = achievementLevel >= a.level;
            const colors = [
              'bg-purple-300', // initiation
              'bg-amber-600',  // bronze
              'bg-gray-400',   // silver
              'bg-amber-400',  // gold
              'bg-cyan-400',   // diamond
            ];
            return (
              <div
                key={a.level}
                className="absolute -translate-x-1/2"
                style={{ left }}
                title={`${a.name}: ${a.label}`}
              >
                <div
                  className={`h-5 w-5 rounded-full ring-2 ring-white ${
                    unlocked ? colors[a.level] : 'bg-purple-200'
                  } flex items-center justify-center`}
                >
                  {unlocked && (
                    <span className="text-[8px] text-white font-bold">
                      {a.level === 0 ? '✓' : a.level}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Labels */}
      <div className="mt-4 flex justify-between text-[10px]">
        {ACHIEVEMENTS.map((a) => (
          <div
            key={a.level}
            className={`text-center ${
              achievementLevel >= a.level ? 'text-ink-700 font-semibold' : 'text-ink-400'
            }`}
            style={{ width: '20%' }}
          >
            {a.name}
          </div>
        ))}
      </div>

      <div className="mt-3 text-center text-sm text-ink-600">
        <span className="font-mono font-semibold text-ink-500">{totalPoints}</span>
        <span className="text-ink-400"> / {MAX_POINTS_PER_CATEGORY} pts</span>
        <span className="ml-2 text-ink-400">({Math.round(percentage * 100)}%)</span>
      </div>
    </div>
  );
}
