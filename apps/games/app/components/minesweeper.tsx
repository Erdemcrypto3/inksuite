'use client';

import { useCallback, useState } from 'react';

const ROWS = 9;
const COLS = 9;
const MINES = 10;

type CellState = { mine: boolean; revealed: boolean; flagged: boolean; adjacent: number };
type Board = CellState[][];
type GameStatus = 'playing' | 'won' | 'lost';

function createBoard(firstR: number, firstC: number): Board {
  const board: Board = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ mine: false, revealed: false, flagged: false, adjacent: 0 })),
  );
  let placed = 0;
  while (placed < MINES) {
    const r = Math.floor(Math.random() * ROWS);
    const c = Math.floor(Math.random() * COLS);
    if (board[r][c].mine || (Math.abs(r - firstR) <= 1 && Math.abs(c - firstC) <= 1)) continue;
    board[r][c].mine = true;
    placed++;
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c].mine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr][nc].mine) count++;
      }
      board[r][c].adjacent = count;
    }
  }
  return board;
}

function cloneBoard(b: Board): Board {
  return b.map((row) => row.map((c) => ({ ...c })));
}

function floodReveal(board: Board, r: number, c: number) {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
  const cell = board[r][c];
  if (cell.revealed || cell.flagged || cell.mine) return;
  cell.revealed = true;
  if (cell.adjacent === 0) {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) floodReveal(board, r + dr, c + dc);
  }
}

function checkWin(board: Board): boolean {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (!board[r][c].mine && !board[r][c].revealed) return false;
  }
  return true;
}

function saveHighScore(score: number) {
  const key = 'inksuite-games-minesweeper-highscore';
  const prev = Number(localStorage.getItem(key) || '0');
  if (score > prev) localStorage.setItem(key, String(score));
}

const ADJ_COLORS = ['', 'text-blue-700', 'text-green-700', 'text-red-600', 'text-purple-700', 'text-amber-700', 'text-cyan-700', 'text-pink-700', 'text-gray-600'];

export function Minesweeper() {
  const [board, setBoard] = useState<Board | null>(null);
  const [status, setStatus] = useState<GameStatus>('playing');
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsed, setElapsed] = useState(0);
  const [score, setScore] = useState(0);

  const startGame = useCallback((r: number, c: number) => {
    const b = createBoard(r, c);
    floodReveal(b, r, c);
    setBoard(b);
    setStartTime(Date.now());
    setStatus('playing');
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - Date.now()) / 1000));
    }, 1000);
    setElapsed(0);
    return () => clearInterval(interval);
  }, []);

  function handleClick(r: number, c: number) {
    if (status !== 'playing') return;
    if (!board) {
      startGame(r, c);
      return;
    }
    const b = cloneBoard(board);
    const cell = b[r][c];
    if (cell.revealed || cell.flagged) return;
    if (cell.mine) {
      for (let rr = 0; rr < ROWS; rr++) for (let cc = 0; cc < COLS; cc++) {
        if (b[rr][cc].mine) b[rr][cc].revealed = true;
      }
      setBoard(b);
      setStatus('lost');
      return;
    }
    floodReveal(b, r, c);
    setBoard(b);
    if (checkWin(b)) {
      const time = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
      const pts = Math.max(10, Math.floor(1000 / time) + MINES * 10);
      saveHighScore(pts);
      setScore(pts);
      setStatus('won');
    }
  }

  function handleRightClick(e: React.MouseEvent, r: number, c: number) {
    e.preventDefault();
    if (status !== 'playing' || !board) return;
    const b = cloneBoard(board);
    const cell = b[r][c];
    if (cell.revealed) return;
    cell.flagged = !cell.flagged;
    setBoard(b);
  }

  function reset() {
    setBoard(null);
    setStatus('playing');
    setScore(0);
    setElapsed(0);
  }

  const flagCount = board ? board.flat().filter((c) => c.flagged).length : 0;

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex items-center gap-6 text-sm text-ink-700">
        <span>Mines: <span className="font-mono text-ink-900">{MINES - flagCount}</span></span>
        <span>Grid: {ROWS}×{COLS}</span>
        {status === 'won' && <span className="text-emerald-300 font-semibold">Won! Score: {score}</span>}
        {status === 'lost' && <span className="text-red-300 font-semibold">Mine hit!</span>}
      </div>

      <div
        className="inline-grid gap-0.5 rounded-lg bg-purple-100 p-2 ring-1 ring-inset ring-purple-200 shadow-lg"
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {Array.from({ length: ROWS }, (_, r) =>
          Array.from({ length: COLS }, (_, c) => {
            const cell = board?.[r]?.[c];
            const revealed = cell?.revealed ?? false;
            const flagged = cell?.flagged ?? false;
            const mine = cell?.mine ?? false;
            const adj = cell?.adjacent ?? 0;

            return (
              <button
                key={`${r}-${c}`}
                onClick={() => handleClick(r, c)}
                onContextMenu={(e) => handleRightClick(e, r, c)}
                className={`h-8 w-8 text-xs font-bold transition-colors ${
                  revealed
                    ? mine
                      ? 'bg-red-400 text-white'
                      : 'bg-white text-gray-800'
                    : flagged
                    ? 'bg-amber-300 text-amber-800'
                    : 'bg-purple-300 hover:bg-purple-200 cursor-pointer shadow-sm'
                } rounded-sm`}
              >
                {revealed
                  ? mine
                    ? '💣'
                    : adj > 0
                    ? <span className={ADJ_COLORS[adj]}>{adj}</span>
                    : ''
                  : flagged
                  ? '🚩'
                  : ''}
              </button>
            );
          }),
        )}
      </div>

      {!board && (
        <p className="text-sm text-ink-500">Click any cell to start. Right-click to flag.</p>
      )}

      {(status === 'won' || status === 'lost') && (
        <button onClick={reset} className="rounded-lg bg-ink-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-ink-700">
          New Game
        </button>
      )}
    </div>
  );
}
