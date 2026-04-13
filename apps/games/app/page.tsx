'use client';

import { useState } from 'react';
import { InkWalletProvider, ConnectButton, useAccount, useWriteContract } from '@inksuite/wallet';
import { parseEther } from 'viem';
import { Hangman } from './components/hangman';
import { Minesweeper } from './components/minesweeper';
import { Snake } from './components/snake';
import { Tetris } from './components/tetris';
import { SoloTest } from './components/solo-test';
import { Crossword } from './components/crossword';
import { Checkers } from './components/checkers';
import { TowerDefense } from './components/tower-defense';

type GameId = 'hangman' | 'minesweeper' | 'snake' | 'tetris' | 'solotest' | 'crossword' | 'checkers' | 'towerdefense' | null;

type GameInfo = {
  id: GameId & string;
  title: string;
  icon: string;
  description: string;
  status: 'live' | 'coming';
};

const INKMINT_ADDRESS = '0x964bf77C2cF0901F0acFaC277601816d2dbEACEe' as const;
const INKMINT_ABI = [{name:'mint',type:'function',stateMutability:'payable',inputs:[{name:'uri',type:'string'},{name:'prompt',type:'string'}],outputs:[]}] as const;
const MINT_FEE = parseEther('0.000577');
const API_URL = 'https://api.inksuite.xyz';

const games: GameInfo[] = [
  { id: 'hangman', icon: '🔤', title: 'Hangman', description: 'Guess the word before the man hangs. 6 wrong guesses allowed.', status: 'live' },
  { id: 'minesweeper', icon: '💣', title: 'Minesweeper', description: 'Clear the board without hitting a mine. Classic logic puzzle.', status: 'live' },
  { id: 'snake', icon: '🐍', title: 'Snake', description: 'Eat food, grow longer, don\'t hit the walls or yourself.', status: 'live' },
  { id: 'tetris', icon: '🧱', title: 'Tetris', description: 'Stack tetrominoes, clear lines, chase the high score. Classic arcade.', status: 'live' },
  { id: 'solotest', icon: '⚫', title: 'Solo Test', description: 'Jump pegs to remove them. Can you leave just one? English board peg solitaire.', status: 'live' },
  { id: 'crossword', icon: '📝', title: 'Crossword', description: '5×5 mini crossword puzzles. Across and down clues. 20 themed puzzles to solve.', status: 'live' },
  { id: 'checkers', icon: '♟️', title: 'Checkers', description: 'Classic checkers against AI. Capture all opponent pieces to win. Kings move backwards.', status: 'live' },
  { id: 'towerdefense', icon: '🏰', title: 'Tower Defense', description: 'Defend the Ink network from spam txs, bots, and MEV attackers. 15 waves, 4 tower types.', status: 'live' },
];

function MintScoreButton({ gameId, gameTitle, gameIcon, score }: { gameId: string; gameTitle: string; gameIcon: string; score: number }) {
  const { address, isConnected } = useAccount();
  const { writeContract, isPending } = useWriteContract();
  const [minted, setMinted] = useState(false);
  const [minting, setMinting] = useState(false);

  if (!isConnected || score <= 0) return null;

  const handleMint = async () => {
    if (!address) return;
    setMinting(true);
    try {
      const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
      const metadata = {
        name: `${gameTitle} High Score`,
        description: `${gameIcon} ${gameTitle} — Score: ${score} by ${shortAddr} on Ink Game Hub`,
        attributes: [
          { trait_type: 'Game', value: gameTitle },
          { trait_type: 'Score', value: score.toString() },
          { trait_type: 'Wallet', value: shortAddr },
          { trait_type: 'Icon', value: gameIcon },
        ],
      };

      const metaRes = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata),
      });
      if (!metaRes.ok) throw new Error('Upload failed');
      const metaData = await metaRes.json();

      writeContract({
        address: INKMINT_ADDRESS,
        abi: INKMINT_ABI,
        functionName: 'mint',
        args: [metaData.url, `${gameIcon} ${gameTitle}: ${score} pts`],
        value: MINT_FEE,
      }, {
        onSuccess: () => setMinted(true),
        onError: () => setMinting(false),
      });
    } catch {
      setMinting(false);
    }
  };

  if (minted) return <span className="text-[10px] text-emerald-600 font-semibold">Score NFT Minted!</span>;

  return (
    <button onClick={handleMint} disabled={isPending || minting}
      className="rounded-lg bg-ink-500 px-3 py-1 text-[10px] font-semibold text-white hover:bg-ink-600 disabled:opacity-50">
      {isPending || minting ? 'Minting...' : 'Mint Score NFT'}
    </button>
  );
}

