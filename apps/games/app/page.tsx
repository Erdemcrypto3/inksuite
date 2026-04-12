'use client';

import { useState } from 'react';
import { Hangman } from './components/hangman';
import { Minesweeper } from './components/minesweeper';
import { Snake } from './components/snake';

type GameId = 'hangman' | 'minesweeper' | 'snake' | null;

type GameInfo = {
  id: GameId & string;
  title: string;
  description: string;
  status: 'live' | 'coming';
};

const games: GameInfo[] = [
  { id: 'hangman', title: 'Hangman', description: 'Guess the word before the man hangs. 6 wrong guesses allowed.', status: 'live' },
  { id: 'minesweeper', title: 'Minesweeper', description: 'Clear the board without hitting a mine. Classic logic puzzle.', status: 'live' },
  { id: 'snake', title: 'Snake', description: 'Eat food, grow longer, don\'t hit the walls or yourself.', status: 'live' },
];

function getHighScore(gameId: string): number | null {
  if (typeof window === 'undefined') return null;
  const val = localStorage.getItem(`inksuite-games-${gameId}-highscore`);
  return val ? Number(val) : null;
}

export default function GameHubPage() {
  const [activeGame, setActiveGame] = useState<GameId>(null);

  if (activeGame === 'hangman') return <GameWrapper title="Hangman" onBack={() => setActiveGame(null)}><Hangman /></GameWrapper>;
  if (activeGame === 'minesweeper') return <GameWrapper title="Minesweeper" onBack={() => setActiveGame(null)}><Minesweeper /></GameWrapper>;
  if (activeGame === 'snake') return <GameWrapper title="Snake" onBack={() => setActiveGame(null)}><Snake /></GameWrapper>;

  return (
    <main className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
      <header className="mb-12">
        <a href="https://inksuite.xyz" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-100/50 hover:text-ink-500">
          ← inksuite.xyz
        </a>
        <h1 className="text-3xl font-semibold tracking-tight text-ink-50 sm:text-5xl">Game Hub</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-100/60">
          Classic browser games. Track your personal high scores. Leaderboard and score NFT minting coming soon.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((g) => {
          const hs = getHighScore(g.id);
          return (
            <button
              key={g.id}
              onClick={() => g.status === 'live' ? setActiveGame(g.id as GameId) : undefined}
              className={`group rounded-xl bg-white/5 p-6 text-left ring-1 ring-inset ring-white/10 transition ${
                g.status === 'live' ? 'hover:bg-white/10 hover:ring-ink-500/50 cursor-pointer' : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="mb-2 flex items-start justify-between">
                <h3 className="text-lg font-semibold text-ink-50">{g.title}</h3>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                  g.status === 'live' ? 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/40' : 'bg-white/5 text-ink-100/40 ring-white/10'
                }`}>
                  {g.status === 'live' ? 'Play' : 'Soon'}
                </span>
              </div>
              <p className="mb-4 text-sm text-ink-100/60">{g.description}</p>
              {hs !== null && (
                <div className="text-xs text-ink-100/40">
                  Best: <span className="font-mono text-ink-500">{hs}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <footer className="mt-16 border-t border-white/10 pt-8 text-sm text-ink-100/40">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span>Part of Ink Suite · MIT license</span>
          <a href="https://github.com/erdemcrypto3/inksuite" className="hover:text-ink-500" target="_blank" rel="noopener noreferrer">source →</a>
        </div>
      </footer>
    </main>
  );
}

function GameWrapper({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <button onClick={onBack} className="mb-6 inline-flex items-center gap-1 text-sm text-ink-100/50 hover:text-ink-500">
        ← Back to Game Hub
      </button>
      <h1 className="mb-6 text-2xl font-semibold text-ink-50">{title}</h1>
      {children}
    </main>
  );
}
