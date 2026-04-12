'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { puzzles, type CrosswordPuzzle } from './crossword-data';

// ─── Types ────────────────────────────────────────────────────────────────────

type CellState = 'idle' | 'correct' | 'incorrect';
type Direction = 'across' | 'down';

interface ActiveClue {
  direction: Direction;
  number: number;
  row: number;
  col: number;
  answer: string;
  cells: [number, number][];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LS_KEY = 'inksuite-games-crossword-highscore';

function getHighScore(): number {
  if (typeof window === 'undefined') return 0;
  return Number(localStorage.getItem(LS_KEY) || '0');
}

function setHighScore(n: number) {
  if (typeof window === 'undefined') return;
  const prev = getHighScore();
  if (n > prev) localStorage.setItem(LS_KEY, String(n));
}

function pickPuzzle(exclude?: number): CrosswordPuzzle {
  const candidates = exclude !== undefined ? puzzles.filter((p) => p.id !== exclude) : puzzles;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/** Return all cells belonging to an across or down word starting at (row, col). */
function getWordCells(
  grid: (string | null)[][],
  row: number,
  col: number,
  dir: Direction,
): [number, number][] {
  const cells: [number, number][] = [];
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  let r = row;
  let c = col;
  while (r < rows && c < cols && grid[r][c] !== null) {
    cells.push([r, c]);
    if (dir === 'across') c++;
    else r++;
  }
  return cells;
}

/** Compute clue number assignments that match cells correctly. */
function buildClueCells(puzzle: CrosswordPuzzle): Map<string, [number, number][]> {
  const map = new Map<string, [number, number][]>();
  for (const clue of puzzle.clues.across) {
    map.set(`across-${clue.number}`, getWordCells(puzzle.grid, clue.row, clue.col, 'across'));
  }
  for (const clue of puzzle.clues.down) {
    map.set(`down-${clue.number}`, getWordCells(puzzle.grid, clue.row, clue.col, 'down'));
  }
  return map;
}

/** Given a cell, find which clue starts there or contains it. Prefer the active direction. */
function findClueForCell(
  puzzle: CrosswordPuzzle,
  row: number,
  col: number,
  preferredDir: Direction,
  clueCells: Map<string, [number, number][]>,
): ActiveClue | null {
  // Try preferred direction first, then the other
  const directions: Direction[] = preferredDir === 'across' ? ['across', 'down'] : ['down', 'across'];
  for (const dir of directions) {
    const clueList = dir === 'across' ? puzzle.clues.across : puzzle.clues.down;
    for (const clue of clueList) {
      const key = `${dir}-${clue.number}`;
      const cells = clueCells.get(key) ?? [];
      if (cells.some(([r, c]) => r === row && c === col)) {
        return { direction: dir, number: clue.number, row: clue.row, col: clue.col, answer: clue.answer, cells };
      }
    }
  }
  return null;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Crossword() {
  const [puzzle, setPuzzle] = useState<CrosswordPuzzle>(() => pickPuzzle());
  const rows = puzzle.grid.length;
  const cols = puzzle.grid[0]?.length ?? 0;
  // Smaller cells for larger grids
  const cellSize = cols <= 5 ? 3 : cols <= 8 ? 2.5 : 2;
  const [userGrid, setUserGrid] = useState<string[][]>(() => Array.from({ length: rows }, () => Array(cols).fill('')));
  const [cellStates, setCellStates] = useState<CellState[][]>(() =>
    Array.from({ length: rows }, () => Array(cols).fill('idle' as CellState)),
  );
  const [activeClue, setActiveClue] = useState<ActiveClue | null>(null);
  const [activeCell, setActiveCell] = useState<[number, number] | null>(null);
  const [completed, setCompleted] = useState(0);
  const [highScore, setHighScoreState] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [checked, setChecked] = useState(false);

  const clueCells = buildClueCells(puzzle);
  const inputRefs = useRef<(HTMLInputElement | null)[][]>(
    Array.from({ length: rows }, () => Array(cols).fill(null)),
  );

  // Load high score on mount
  useEffect(() => {
    setHighScoreState(getHighScore());
    setCompleted(getHighScore());
  }, []);

  // Focus cell helper
  const focusCell = useCallback((row: number, col: number) => {
    inputRefs.current[row]?.[col]?.focus();
  }, []);

  // Select a clue and highlight it
  const selectClue = useCallback(
    (dir: Direction, number: number, focusFirst = true) => {
      const clueList = dir === 'across' ? puzzle.clues.across : puzzle.clues.down;
      const clue = clueList.find((c) => c.number === number);
      if (!clue) return;
      const key = `${dir}-${number}`;
      const cells = clueCells.get(key) ?? [];
      setActiveClue({ direction: dir, number, row: clue.row, col: clue.col, answer: clue.answer, cells });
      if (focusFirst && cells.length > 0) {
        const [r, c] = cells[0];
        setActiveCell([r, c]);
        focusCell(r, c);
      }
    },
    [puzzle, clueCells, focusCell],
  );

  // Handle clicking a grid cell
  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (puzzle.grid[row][col] === null) return;

      // If clicking the already-active cell, toggle direction
      let newDir: Direction = activeClue?.direction ?? 'across';
      if (activeCell && activeCell[0] === row && activeCell[1] === col) {
        newDir = newDir === 'across' ? 'down' : 'across';
      }

      const clue = findClueForCell(puzzle, row, col, newDir, clueCells);
      if (clue) {
        setActiveClue(clue);
        setActiveCell([row, col]);
        focusCell(row, col);
      }
    },
    [puzzle, activeClue, activeCell, clueCells, focusCell],
  );

  // Handle typing a letter
  const handleInput = useCallback(
    (row: number, col: number, value: string) => {
      if (revealed) return;
      const letter = value.replace(/[^a-zA-Z]/g, '').slice(-1).toUpperCase();

      setUserGrid((prev) => {
        const next = prev.map((r) => [...r]);
        next[row][col] = letter;
        return next;
      });
      setCellStates((prev) => {
        const next = prev.map((r) => [...r]);
        next[row][col] = 'idle';
        return next;
      });
      setChecked(false);

      // Advance to next cell in the active clue
      if (letter && activeClue) {
        const idx = activeClue.cells.findIndex(([r, c]) => r === row && c === col);
        if (idx >= 0 && idx < activeClue.cells.length - 1) {
          const [nr, nc] = activeClue.cells[idx + 1];
          setActiveCell([nr, nc]);
          focusCell(nr, nc);
        }
      }
    },
    [revealed, activeClue, focusCell],
  );

  // Handle backspace / navigation keys
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) => {
      if (e.key === 'Backspace') {
        if (userGrid[row][col] !== '') {
          setUserGrid((prev) => {
            const next = prev.map((r) => [...r]);
            next[row][col] = '';
            return next;
          });
          setCellStates((prev) => {
            const next = prev.map((r) => [...r]);
            next[row][col] = 'idle';
            return next;
          });
        } else if (activeClue) {
          // Move back one cell
          const idx = activeClue.cells.findIndex(([r, c]) => r === row && c === col);
          if (idx > 0) {
            const [pr, pc] = activeClue.cells[idx - 1];
            setActiveCell([pr, pc]);
            focusCell(pr, pc);
          }
        }
        e.preventDefault();
        return;
      }

      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        if (!activeClue) return;
        const idx = activeClue.cells.findIndex(([r, c]) => r === row && c === col);
        if (idx >= 0 && idx < activeClue.cells.length - 1) {
          const [nr, nc] = activeClue.cells[idx + 1];
          setActiveCell([nr, nc]);
          focusCell(nr, nc);
        }
        return;
      }

