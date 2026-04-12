'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Board definition ───────────────────────────────────────────────────────
// English board: 7×7 grid, corners (2×2 each) removed → 33 holes
// true  = valid board position
// false = outside the cross shape
const BOARD_SHAPE: boolean[][] = [
  [false, false, true, true, true, false, false],
  [false, false, true, true, true, false, false],
  [true,  true,  true, true, true, true,  true ],
  [true,  true,  true, true, true, true,  true ],
  [true,  true,  true, true, true, true,  true ],
  [false, false, true, true, true, false, false],
  [false, false, true, true, true, false, false],
];

const ROWS = 7;
const COLS = 7;
const CENTER_R = 3;
const CENTER_C = 3;
const LS_KEY = 'inksuite-games-solotest-highscore';

// Cell state: true = peg present, false = empty hole
type Board = boolean[][];

interface Move {
  fromR: number;
  fromC: number;
  overR: number;
  overC: number;
  toR: number;
  toC: number;
}

function createInitialBoard(): Board {
  return Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => {
      if (!BOARD_SHAPE[r][c]) return false;
      // center starts empty
      if (r === CENTER_R && c === CENTER_C) return false;
      return true;
    }),
  );
}

function countPegs(board: Board): number {
  let n = 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (BOARD_SHAPE[r][c] && board[r][c]) n++;
  return n;
}

function getValidMoves(board: Board): Move[] {
  const moves: Move[] = [];
  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!BOARD_SHAPE[r][c] || !board[r][c]) continue;
      for (const [dr, dc] of dirs) {
        const overR = r + dr;
        const overC = c + dc;
        const toR = r + 2 * dr;
        const toC = c + 2 * dc;
        if (
          toR >= 0 && toR < ROWS &&
          toC >= 0 && toC < COLS &&
          BOARD_SHAPE[overR][overC] &&
          BOARD_SHAPE[toR][toC] &&
          board[overR][overC] &&
          !board[toR][toC]
        ) {
          moves.push({ fromR: r, fromC: c, overR, overC, toR, toC });
        }
      }
    }
  }
  return moves;
}

function getValidDestinations(board: Board, r: number, c: number): Array<{ toR: number; toC: number; overR: number; overC: number }> {
  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  const dests: Array<{ toR: number; toC: number; overR: number; overC: number }> = [];
  for (const [dr, dc] of dirs) {
    const overR = r + dr;
    const overC = c + dc;
    const toR = r + 2 * dr;
    const toC = c + 2 * dc;
    if (
      toR >= 0 && toR < ROWS &&
      toC >= 0 && toC < COLS &&
      BOARD_SHAPE[overR][overC] &&
      BOARD_SHAPE[toR][toC] &&
      board[overR][overC] &&
      !board[toR][toC]
    ) {
      dests.push({ toR, toC, overR, overC });
    }
  }
  return dests;
}

function applyMove(board: Board, move: Move): Board {
  const next = board.map(row => [...row]);
  next[move.fromR][move.fromC] = false;
  next[move.overR][move.overC] = false;
  next[move.toR][move.toC] = true;
  return next;
}

