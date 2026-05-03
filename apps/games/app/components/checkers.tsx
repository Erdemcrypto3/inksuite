'use client';

import { useCallback, useEffect, useState } from 'react';
import { MintScoreNFTButton } from './mint-score-nft';

// ─── Types ────────────────────────────────────────────────────────────────────

type Player = 'dark' | 'light';
type PieceType = 'man' | 'king';

interface Piece {
  player: Player;
  type: PieceType;
}

type Cell = Piece | null;
type Board = Cell[][];

interface Position {
  row: number;
  col: number;
}

interface Move {
  from: Position;
  to: Position;
  captured: Position[]; // all positions of captured pieces
}

type GameStatus = 'playing' | 'dark-wins' | 'light-wins' | 'draw';

interface GameState {
  board: Board;
  turn: Player;
  status: GameStatus;
  selectedPos: Position | null;
  validMoves: Move[];
  moveCount: number;
  noCaptureMoves: number;
  capturedDark: number;  // dark pieces captured by light
  capturedLight: number; // light pieces captured by dark
  wins: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BOARD_SIZE = 8;
const DRAW_LIMIT = 50;

const COLORS = {
  lightSquare: '#f0efff',
  darkSquare: '#7538F5',
  darkSquareAlpha: 'rgba(117,56,245,0.35)',
  playerPiece: '#1e1b2e',
  playerPieceBorder: '#0d0b17',
  aiPiece: '#e0d9ff',
  aiPieceBorder: '#9d8fe8',
  selectedRing: '#f59e0b',
  validDot: '#10b981',
  kingMarker: '#f0efff',
  kingMarkerDark: '#7538F5',
};

// ─── Board helpers ────────────────────────────────────────────────────────────

function createInitialBoard(): Board {
  const board: Board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
  // Light (AI) pieces: rows 0-2
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if ((r + c) % 2 === 1) {
        board[r]![c] = { player: 'light', type: 'man' };
      }
    }
  }
  // Dark (Player) pieces: rows 5-7
  for (let r = 5; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if ((r + c) % 2 === 1) {
        board[r]![c] = { player: 'dark', type: 'man' };
      }
    }
  }
  return board;
}

function cloneBoard(board: Board): Board {
  return board.map(row => row.map(cell => cell ? { ...cell } : null));
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}

// Get all jump moves from a position (recursive for multi-jump)
function getJumpsFrom(
  board: Board,
  pos: Position,
  piece: Piece,
  capturedSoFar: Position[],
): Move[] {
  const { row, col } = pos;
  const dirs: [number, number][] = [];

  if (piece.type === 'king' || piece.player === 'dark') dirs.push([-1, -1], [-1, 1]);
  if (piece.type === 'king' || piece.player === 'light') dirs.push([1, -1], [1, 1]);

  const moves: Move[] = [];

  for (const [dr, dc] of dirs) {
    const midR = row + dr;
    const midC = col + dc;
    const landR = row + 2 * dr;
    const landC = col + 2 * dc;

    if (!inBounds(midR, midC) || !inBounds(landR, landC)) continue;
    const midCell = board[midR]![midC];
    const landCell = board[landR]![landC];

    // Must jump over opponent
    if (!midCell || midCell.player === piece.player) continue;
    // Landing must be empty
    if (landCell !== null) continue;
    // Can't re-capture same piece
    const midPos = { row: midR, col: midC };
    if (capturedSoFar.some(p => p.row === midR && p.col === midC)) continue;

    // Simulate the jump
    const newBoard = cloneBoard(board);
    newBoard[landR]![landC] = newBoard[row]![col] ?? null;
    newBoard[row]![col] = null;
    newBoard[midR]![midC] = null;

    // Check for king promotion mid-jump
    const movedPiece = newBoard[landR]![landC]!;
    const becameKing = (piece.player === 'dark' && landR === 0) || (piece.player === 'light' && landR === 7);
    if (becameKing) movedPiece.type = 'king';

    const newCaptured = [...capturedSoFar, midPos];

    // Try to continue jumping
    const continuations = becameKing
      ? [] // kings can't continue multi-jump after promotion
      : getJumpsFrom(newBoard, { row: landR, col: landC }, movedPiece, newCaptured);

    if (continuations.length > 0) {
      // Return all continuations (they include the full capture chain)
      for (const cont of continuations) {
        moves.push({
          from: pos,
          to: cont.to,
          captured: newCaptured.concat(cont.captured.filter(p => !newCaptured.some(cp => cp.row === p.row && cp.col === p.col))),
        });
      }
    } else {
      moves.push({
        from: pos,
        to: { row: landR, col: landC },
        captured: newCaptured,
      });
    }
  }

  return moves;
}

