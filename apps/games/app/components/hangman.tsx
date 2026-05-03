'use client';

import { useCallback, useEffect, useState } from 'react';
import { MintScoreNFTButton } from './mint-score-nft';

const WORDS = [
  'BLOCKCHAIN', 'ETHEREUM', 'SOLIDITY', 'WALLET', 'TRANSACTION',
  'PROTOCOL', 'DEFI', 'TOKEN', 'BRIDGE', 'LAYER',
  'ORACLE', 'STAKING', 'MINING', 'CONSENSUS', 'LEDGER',
  'CRYPTO', 'HASH', 'NONCE', 'MERKLE', 'GENESIS',
  'SMART', 'CONTRACT', 'DEPLOY', 'CHAIN', 'BLOCK',
  'MAINNET', 'TESTNET', 'FAUCET', 'AIRDROP', 'ROLLUP',
];

const MAX_WRONG = 6;

function pickWord(): string {
  return WORDS[Math.floor(Math.random() * WORDS.length)]!;
}

function saveHighScore(score: number) {
  const key = 'inksuite-games-hangman-highscore';
  const prev = Number(localStorage.getItem(key) || '0');
  if (score > prev) localStorage.setItem(key, String(score));
}

export function Hangman() {
  const [word, setWord] = useState(pickWord);
  const [guessed, setGuessed] = useState<Set<string>>(new Set());
  const [score, setScore] = useState(0);

  const wrongGuesses = [...guessed].filter((l) => !word.includes(l));
  const wrongCount = wrongGuesses.length;
  const won = word.split('').every((l) => guessed.has(l));
  const lost = wrongCount >= MAX_WRONG;
  const gameOver = won || lost;

  const guess = useCallback(
    (letter: string) => {
      if (gameOver || guessed.has(letter)) return;
      setGuessed((prev) => new Set(prev).add(letter));
    },
    [gameOver, guessed],
  );

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const k = e.key.toUpperCase();
      if (/^[A-Z]$/.test(k)) guess(k);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [guess]);

  useEffect(() => {
    if (won) {
      const pts = Math.max(0, (MAX_WRONG - wrongCount) * 10 + word.length * 5);
      setScore((s) => { const next = s + pts; saveHighScore(next); return next; });
    }
  }, [won, wrongCount, word.length]);

  function newGame() {
    if (lost) setScore(0);
    setWord(pickWord());
    setGuessed(new Set());
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex items-center gap-8">
        <HangmanSvg wrongCount={wrongCount} />
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider text-ink-500">Score</div>
          <div className="font-mono text-3xl font-semibold text-ink-900">{score}</div>
          <div className="mt-2 text-xs text-ink-500">Wrong: {wrongCount}/{MAX_WRONG}</div>
        </div>
      </div>

      <div className="flex gap-2 text-3xl font-mono tracking-widest">
        {word.split('').map((letter, i) => (
          <span key={i} className={`inline-block w-8 border-b-2 text-center ${
            guessed.has(letter) ? 'text-ink-900 border-emerald-400' : gameOver ? 'text-red-500 border-red-400' : 'text-transparent border-purple-300'
          }`}>
            {guessed.has(letter) || gameOver ? letter : '_'}
          </span>
        ))}
      </div>

      {gameOver && (
        <div className={`rounded-lg px-6 py-3 text-center text-sm font-semibold ${
          won ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
        }`}>
          {won ? `Correct! +${Math.max(0, (MAX_WRONG - wrongCount) * 10 + word.length * 5)} points` : `Game over! The word was ${word}`}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-2 max-w-md">
        {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => {
          const isGuessed = guessed.has(letter);
          const isWrong = isGuessed && !word.includes(letter);
          const isCorrect = isGuessed && word.includes(letter);
          return (
            <button
              key={letter}
              onClick={() => guess(letter)}
              disabled={isGuessed || gameOver}
              className={`h-10 w-10 rounded-lg text-sm font-semibold transition ${
                isCorrect ? 'bg-emerald-500/30 text-emerald-300 ring-1 ring-emerald-500/50' :
                isWrong ? 'bg-red-500/20 text-red-300/50 ring-1 ring-red-500/30' :
                isGuessed || gameOver ? 'bg-purple-50/50 text-ink-300 cursor-not-allowed' :
                'bg-white text-ink-900 ring-1 ring-purple-200 hover:bg-purple-100 hover:ring-ink-500'
              }`}
            >
              {letter}
            </button>
          );
        })}
      </div>

      {gameOver && (
        <>
          {won && <MintScoreNFTButton gameId="hangman" gameTitle="Hangman" gameIcon="🔤" score={score} />}
          <button
            onClick={newGame}
            className="rounded-lg bg-ink-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-ink-700"
          >
            {won ? 'Next Word' : 'Try Again'}
          </button>
        </>
      )}
    </div>
  );
}

function HangmanSvg({ wrongCount }: { wrongCount: number }) {
  return (
    <svg viewBox="0 0 120 140" className="h-36 w-28">
      {/* gallows */}
      <line x1="10" y1="135" x2="70" y2="135" stroke="#7538F5" strokeWidth="3" />
      <line x1="30" y1="135" x2="30" y2="10" stroke="#7538F5" strokeWidth="3" />
      <line x1="30" y1="10" x2="80" y2="10" stroke="#7538F5" strokeWidth="3" />
      <line x1="80" y1="10" x2="80" y2="30" stroke="#7538F5" strokeWidth="3" />
      {/* head */}
      {wrongCount >= 1 && <circle cx="80" cy="42" r="12" fill="none" stroke="#3b1d6e" strokeWidth="2" />}
      {/* body */}
      {wrongCount >= 2 && <line x1="80" y1="54" x2="80" y2="90" stroke="#3b1d6e" strokeWidth="2" />}
      {/* left arm */}
      {wrongCount >= 3 && <line x1="80" y1="65" x2="60" y2="80" stroke="#3b1d6e" strokeWidth="2" />}
      {/* right arm */}
      {wrongCount >= 4 && <line x1="80" y1="65" x2="100" y2="80" stroke="#3b1d6e" strokeWidth="2" />}
      {/* left leg */}
      {wrongCount >= 5 && <line x1="80" y1="90" x2="60" y2="115" stroke="#3b1d6e" strokeWidth="2" />}
      {/* right leg */}
      {wrongCount >= 6 && <line x1="80" y1="90" x2="100" y2="115" stroke="#3b1d6e" strokeWidth="2" />}
    </svg>
  );
}