      // Arrow keys
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        selectClue('across', activeClue?.number ?? puzzle.clues.across[0]?.number ?? 1, false);
        if (col < cols - 1 && puzzle.grid[row][col + 1] !== null) {
          setActiveCell([row, col + 1]);
          focusCell(row, col + 1);
        }
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (col > 0 && puzzle.grid[row][col - 1] !== null) {
          setActiveCell([row, col - 1]);
          focusCell(row, col - 1);
        }
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (row < rows - 1 && puzzle.grid[row + 1]?.[col] !== null) {
          setActiveCell([row + 1, col]);
          focusCell(row + 1, col);
        }
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (row > 0 && puzzle.grid[row - 1]?.[col] !== null) {
          setActiveCell([row - 1, col]);
          focusCell(row - 1, col);
        }
        return;
      }
    },
    [userGrid, activeClue, focusCell, selectClue, puzzle],
  );

  // Check answers
  const handleCheck = useCallback(() => {
    setChecked(true);
    let allCorrect = true;
    const nextStates: CellState[][] = Array.from({ length: rows }, () => Array(cols).fill('idle' as CellState));

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (puzzle.grid[r][c] === null) continue;
        const entered = userGrid[r][c];
        if (!entered) {
          allCorrect = false;
          nextStates[r][c] = 'idle';
        } else if (entered === puzzle.grid[r][c]) {
          nextStates[r][c] = 'correct';
        } else {
          nextStates[r][c] = 'incorrect';
          allCorrect = false;
        }
      }
    }

    setCellStates(nextStates);

    if (allCorrect) {
      const next = completed + 1;
      setCompleted(next);
      setHighScore(next);
      setHighScoreState(getHighScore());
    }
  }, [puzzle, userGrid, completed, rows, cols]);

  // Reveal all answers
  const handleReveal = useCallback(() => {
    setRevealed(true);
    const filled: string[][] = puzzle.grid.map((row) => row.map((cell) => cell ?? ''));
    setUserGrid(filled);
    const states: CellState[][] = puzzle.grid.map((row) =>
      row.map((cell) => (cell !== null ? 'correct' : 'idle')),
    );
    setCellStates(states);
    setChecked(true);
  }, [puzzle]);

  // Load a new puzzle
  const handleNewPuzzle = useCallback(() => {
    const next = pickPuzzle(puzzle.id);
    const newRows = next.grid.length;
    const newCols = next.grid[0]?.length ?? 0;
    setPuzzle(next);
    setUserGrid(Array.from({ length: newRows }, () => Array(newCols).fill('')));
    setCellStates(Array.from({ length: newRows }, () => Array(newCols).fill('idle' as CellState)));
    setActiveClue(null);
    setActiveCell(null);
    setRevealed(false);
    setChecked(false);
  }, [puzzle.id]);

  // Determine cell number (clue starting number)
  const cellNumber = useCallback(
    (row: number, col: number): number | null => {
      for (const clue of [...puzzle.clues.across, ...puzzle.clues.down]) {
        if (clue.row === row && clue.col === col) return clue.number;
      }
      return null;
    },
    [puzzle],
  );

  // Check if a cell is in the active clue word
  const isCellHighlighted = useCallback(
    (row: number, col: number): boolean => {
      if (!activeClue) return false;
      return activeClue.cells.some(([r, c]) => r === row && c === col);
    },
    [activeClue],
  );

  const isActiveCell = useCallback(
    (row: number, col: number): boolean => {
      return activeCell !== null && activeCell[0] === row && activeCell[1] === col;
    },
    [activeCell],
  );

  // Cell background class
  const cellBg = (row: number, col: number): string => {
    if (puzzle.grid[row][col] === null) return 'bg-ink-900';
    const state = cellStates[row][col];
    if (state === 'correct') return 'bg-emerald-50';
    if (state === 'incorrect') return 'bg-red-50';
    if (isActiveCell(row, col)) return 'bg-white';
    if (isCellHighlighted(row, col)) return 'bg-purple-100';
    return 'bg-white';
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-ink-500">Puzzles Solved</div>
          <div className="font-mono text-2xl font-semibold text-ink-900">{completed}</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold text-ink-700">{puzzle.title}</div>
          <div className="text-xs text-ink-400">#{puzzle.id}</div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider text-ink-500">Best</div>
          <div className="font-mono text-2xl font-semibold text-ink-900">{highScore}</div>
        </div>
      </div>

      {/* Main layout: grid + clues */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {/* Grid */}
        <div className="flex-shrink-0 overflow-x-auto">
          <div
            className="inline-grid gap-0.5"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              width: `calc(${cols} * ${cellSize}rem + ${cols - 1} * 2px)`,
            }}
          >
            {Array.from({ length: rows }, (_, row) =>
              Array.from({ length: cols }, (_, col) => {
                const isBlack = puzzle.grid[row][col] === null;
                const num = cellNumber(row, col);
                const highlight = isCellHighlighted(row, col);
                const active = isActiveCell(row, col);

                if (isBlack) {
                  return (
                    <div
                      key={`${row}-${col}`}
                      className="bg-ink-900 rounded-sm"
                      style={{ height: `${cellSize}rem`, width: `${cellSize}rem` }}
                    />
                  );
                }

                return (
                  <div
                    key={`${row}-${col}`}
                    className={`relative rounded-sm ring-1 ${
                      active
                        ? 'ring-2 ring-ink-500'
                        : highlight
                        ? 'ring-purple-300'
                        : 'ring-purple-200'
                    } ${cellBg(row, col)} cursor-pointer transition-colors`}
                    style={{ height: `${cellSize}rem`, width: `${cellSize}rem` }}
                    onClick={() => handleCellClick(row, col)}
                  >
                    {num !== null && (
                      <span className="absolute left-0.5 top-0.5 text-[7px] font-semibold leading-none text-ink-500 select-none">
                        {num}
                      </span>
                    )}
                    <input
                      ref={(el) => {
                        if (!inputRefs.current[row]) inputRefs.current[row] = [];
                        inputRefs.current[row][col] = el;
                      }}
                      type="text"
                      maxLength={1}
                      value={userGrid[row]?.[col] ?? ''}
                      readOnly={revealed}
                      className={`h-full w-full bg-transparent text-center font-semibold uppercase caret-transparent outline-none select-none ${
                        cols > 8 ? 'text-xs' : 'text-base'
                      } ${
                        cellStates[row]?.[col] === 'correct'
                          ? 'text-emerald-700'
                          : cellStates[row]?.[col] === 'incorrect'
                          ? 'text-red-600'
                          : 'text-ink-900'
                      } ${num !== null ? 'pt-2' : ''}`}
                      onChange={(e) => handleInput(row, col, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, row, col)}
                      onFocus={() => {
                        setActiveCell([row, col]);
                        const clue = findClueForCell(
                          puzzle,
                          row,
                          col,
                          activeClue?.direction ?? 'across',
                          clueCells,
                        );
                        if (clue) setActiveClue(clue);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCellClick(row, col);
                      }}
                    />
                  </div>
                );
              }),
            )}
          </div>

          {/* Action buttons */}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={handleCheck}
              disabled={revealed}
              className="rounded-lg bg-ink-500 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Check
            </button>
            <button
              onClick={handleReveal}
              disabled={revealed}
              className="rounded-lg bg-purple-100 px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-purple-200 hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Reveal
            </button>
            <button
              onClick={handleNewPuzzle}
              className="rounded-lg bg-purple-100 px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-purple-200 hover:bg-purple-200 transition"
            >
              New Puzzle
            </button>
          </div>

          {/* Feedback banner */}
          {checked && !revealed && (() => {
            const allCorrect = cellStates.flat().filter((_, i) => {
              const r = Math.floor(i / cols);
              const c = i % cols;
              return puzzle.grid[r]?.[c] !== null;
            }).every((s) => s === 'correct');
            return (
              <div
                className={`mt-3 rounded-lg px-4 py-2 text-sm font-semibold ${
                  allCorrect
                    ? 'bg-emerald-500/20 text-emerald-700'
                    : 'bg-red-500/10 text-red-600'
                }`}
              >
                {allCorrect
                  ? `Puzzle solved! Total solved: ${completed}`
                  : 'Some answers are incorrect — highlighted in red.'}
              </div>
            );
          })()}
        </div>

        {/* Clues panel */}
        <div className="flex-1 space-y-4 min-w-0 sm:max-h-[30rem] sm:overflow-y-auto sm:pr-2">
          {/* Across clues */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">Across</h3>
            <ul className="space-y-1">
              {puzzle.clues.across.map((clue) => {
                const isActive =
                  activeClue?.direction === 'across' && activeClue.number === clue.number;
                return (
                  <li key={`across-${clue.number}`}>
                    <button
                      onClick={() => selectClue('across', clue.number)}
                      className={`w-full rounded-md px-2 py-1 text-left text-sm transition ${
                        isActive
                          ? 'bg-purple-100 font-semibold text-ink-900'
                          : 'text-ink-600 hover:bg-purple-50 hover:text-ink-900'
                      }`}
                    >
                      <span className="mr-1.5 font-mono text-xs text-ink-500">{clue.number}.</span>
                      {clue.text}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Down clues */}
          {puzzle.clues.down.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">Down</h3>
            <ul className="space-y-1">
              {puzzle.clues.down.map((clue) => {
                const isActive =
                  activeClue?.direction === 'down' && activeClue.number === clue.number;
                return (
                  <li key={`down-${clue.number}`}>
                    <button
                      onClick={() => selectClue('down', clue.number)}
                      className={`w-full rounded-md px-2 py-1 text-left text-sm transition ${
                        isActive
                          ? 'bg-purple-100 font-semibold text-ink-900'
                          : 'text-ink-600 hover:bg-purple-50 hover:text-ink-900'
                      }`}
                    >
                      <span className="mr-1.5 font-mono text-xs text-ink-500">{clue.number}.</span>
                      {clue.text}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          )}

          {/* Active clue highlight */}
          {activeClue && (
            <div className="rounded-lg bg-purple-50 px-3 py-2 ring-1 ring-inset ring-purple-200">
              <div className="text-xs text-ink-500 uppercase tracking-wider mb-0.5">
                {activeClue.number} {activeClue.direction}
              </div>
              <div className="text-sm font-medium text-ink-900">
                {(activeClue.direction === 'across'
                  ? puzzle.clues.across
                  : puzzle.clues.down
                ).find((c) => c.number === activeClue.number)?.text}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