function getHighScore(gameId: string): number | null {
  if (typeof window === 'undefined') return null;
  const val = localStorage.getItem(`inksuite-games-${gameId}-highscore`);
  return val ? Number(val) : null;
}

function GameHubContent() {
  const [activeGame, setActiveGame] = useState<GameId>(null);

  if (activeGame === 'hangman') return <GameWrapper title="Hangman" onBack={() => setActiveGame(null)}><Hangman /></GameWrapper>;
  if (activeGame === 'minesweeper') return <GameWrapper title="Minesweeper" onBack={() => setActiveGame(null)}><Minesweeper /></GameWrapper>;
  if (activeGame === 'snake') return <GameWrapper title="Snake" onBack={() => setActiveGame(null)}><Snake /></GameWrapper>;
  if (activeGame === 'tetris') return <GameWrapper title="Tetris" onBack={() => setActiveGame(null)}><Tetris /></GameWrapper>;
  if (activeGame === 'solotest') return <GameWrapper title="Solo Test" onBack={() => setActiveGame(null)}><SoloTest /></GameWrapper>;
  if (activeGame === 'crossword') return <GameWrapper title="Crossword" onBack={() => setActiveGame(null)}><Crossword /></GameWrapper>;
  if (activeGame === 'checkers') return <GameWrapper title="Checkers" onBack={() => setActiveGame(null)}><Checkers /></GameWrapper>;
  if (activeGame === 'towerdefense') return <GameWrapper title="Tower Defense" onBack={() => setActiveGame(null)}><TowerDefense /></GameWrapper>;

  return (
    <main className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
      <header className="mb-12">
        <div className="mb-6 flex items-center justify-between">
          <a href="https://inksuite.xyz" className="inline-flex items-center gap-2 rounded-lg bg-purple-100 px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-purple-200 shadow-sm transition hover:bg-purple-200 hover:text-ink-900">
            ← inksuite.xyz
          </a>
          <ConnectButton showBalance={false} />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-5xl">Game Hub</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-700">
          Classic browser games. Connect your wallet to record high scores on-chain.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((g) => {
          const hs = getHighScore(g.id);
          return (
            <div
              key={g.id}
              onClick={() => g.status === 'live' ? setActiveGame(g.id as GameId) : undefined}
              className={`group rounded-xl bg-white p-6 text-left ring-1 ring-inset ring-purple-100 shadow-sm transition ${
                g.status === 'live' ? 'hover:bg-purple-50 hover:ring-ink-500 cursor-pointer' : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="mb-2 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{g.icon}</span>
                  <h3 className="text-lg font-semibold text-ink-900">{g.title}</h3>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                  g.status === 'live' ? 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/40' : 'bg-purple-50/50 text-ink-500 ring-purple-100'
                }`}>
                  {g.status === 'live' ? 'Play' : 'Soon'}
                </span>
              </div>
              <p className="mb-4 text-sm text-ink-700">{g.description}</p>
              {hs !== null && (
                <div className="flex items-center justify-between">
                  <div className="text-xs text-ink-500">
                    Best: <span className="font-mono text-ink-500">{hs}</span>
                  </div>
                  <MintScoreButton gameId={g.id} gameTitle={g.title} gameIcon={g.icon} score={hs} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <footer className="mt-16 border-t border-purple-200 pt-8 text-sm text-ink-500">
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
      <div className="mb-6 flex items-center justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-2 rounded-lg bg-purple-100 px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-purple-200 shadow-sm transition hover:bg-purple-200 hover:text-ink-900">
          ← Back to Game Hub
        </button>
        <ConnectButton showBalance={false} />
      </div>
      <h1 className="mb-6 text-2xl font-semibold text-ink-900">{title}</h1>
      {children}
    </main>
  );
}

export default function GameHubPage() {
  return (
    <InkWalletProvider>
      <GameHubContent />
    </InkWalletProvider>
  );
}