// Get all simple (non-capture) moves from a position
function getSimpleMovesFrom(board: Board, pos: Position, piece: Piece): Move[] {
  const { row, col } = pos;
  const dirs: [number, number][] = [];

  if (piece.type === 'king' || piece.player === 'dark') dirs.push([-1, -1], [-1, 1]);
  if (piece.type === 'king' || piece.player === 'light') dirs.push([1, -1], [1, 1]);

  const moves: Move[] = [];
  for (const [dr, dc] of dirs) {
    const nr = row + dr;
    const nc = col + dc;
    if (inBounds(nr, nc) && board[nr]![nc] === null) {
      moves.push({ from: pos, to: { row: nr, col: nc }, captured: [] });
    }
  }
  return moves;
}

// Get all valid moves for a player (mandatory capture enforced)
function getAllMoves(board: Board, player: Player): Move[] {
  const jumpMoves: Move[] = [];
  const simpleMoves: Move[] = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = board[r]![c];
      if (!cell || cell.player !== player) continue;
      const pos = { row: r, col: c };
      const jumps = getJumpsFrom(board, pos, cell, []);
      jumpMoves.push(...jumps);
      if (jumpMoves.length === 0) {
        simpleMoves.push(...getSimpleMovesFrom(board, pos, cell));
      }
    }
  }

  // Re-scan simple moves only if no jumps
  if (jumpMoves.length > 0) return jumpMoves;

  // Need to get simple moves again since we short-circuited above
  const allSimple: Move[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = board[r]![c];
      if (!cell || cell.player !== player) continue;
      allSimple.push(...getSimpleMovesFrom(board, { row: r, col: c }, cell));
    }
  }
  return allSimple;
}

// Apply a move to board, returns new board
function applyMove(board: Board, move: Move): Board {
  const newBoard = cloneBoard(board);
  const piece = newBoard[move.from.row]![move.from.col]!;
  newBoard[move.to.row]![move.to.col] = { ...piece };
  newBoard[move.from.row]![move.from.col] = null;
  for (const cap of move.captured) {
    newBoard[cap.row]![cap.col] = null;
  }
  // King promotion
  const movedPiece = newBoard[move.to.row]![move.to.col]!;
  if (movedPiece.player === 'dark' && move.to.row === 0) movedPiece.type = 'king';
  if (movedPiece.player === 'light' && move.to.row === 7) movedPiece.type = 'king';
  return newBoard;
}

// Get valid moves for a specific piece (filtered from all moves, respecting mandatory capture)
function getMovesForPiece(allMoves: Move[], pos: Position): Move[] {
  return allMoves.filter(m => m.from.row === pos.row && m.from.col === pos.col);
}

// ─── AI Logic ─────────────────────────────────────────────────────────────────

function scoreMove(move: Move, board: Board): number {
  let score = 0;
  // Captures are highest priority, more captures = better
  score += move.captured.length * 100;

  // King moves
  const piece = board[move.from.row]![move.from.col];
  if (piece?.type === 'king') score += 10;

  // Forward progress for light (moving toward row 7)
  score += move.to.row * 2;

  // Favor center positions
  const centerDist = Math.abs(move.to.col - 3.5);
  score -= centerDist;

  return score;
}

function aiChooseMove(board: Board): Move | null {
  const moves = getAllMoves(board, 'light');
  if (moves.length === 0) return null;

  const hasCaptureMove = moves.some(m => m.captured.length > 0);

  if (hasCaptureMove) {
    // Among capture moves, pick the one with most captures
    const captureMoves = moves.filter(m => m.captured.length > 0);
    captureMoves.sort((a, b) => b.captured.length - a.captured.length);
    // If tied, pick randomly among top scorers
    const maxCaps = captureMoves[0]!.captured.length;
    const best = captureMoves.filter(m => m.captured.length === maxCaps);
    return best[Math.floor(Math.random() * best.length)] ?? null;
  }

  // Non-capture: score and add randomness
  const scored = moves.map(m => ({ move: m, score: scoreMove(m, board) + Math.random() * 5 }));
  scored.sort((a, b) => b.score - a.score);
  // Pick from top 3 randomly
  const topN = Math.min(3, scored.length);
  return scored[Math.floor(Math.random() * topN)]?.move ?? null;
}

// ─── Initial state ────────────────────────────────────────────────────────────

function loadWins(): number {
  if (typeof window === 'undefined') return 0;
  return Number(localStorage.getItem('inksuite-games-checkers-highscore') || '0');
}