// ─── Component ──────────────────────────────────────────────────────────────
export function SoloTest() {
  const [board, setBoard] = useState<Board>(createInitialBoard);
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const [history, setHistory] = useState<{ board: Board; move: Move }[]>([]);
  const [highScore, setHighScore] = useState<number | null>(null);
  const [pulseKey, setPulseKey] = useState(0); // forces re-animation

  // Load best score from localStorage once
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored !== null) setHighScore(Number(stored));
    } catch {
      // ignore
    }
  }, []);

  const pegsLeft = countPegs(board);
  const validMoves = getValidMoves(board);
  const isWon = pegsLeft === 1;
  const isLost = !isWon && validMoves.length === 0;
  const gameOver = isWon || isLost;

  // Save high score when game ends
  useEffect(() => {
    if (!gameOver) return;
    const prev = highScore;
    if (prev === null || pegsLeft < prev) {
      setHighScore(pegsLeft);
      try {
        localStorage.setItem(LS_KEY, String(pegsLeft));
      } catch {
        // ignore
      }
    }
  }, [gameOver]); // eslint-disable-line react-hooks/exhaustive-deps

  // Destinations for selected peg
  const destinations = selected
    ? getValidDestinations(board, selected.r, selected.c)
    : [];
  const destSet = new Set(destinations.map(d => `${d.toR},${d.toC}`));

  const handleCellClick = useCallback(
    (r: number, c: number) => {
      if (gameOver) return;

      // Clicking a destination → execute move
      if (selected && destSet.has(`${r},${c}`)) {
        const dest = destinations.find(d => d.toR === r && d.toC === c)!;
        const move: Move = {
          fromR: selected.r,
          fromC: selected.c,
          overR: dest.overR,
          overC: dest.overC,
          toR: r,
          toC: c,
        };
        const nextBoard = applyMove(board, move);
        setHistory(h => [...h, { board, move }]);
        setBoard(nextBoard);
        setMoveCount(m => m + 1);
        setSelected(null);
        setPulseKey(k => k + 1);
        return;
      }

      // Clicking own peg → select it (or deselect if already selected)
      if (board[r][c]) {
        if (selected && selected.r === r && selected.c === c) {
          setSelected(null);
        } else {
          setSelected({ r, c });
          setPulseKey(k => k + 1);
        }
        return;
      }

      // Clicking empty hole that is not a valid dest → deselect
      setSelected(null);
    },
    [board, selected, destinations, destSet, gameOver],
  );

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setBoard(last.board);
    setHistory(h => h.slice(0, -1));
    setMoveCount(m => m - 1);
    setSelected(null);
  }, [history]);

  const handleReset = useCallback(() => {
    setBoard(createInitialBoard());
    setSelected(null);
    setMoveCount(0);
    setHistory([]);
    setPulseKey(0);
  }, []);

  // ─── SVG sizing ──────────────────────────────────────────────────────────
  const CELL = 52;          // px per cell
  const PAD  = 24;          // padding around the grid
  const R_HOLE = 16;        // radius of hole circles
  const R_PEG  = 20;        // radius of peg circles
  const svgW = COLS * CELL + PAD * 2;
  const svgH = ROWS * CELL + PAD * 2;

  const cx = (c: number) => PAD + c * CELL + CELL / 2;
  const cy = (r: number) => PAD + r * CELL + CELL / 2;

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      {/* Header */}
      <div className="flex items-center gap-6 text-sm font-medium text-ink-700">
        <span>Moves: <span className="font-bold text-ink-900">{moveCount}</span></span>
        <span>Pegs left: <span className="font-bold text-ink-900">{pegsLeft}</span></span>
        {highScore !== null && (
          <span>Best: <span className="font-bold text-ink-900">{highScore} peg{highScore !== 1 ? 's' : ''}</span></span>
        )}
      </div>

      {/* Status banner */}
      {isWon && (
        <div className="rounded-xl bg-emerald-100 border border-emerald-300 px-5 py-2 text-emerald-800 font-semibold text-sm text-center">
          You won! One peg remaining{pegsLeft === 1 && board[CENTER_R][CENTER_C] ? ' in the center!' : '.'}
        </div>
      )}
      {isLost && !isWon && (
        <div className="rounded-xl bg-amber-100 border border-amber-300 px-5 py-2 text-amber-800 font-semibold text-sm text-center">
          No moves left — {pegsLeft} pegs remaining.
        </div>
      )}

      {/* Board SVG */}
      <div className="rounded-2xl bg-purple-100 shadow-inner p-1">
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          aria-label="Peg Solitaire board"
        >
          <defs>
            {/* Pulse animation for valid destinations */}
            <style>{`
              @keyframes solo-pulse {
                0%   { r: ${R_HOLE - 2}; opacity: 0.55; }
                50%  { r: ${R_HOLE + 3}; opacity: 0.90; }
                100% { r: ${R_HOLE - 2}; opacity: 0.55; }
              }
              .solo-dest-ring { animation: solo-pulse 1s ease-in-out infinite; }
            `}</style>
            {/* Glow filter for selected peg */}
            <filter id="solo-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Board cells */}
          {Array.from({ length: ROWS }, (_, r) =>
            Array.from({ length: COLS }, (_, c) => {
              if (!BOARD_SHAPE[r][c]) return null;

              const x = cx(c);
              const y = cy(r);
              const isSelected = selected?.r === r && selected?.c === c;
              const isDest = destSet.has(`${r},${c}`);
              const hasPeg = board[r][c];

              return (
                <g
                  key={`${r}-${c}`}
                  onClick={() => handleCellClick(r, c)}
                  style={{ cursor: gameOver ? 'default' : 'pointer' }}
                >
                  {/* Hole background */}
                  <circle
                    cx={x}
                    cy={y}
                    r={R_HOLE}
                    fill={hasPeg ? '#e9d5ff' : '#d1d5db'}
                    stroke="#a78bfa"
                    strokeWidth={1}
                  />

                  {/* Valid destination indicator (ring pulse) */}
                  {isDest && !hasPeg && (
                    <>
                      <circle
                        key={`dest-ring-${pulseKey}-${r}-${c}`}
                        cx={x}
                        cy={y}
                        r={R_HOLE - 2}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        className="solo-dest-ring"
                      />
                      <circle
                        cx={x}
                        cy={y}
                        r={8}
                        fill="#10b981"
                        opacity={0.35}
                      />
                    </>
                  )}

                  {/* Peg */}
                  {hasPeg && (
                    <circle
                      cx={x}
                      cy={y}
                      r={R_PEG}
                      fill={isSelected ? '#f59e0b' : '#7538F5'}
                      stroke={isSelected ? '#d97706' : '#5b21b6'}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                      filter={isSelected ? 'url(#solo-glow)' : undefined}
                      opacity={0.95}
                    />
                  )}

                  {/* Highlight ring on selected peg */}
                  {isSelected && hasPeg && (
                    <circle
                      cx={x}
                      cy={y}
                      r={R_PEG + 4}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      opacity={0.7}
                    />
                  )}
                </g>
              );
            }),
          )}
        </svg>
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        <button
          onClick={handleUndo}
          disabled={history.length === 0}
          className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 shadow-sm transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ↩ Undo
        </button>
        <button
          onClick={handleReset}
          className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 shadow-sm transition hover:bg-ink-50"
        >
          ↺ Reset
        </button>
      </div>

      {/* Instructions */}
      <p className="text-xs text-ink-500 text-center max-w-xs">
        Click a peg to select it, then click a highlighted hole to jump. Remove pegs by jumping over them. Goal: leave just one peg.
      </p>
    </div>
  );
}