function makeInitialState(): GameState {
  const board = createInitialBoard();
  const allMoves = getAllMoves(board, 'dark');
  return {
    board,
    turn: 'dark',
    status: 'playing',
    selectedPos: null,
    validMoves: allMoves,
    moveCount: 0,
    noCaptureMoves: 0,
    capturedDark: 0,
    capturedLight: 0,
    wins: loadWins(),
  };
}

// ─── SVG Helpers ──────────────────────────────────────────────────────────────

const CELL_SIZE = 56;
const BOARD_PX = BOARD_SIZE * CELL_SIZE;
const PIECE_R = CELL_SIZE * 0.38;
const KING_STAR_R = CELL_SIZE * 0.14;

function StarIcon({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) {
  // 5-pointed star path
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r * 0.4;
    points.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`);
  }
  return <polygon points={points.join(' ')} fill={fill} opacity={0.9} />;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Checkers() {
  const [state, setState] = useState<GameState>(makeInitialState);
  const [aiThinking, setAiThinking] = useState(false);

  // ── AI move effect ────────────────────────────────────────────────────────
  useEffect(() => {
    if (state.turn !== 'light' || state.status !== 'playing') return;

    setAiThinking(true);
    const timer = setTimeout(() => {
      setState(prev => {
        if (prev.turn !== 'light' || prev.status !== 'playing') return prev;

        const move = aiChooseMove(prev.board);
        if (!move) {
          return { ...prev, status: 'dark-wins' };
        }

        const newBoard = applyMove(prev.board, move);
        const capturedLight = prev.capturedLight + move.captured.length;
        const noCaptureMoves = move.captured.length > 0 ? 0 : prev.noCaptureMoves + 1;
        const moveCount = prev.moveCount + 1;

        // Check win / draw
        const darkMoves = getAllMoves(newBoard, 'dark');
        let status: GameStatus = 'playing';

        if (darkMoves.length === 0) {
          status = 'light-wins';
        } else if (noCaptureMoves >= DRAW_LIMIT) {
          status = 'draw';
        }

        const newAllMoves = status === 'playing' ? darkMoves : [];

        return {
          ...prev,
          board: newBoard,
          turn: 'dark',
          status,
          selectedPos: null,
          validMoves: newAllMoves,
          moveCount,
          noCaptureMoves,
          capturedLight,
        };
      });
      setAiThinking(false);
    }, 400 + Math.random() * 300);

    return () => clearTimeout(timer);
  }, [state.turn, state.status]);

  // ── Win tracking ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (state.status === 'dark-wins') {
      const wins = state.wins + 1;
      if (typeof window !== 'undefined') {
        localStorage.setItem('inksuite-games-checkers-highscore', String(wins));
      }
      setState(prev => ({ ...prev, wins }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCellClick = useCallback((row: number, col: number) => {
    if (state.turn !== 'dark' || state.status !== 'playing' || aiThinking) return;

    setState(prev => {
      const cell = prev.board[row]![col];
      const clickedPos = { row, col };

      // If a piece is selected, check if clicking a valid destination
      if (prev.selectedPos) {
        const movesForSelected = getMovesForPiece(prev.validMoves, prev.selectedPos);
        const targetMove = movesForSelected.find(m => m.to.row === row && m.to.col === col);

        if (targetMove) {
          // Execute move
          const newBoard = applyMove(prev.board, targetMove);
          const capturedDark = prev.capturedDark + targetMove.captured.length;
          const noCaptureMoves = targetMove.captured.length > 0 ? 0 : prev.noCaptureMoves + 1;
          const moveCount = prev.moveCount + 1;

          // Check win / draw
          const lightMoves = getAllMoves(newBoard, 'light');
          let status: GameStatus = 'playing';

          // Count pieces
          let darkCount = 0;
          let lightCount = 0;
          for (const r of newBoard) for (const c of r) {
            if (c?.player === 'dark') darkCount++;
            if (c?.player === 'light') lightCount++;
          }

          if (lightCount === 0 || lightMoves.length === 0) {
            status = 'dark-wins';
          } else if (noCaptureMoves >= DRAW_LIMIT) {
            status = 'draw';
          }

          const newAllMoves = status === 'playing' ? getAllMoves(newBoard, 'light') : [];

          return {
            ...prev,
            board: newBoard,
            turn: 'light',
            status,
            selectedPos: null,
            validMoves: newAllMoves,
            moveCount,
            noCaptureMoves,
            capturedDark,
          };
        }

        // Clicked own piece — re-select
        if (cell && cell.player === 'dark') {
          const movesForNew = getMovesForPiece(prev.validMoves, clickedPos);
          if (movesForNew.length > 0) {
            return { ...prev, selectedPos: clickedPos };
          }
        }

        // Deselect
        return { ...prev, selectedPos: null };
      }

      // Select a dark piece
      if (cell && cell.player === 'dark') {
        const movesForNew = getMovesForPiece(prev.validMoves, clickedPos);
        if (movesForNew.length > 0) {
          return { ...prev, selectedPos: clickedPos };
        }
      }

      return prev;
    });
  }, [state.turn, state.status, aiThinking]);

  const handleNewGame = useCallback(() => {
    setAiThinking(false);
    setState(prev => ({ ...makeInitialState(), wins: prev.wins }));
  }, []);

  // ── Derived display data ──────────────────────────────────────────────────
  const { board, selectedPos, validMoves, status, turn, moveCount, capturedDark, capturedLight, wins } = state;

  const movesForSelected = selectedPos ? getMovesForPiece(validMoves, selectedPos) : [];
  const validDestinations = new Set(movesForSelected.map(m => `${m.to.row},${m.to.col}`));
  const piecesWithMoves = new Set(validMoves.map(m => `${m.from.row},${m.from.col}`));

  const statusMessage = () => {
    if (status === 'dark-wins') return '🎉 You win!';
    if (status === 'light-wins') return 'AI wins. Better luck next time!';
    if (status === 'draw') return 'Draw — 50 moves without capture.';
    if (turn === 'light' || aiThinking) return 'AI thinking...';
    return 'Your turn';
  };

  const statusColor = () => {
    if (status === 'dark-wins') return 'text-emerald-400';
    if (status === 'light-wins') return 'text-red-400';
    if (status === 'draw') return 'text-amber-400';
    if (turn === 'light') return 'text-ink-500';
    return 'text-ink-900';
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-6 py-2 select-none">

      {/* Status bar */}
      <div className="flex w-full max-w-lg items-center justify-between rounded-xl bg-white px-5 py-3 ring-1 ring-inset ring-purple-200 shadow-sm">
        <div>
          <p className={`text-base font-semibold ${statusColor()}`}>{statusMessage()}</p>
          <p className="text-xs text-ink-500 mt-0.5">Move {moveCount}</p>
          {status === 'dark-wins' && (
            <MintScoreNFTButton gameId="checkers" gameTitle="Checkers" gameIcon="♟️" score={capturedDark * 10 + Math.max(0, 60 - moveCount)} />
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-ink-600">
          <span>You captured: <span className="font-mono font-bold text-ink-900">{capturedDark}</span></span>
          <span>AI captured: <span className="font-mono font-bold text-ink-900">{capturedLight}</span></span>
          <span className="text-ink-400">|</span>
          <span>Wins: <span className="font-mono font-bold text-emerald-400">{wins}</span></span>
        </div>
      </div>

      {/* Board */}
      <div className="rounded-xl ring-1 ring-purple-200 shadow-sm overflow-hidden">
        <svg
          width={BOARD_PX}
          height={BOARD_PX}
          viewBox={`0 0 ${BOARD_PX} ${BOARD_PX}`}
          style={{ display: 'block' }}
        >
          {/* Squares */}
          {Array.from({ length: BOARD_SIZE }, (_, r) =>
            Array.from({ length: BOARD_SIZE }, (_, c) => {
              const isDark = (r + c) % 2 === 1;
              const x = c * CELL_SIZE;
              const y = r * CELL_SIZE;
              const isValidDest = validDestinations.has(`${r},${c}`);
              const isSelected = selectedPos?.row === r && selectedPos?.col === c;

              return (
                <g key={`sq-${r}-${c}`} onClick={() => handleCellClick(r, c)} style={{ cursor: isDark ? 'pointer' : 'default' }}>
                  <rect
                    x={x} y={y}
                    width={CELL_SIZE} height={CELL_SIZE}
                    fill={isDark ? COLORS.darkSquareAlpha : COLORS.lightSquare}
                  />
                  {/* Valid destination dot */}
                  {isValidDest && isDark && !board[r]![c] && (
                    <circle
                      cx={x + CELL_SIZE / 2}
                      cy={y + CELL_SIZE / 2}
                      r={8}
                      fill={COLORS.validDot}
                      opacity={0.85}
                    />
                  )}
                  {/* Selection highlight */}
                  {isSelected && (
                    <rect
                      x={x + 2} y={y + 2}
                      width={CELL_SIZE - 4} height={CELL_SIZE - 4}
                      fill="none"
                      stroke={COLORS.selectedRing}
                      strokeWidth={3}
                      rx={4}
                    />
                  )}
                  {/* Highlight pieces that have valid moves (when it's player's turn, no selection) */}
                  {!selectedPos && turn === 'dark' && status === 'playing' && piecesWithMoves.has(`${r},${c}`) && board[r]![c]?.player === 'dark' && (
                    <rect
                      x={x + 2} y={y + 2}
                      width={CELL_SIZE - 4} height={CELL_SIZE - 4}
                      fill="none"
                      stroke={COLORS.selectedRing}
                      strokeWidth={1.5}
                      opacity={0.4}
                      rx={4}
                    />
                  )}
                </g>
              );
            })
          )}

          {/* Pieces */}
          {Array.from({ length: BOARD_SIZE }, (_, r) =>
            Array.from({ length: BOARD_SIZE }, (_, c) => {
              const piece = board[r]![c];
              if (!piece) return null;

              const cx = c * CELL_SIZE + CELL_SIZE / 2;
              const cy = r * CELL_SIZE + CELL_SIZE / 2;
              const isPlayerPiece = piece.player === 'dark';
              const fill = isPlayerPiece ? COLORS.playerPiece : COLORS.aiPiece;
              const border = isPlayerPiece ? COLORS.playerPieceBorder : COLORS.aiPieceBorder;
              const isSelected = selectedPos?.row === r && selectedPos?.col === c;
              const isValidDest = validDestinations.has(`${r},${c}`);

              return (
                <g key={`pc-${r}-${c}`} onClick={() => handleCellClick(r, c)} style={{ cursor: 'pointer' }}>
                  {/* Shadow */}
                  <circle cx={cx} cy={cy + 2} r={PIECE_R} fill="rgba(0,0,0,0.2)" />
                  {/* Piece body */}
                  <circle
                    cx={cx} cy={cy}
                    r={PIECE_R}
                    fill={fill}
                    stroke={isSelected ? COLORS.selectedRing : border}
                    strokeWidth={isSelected ? 3 : 1.5}
                  />
                  {/* Inner shine */}
                  <circle
                    cx={cx - PIECE_R * 0.25}
                    cy={cy - PIECE_R * 0.25}
                    r={PIECE_R * 0.3}
                    fill="white"
                    opacity={isPlayerPiece ? 0.08 : 0.35}
                  />
                  {/* King marker */}
                  {piece.type === 'king' && (
                    <StarIcon
                      cx={cx}
                      cy={cy}
                      r={KING_STAR_R}
                      fill={isPlayerPiece ? COLORS.kingMarker : COLORS.kingMarkerDark}
                    />
                  )}
                  {/* Valid capture indicator overlay */}
                  {isValidDest && (
                    <circle
                      cx={cx} cy={cy}
                      r={PIECE_R + 3}
                      fill="none"
                      stroke={COLORS.validDot}
                      strokeWidth={2}
                      opacity={0.8}
                    />
                  )}
                </g>
              );
            })
          )}
        </svg>
      </div>

      {/* Captured pieces visual */}
      <div className="flex w-full max-w-lg items-center justify-between rounded-xl bg-white px-5 py-3 ring-1 ring-inset ring-purple-200 shadow-sm">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-ink-500">Your pieces captured by AI</p>
          <div className="flex gap-1">
            {Array.from({ length: capturedLight }, (_, i) => (
              <div key={i} className="h-4 w-4 rounded-full" style={{ background: COLORS.playerPiece, border: `1.5px solid ${COLORS.playerPieceBorder}` }} />
            ))}
            {capturedLight === 0 && <span className="text-xs text-ink-400 italic">none yet</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <p className="text-xs font-medium text-ink-500">AI pieces captured by you</p>
          <div className="flex gap-1 flex-wrap justify-end">
            {Array.from({ length: capturedDark }, (_, i) => (
              <div key={i} className="h-4 w-4 rounded-full" style={{ background: COLORS.aiPiece, border: `1.5px solid ${COLORS.aiPieceBorder}` }} />
            ))}
            {capturedDark === 0 && <span className="text-xs text-ink-400 italic">none yet</span>}
          </div>
        </div>
      </div>

      {/* New Game button */}
      <button
        onClick={handleNewGame}
        className="rounded-lg bg-purple-100 px-5 py-2 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-purple-200 shadow-sm transition hover:bg-purple-200 hover:text-ink-900"
      >
        New Game
      </button>

      {/* Legend */}
      <div className="flex gap-6 text-xs text-ink-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: COLORS.playerPiece }} />
          You (dark, moves up)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: COLORS.aiPiece, border: `1px solid ${COLORS.aiPieceBorder}` }} />
          AI (light, moves down)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: COLORS.validDot }} />
          Valid move
        </span>
      </div>
    </div>
  );
}
