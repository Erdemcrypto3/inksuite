'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MintScoreNFTButton } from './mint-score-nft';

// ─── Constants ────────────────────────────────────────────────────────────────
const COLS = 10;
const ROWS = 20;
const CELL = 30; // px per cell
const CANVAS_W = COLS * CELL;
const CANVAS_H = ROWS * CELL;
const PREVIEW_CELL = 24;
const PREVIEW_SIZE = 4 * PREVIEW_CELL;
const HIGH_SCORE_KEY = 'inksuite-games-tetris-highscore';

const COLORS: Record<string, string> = {
  I: '#00d4ff',
  O: '#ffd600',
  T: '#c84bff',
  S: '#00e676',
  Z: '#ff3d57',
  J: '#2979ff',
  L: '#ff9100',
  ghost: 'rgba(255,255,255,0.12)',
  bg: '#1e1b2e',
  grid: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.1)',
};

// ─── Tetromino Shapes ─────────────────────────────────────────────────────────
type TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

const SHAPES: Record<TetrominoType, number[][][]> = {
  I: [
    [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    [[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],
    [[0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]],
    [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]],
  ],
  O: [
    [[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],
    [[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],
    [[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],
    [[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],
  ],
  T: [
    [[0,1,0,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]],
    [[0,1,0,0],[0,1,1,0],[0,1,0,0],[0,0,0,0]],
    [[0,0,0,0],[1,1,1,0],[0,1,0,0],[0,0,0,0]],
    [[0,1,0,0],[1,1,0,0],[0,1,0,0],[0,0,0,0]],
  ],
  S: [
    [[0,1,1,0],[1,1,0,0],[0,0,0,0],[0,0,0,0]],
    [[0,1,0,0],[0,1,1,0],[0,0,1,0],[0,0,0,0]],
    [[0,0,0,0],[0,1,1,0],[1,1,0,0],[0,0,0,0]],
    [[1,0,0,0],[1,1,0,0],[0,1,0,0],[0,0,0,0]],
  ],
  Z: [
    [[1,1,0,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],
    [[0,0,1,0],[0,1,1,0],[0,1,0,0],[0,0,0,0]],
    [[0,0,0,0],[1,1,0,0],[0,1,1,0],[0,0,0,0]],
    [[0,1,0,0],[1,1,0,0],[1,0,0,0],[0,0,0,0]],
  ],
  J: [
    [[1,0,0,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]],
    [[0,1,1,0],[0,1,0,0],[0,1,0,0],[0,0,0,0]],
    [[0,0,0,0],[1,1,1,0],[0,0,1,0],[0,0,0,0]],
    [[0,1,0,0],[0,1,0,0],[1,1,0,0],[0,0,0,0]],
  ],
  L: [
    [[0,0,1,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]],
    [[0,1,0,0],[0,1,0,0],[0,1,1,0],[0,0,0,0]],
    [[0,0,0,0],[1,1,1,0],[1,0,0,0],[0,0,0,0]],
    [[1,1,0,0],[0,1,0,0],[0,1,0,0],[0,0,0,0]],
  ],
};

// Wall-kick offsets (SRS) for non-I pieces: [fromRotation][attempt] = [dx, dy]
type Kick = [number, number];
const WALL_KICKS: Record<string, Kick[]> = {
  '0>1': [[0,0] as Kick,[-1,0] as Kick,[-1,1] as Kick,[0,-2] as Kick,[-1,-2] as Kick],
  '1>2': [[0,0] as Kick,[1,0] as Kick,[1,-1] as Kick,[0,2] as Kick,[1,2] as Kick],
  '2>3': [[0,0] as Kick,[1,0] as Kick,[1,1] as Kick,[0,-2] as Kick,[1,-2] as Kick],
  '3>0': [[0,0] as Kick,[-1,0] as Kick,[-1,-1] as Kick,[0,2] as Kick,[-1,2] as Kick],
  '1>0': [[0,0] as Kick,[1,0] as Kick,[1,-1] as Kick,[0,2] as Kick,[1,2] as Kick],
  '2>1': [[0,0] as Kick,[-1,0] as Kick,[-1,1] as Kick,[0,-2] as Kick,[-1,-2] as Kick],
  '3>2': [[0,0] as Kick,[-1,0] as Kick,[-1,-1] as Kick,[0,2] as Kick,[-1,2] as Kick],
  '0>3': [[0,0] as Kick,[1,0] as Kick,[1,1] as Kick,[0,-2] as Kick,[1,-2] as Kick],
};

const WALL_KICKS_I: Record<string, Kick[]> = {
  '0>1': [[0,0] as Kick,[-2,0] as Kick,[1,0] as Kick,[-2,-1] as Kick,[1,2] as Kick],
  '1>2': [[0,0] as Kick,[-1,0] as Kick,[2,0] as Kick,[-1,2] as Kick,[2,-1] as Kick],
  '2>3': [[0,0] as Kick,[2,0] as Kick,[-1,0] as Kick,[2,1] as Kick,[-1,-2] as Kick],
  '3>0': [[0,0] as Kick,[1,0] as Kick,[-2,0] as Kick,[1,-2] as Kick,[-2,1] as Kick],
  '1>0': [[0,0] as Kick,[2,0] as Kick,[-1,0] as Kick,[2,1] as Kick,[-1,-2] as Kick],
  '2>1': [[0,0] as Kick,[1,0] as Kick,[-2,0] as Kick,[1,-2] as Kick,[-2,1] as Kick],
  '3>2': [[0,0] as Kick,[-2,0] as Kick,[1,0] as Kick,[-2,-1] as Kick,[1,2] as Kick],
  '0>3': [[0,0] as Kick,[-1,0] as Kick,[2,0] as Kick,[-1,2] as Kick,[2,-1] as Kick],
};

// ─── Types ────────────────────────────────────────────────────────────────────
type Cell = TetrominoType | null;
type Board = Cell[][];

interface Piece {
  type: TetrominoType;
  x: number;
  y: number;
  rotation: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PIECE_TYPES: TetrominoType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

function randomPiece(): Piece {
  const type = PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)]!;
  return { type, x: type === 'I' ? 3 : 3, y: 0, rotation: 0 };
}

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function getShape(piece: Piece): number[][] {
  return SHAPES[piece.type][piece.rotation]!;
}

function isValidPosition(board: Board, piece: Piece, dx = 0, dy = 0, rot?: number): boolean {
  const rotation = rot ?? piece.rotation;
  const shape = SHAPES[piece.type][rotation]!;
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r]!.length; c++) {
      if (!shape[r]![c]) continue;
      const nx = piece.x + c + dx;
      const ny = piece.y + r + dy;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
      if (ny < 0) continue; // above board is allowed during spawn
      if (board[ny]![nx]) return false;
    }
  }
  return true;
}

function lockPiece(board: Board, piece: Piece): Board {
  const newBoard = board.map((row) => [...row]);
  const shape = getShape(piece);
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r]!.length; c++) {
      if (!shape[r]![c]) continue;
      const nx = piece.x + c;
      const ny = piece.y + r;
      if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) {
        newBoard[ny]![nx] = piece.type;
      }
    }
  }
  return newBoard;
}

function clearLines(board: Board): { board: Board; linesCleared: number } {
  const remaining = board.filter((row) => row.some((cell) => !cell));
  const linesCleared = ROWS - remaining.length;
  const newRows: Cell[][] = Array.from({ length: linesCleared }, () => Array(COLS).fill(null));
  return { board: [...newRows, ...remaining], linesCleared };
}

function getGhostY(board: Board, piece: Piece): number {
  let dy = 0;
  while (isValidPosition(board, piece, 0, dy + 1)) dy++;
  return piece.y + dy;
}

function tryRotate(board: Board, piece: Piece, dir: 1 | -1): Piece | null {
  const fromRot = piece.rotation;
  const toRot = (fromRot + dir + 4) % 4;
  const key = `${fromRot}>${toRot}`;
  const kicks = piece.type === 'I' ? WALL_KICKS_I[key] : WALL_KICKS[key];
  if (!kicks) return null;
  for (const [dx, dy] of kicks) {
    if (isValidPosition(board, piece, dx, dy, toRot)) {
      return { ...piece, rotation: toRot, x: piece.x + dx, y: piece.y + dy };
    }
  }
  return null;
}

function scoreForLines(lines: number): number {
  return [0, 100, 300, 500, 800][lines] ?? 0;
}

function dropInterval(level: number): number {
  // Level 1 = 800ms, decreases ~75ms per level, floors at 100ms
  return Math.max(100, 800 - (level - 1) * 75);
}

// ─── Drawing ──────────────────────────────────────────────────────────────────
function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  cellSize: number,
  isGhost = false,
) {
  const px = x * cellSize;
  const py = y * cellSize;
  const s = cellSize;

  if (isGhost) {
    ctx.fillStyle = color;
    ctx.fillRect(px + 1, py + 1, s - 2, s - 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 1.5, py + 1.5, s - 3, s - 3);
    return;
  }

  // Main fill
  ctx.fillStyle = color;
  ctx.fillRect(px + 1, py + 1, s - 2, s - 2);

  // Highlight (top-left bevel)
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(px + 1, py + 1, s - 2, 3);
  ctx.fillRect(px + 1, py + 1, 3, s - 2);

  // Shadow (bottom-right bevel)
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(px + 1, py + s - 4, s - 2, 3);
  ctx.fillRect(px + s - 4, py + 1, 3, s - 2);
}

function drawBoard(ctx: CanvasRenderingContext2D, board: Board) {
  // Background
  ctx.fillStyle = COLORS.bg!;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Grid lines
  ctx.strokeStyle = COLORS.grid!;
  ctx.lineWidth = 1;
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL);
    ctx.lineTo(CANVAS_W, r * CELL);
    ctx.stroke();
  }
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * CELL, 0);
    ctx.lineTo(c * CELL, CANVAS_H);
    ctx.stroke();
  }

  // Locked cells
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = board[r]![c];
      if (cell) drawCell(ctx, c, r, COLORS[cell]!, CELL);
    }
  }
}

function drawPiece(ctx: CanvasRenderingContext2D, piece: Piece, ghostY?: number) {
  const shape = getShape(piece);

  // Ghost
  if (ghostY !== undefined && ghostY !== piece.y) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r]!.length; c++) {
        if (shape[r]![c]) {
          drawCell(ctx, piece.x + c, ghostY + r, COLORS.ghost!, CELL, true);
        }
      }
    }
  }

  // Active piece
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r]!.length; c++) {
      if (shape[r]![c]) {
        drawCell(ctx, piece.x + c, piece.y + r, COLORS[piece.type]!, CELL);
      }
    }
  }
}

function drawPreview(ctx: CanvasRenderingContext2D, type: TetrominoType) {
  ctx.fillStyle = COLORS.bg!;
  ctx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);

  const shape = SHAPES[type][0]!;
  // Find bounding box
  let minR = 4, maxR = -1, minC = 4, maxC = -1;
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r]!.length; c++) {
      if (shape[r]![c]) {
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
      }
    }
  }
  const blockW = (maxC - minC + 1) * PREVIEW_CELL;
  const blockH = (maxR - minR + 1) * PREVIEW_CELL;
  const offsetX = Math.floor((PREVIEW_SIZE - blockW) / 2);
  const offsetY = Math.floor((PREVIEW_SIZE - blockH) / 2);

  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r]!.length; c++) {
      if (shape[r]![c]) {
        const px = offsetX + (c - minC) * PREVIEW_CELL;
        const py = offsetY + (r - minR) * PREVIEW_CELL;
        const s = PREVIEW_CELL;
        ctx.fillStyle = COLORS[type]!;
        ctx.fillRect(px + 1, py + 1, s - 2, s - 2);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(px + 1, py + 1, s - 2, 3);
        ctx.fillRect(px + 1, py + 1, 3, s - 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(px + 1, py + s - 4, s - 2, 3);
        ctx.fillRect(px + s - 4, py + 1, 3, s - 2);
      }
    }
  }
}

function drawOverlay(ctx: CanvasRenderingContext2D, text: string, subtext?: string) {
  ctx.fillStyle = 'rgba(30,27,46,0.85)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px "Inter", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, CANVAS_W / 2, CANVAS_H / 2 - 10);

  if (subtext) {
    ctx.font = '16px "Inter", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(subtext, CANVAS_W / 2, CANVAS_H / 2 + 20);
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export function Tetris() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  // Mutable game state (refs to avoid stale closures in the game loop)
  const boardRef = useRef<Board>(emptyBoard());
  const pieceRef = useRef<Piece>(randomPiece());
  const nextPieceRef = useRef<Piece>(randomPiece());
  const scoreRef = useRef(0);
  const linesRef = useRef(0);
  const levelRef = useRef(1);
  const dropTimerRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const gameStateRef = useRef<'idle' | 'playing' | 'paused' | 'gameover'>('idle');

  // React state for UI re-renders
  const [uiScore, setUiScore] = useState(0);
  const [uiLines, setUiLines] = useState(0);
  const [uiLevel, setUiLevel] = useState(1);
  const [uiHighScore, setUiHighScore] = useState(0);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'paused' | 'gameover'>('idle');

  // ── Load high score ──────────────────────────────────────────────────────
  useEffect(() => {
    const hs = Number(localStorage.getItem(HIGH_SCORE_KEY) || '0');
    setUiHighScore(hs);
  }, []);

  // ── Sync UI from refs ────────────────────────────────────────────────────
  const syncUi = useCallback(() => {
    setUiScore(scoreRef.current);
    setUiLines(linesRef.current);
    setUiLevel(levelRef.current);
  }, []);

  // ── Render frame ─────────────────────────────────────────────────────────
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    drawBoard(ctx, boardRef.current);

    if (gameStateRef.current === 'playing' || gameStateRef.current === 'paused') {
      const ghostY = getGhostY(boardRef.current, pieceRef.current);
      drawPiece(ctx, pieceRef.current, ghostY);
    }

    if (gameStateRef.current === 'idle') {
      drawOverlay(ctx, 'TETRIS', 'Press Start');
    } else if (gameStateRef.current === 'paused') {
      drawOverlay(ctx, 'PAUSED', 'Press P to resume');
    } else if (gameStateRef.current === 'gameover') {
      drawOverlay(ctx, 'GAME OVER', `Score: ${scoreRef.current}`);
    }

    // Preview
    const previewCanvas = previewRef.current;
    const pCtx = previewCanvas?.getContext('2d');
    if (pCtx && gameStateRef.current !== 'idle') {
      drawPreview(pCtx, nextPieceRef.current.type);
    } else if (pCtx) {
      pCtx.fillStyle = COLORS.bg!;
      pCtx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
    }
  }, []);

  // ── Lock piece & spawn next ───────────────────────────────────────────────
  const lockAndSpawn = useCallback(() => {
    const newBoard = lockPiece(boardRef.current, pieceRef.current);
    const { board: clearedBoard, linesCleared } = clearLines(newBoard);
    boardRef.current = clearedBoard;

    // Score
    const lineScore = scoreForLines(linesCleared);
    const levelBonus = levelRef.current;
    scoreRef.current += lineScore * levelBonus;
    linesRef.current += linesCleared;

    // Level up every 10 lines
    levelRef.current = Math.floor(linesRef.current / 10) + 1;

    // Spawn next piece
    pieceRef.current = nextPieceRef.current;
    nextPieceRef.current = randomPiece();

    // Check game over
    if (!isValidPosition(boardRef.current, pieceRef.current)) {
      gameStateRef.current = 'gameover';
      setGameState('gameover');
      // Save high score
      const hs = Number(localStorage.getItem(HIGH_SCORE_KEY) || '0');
      if (scoreRef.current > hs) {
        localStorage.setItem(HIGH_SCORE_KEY, String(scoreRef.current));
        setUiHighScore(scoreRef.current);
      }
    }

    syncUi();
  }, [syncUi]);

  // ── Game loop ────────────────────────────────────────────────────────────
  const gameLoop = useCallback(
    (timestamp: number) => {
      if (gameStateRef.current !== 'playing') {
        render();
        return;
      }

      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;
      dropTimerRef.current += delta;

      const interval = dropInterval(levelRef.current);
      if (dropTimerRef.current >= interval) {
        dropTimerRef.current = 0;
        if (isValidPosition(boardRef.current, pieceRef.current, 0, 1)) {
          pieceRef.current = { ...pieceRef.current, y: pieceRef.current.y + 1 };
        } else {
          lockAndSpawn();
        }
      }

      render();

      if (gameStateRef.current === 'playing') {
        rafRef.current = requestAnimationFrame(gameLoop);
      } else {
        render(); // Final render for game over / pause
      }
    },
    [lockAndSpawn, render],
  );

  // ── Start game ───────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    boardRef.current = emptyBoard();
    pieceRef.current = randomPiece();
    nextPieceRef.current = randomPiece();
    scoreRef.current = 0;
    linesRef.current = 0;
    levelRef.current = 1;
    dropTimerRef.current = 0;
    gameStateRef.current = 'playing';
    setGameState('playing');
    syncUi();

    cancelAnimationFrame(rafRef.current);
    lastTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [gameLoop, syncUi]);

  // ── Keyboard controls ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const state = gameStateRef.current;

      if (e.code === 'KeyP') {
        if (state === 'playing') {
          gameStateRef.current = 'paused';
          setGameState('paused');
          cancelAnimationFrame(rafRef.current);
          render();
        } else if (state === 'paused') {
          gameStateRef.current = 'playing';
          setGameState('playing');
          lastTimeRef.current = performance.now();
          rafRef.current = requestAnimationFrame(gameLoop);
        }
        e.preventDefault();
        return;
      }

      if (state !== 'playing') return;

      switch (e.code) {
        case 'ArrowLeft':
          if (isValidPosition(boardRef.current, pieceRef.current, -1, 0)) {
            pieceRef.current = { ...pieceRef.current, x: pieceRef.current.x - 1 };
          }
          e.preventDefault();
          break;
        case 'ArrowRight':
          if (isValidPosition(boardRef.current, pieceRef.current, 1, 0)) {
            pieceRef.current = { ...pieceRef.current, x: pieceRef.current.x + 1 };
          }
          e.preventDefault();
          break;
        case 'ArrowDown':
          if (isValidPosition(boardRef.current, pieceRef.current, 0, 1)) {
            pieceRef.current = { ...pieceRef.current, y: pieceRef.current.y + 1 };
            scoreRef.current += 1;
            dropTimerRef.current = 0;
            syncUi();
          } else {
            lockAndSpawn();
          }
          e.preventDefault();
          break;
        case 'ArrowUp': {
          const rotated = tryRotate(boardRef.current, pieceRef.current, 1);
          if (rotated) pieceRef.current = rotated;
          e.preventDefault();
          break;
        }
        case 'KeyZ': {
          const rotated = tryRotate(boardRef.current, pieceRef.current, -1);
          if (rotated) pieceRef.current = rotated;
          e.preventDefault();
          break;
        }
        case 'Space': {
          // Hard drop
          let dy = 0;
          while (isValidPosition(boardRef.current, pieceRef.current, 0, dy + 1)) dy++;
          scoreRef.current += dy * 2;
          pieceRef.current = { ...pieceRef.current, y: pieceRef.current.y + dy };
          syncUi();
          lockAndSpawn();
          dropTimerRef.current = 0;
          e.preventDefault();
          break;
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameLoop, lockAndSpawn, render, syncUi]);

  // ── Initial render ───────────────────────────────────────────────────────
  useEffect(() => {
    render();
  }, [render]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Resume RAF when playing state is set ──────────────────────────────────
  // (handled inline in toggle logic above)

  return (
    <div className="flex flex-col items-center gap-6 select-none">
      {/* Title */}
      <h1 className="text-2xl font-bold text-ink-900 tracking-wide">Tetris</h1>

      <div className="flex gap-4 items-start">
        {/* Game Canvas */}
        <div className="rounded-xl overflow-hidden ring-1 ring-purple-100 shadow-lg">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="block"
            style={{ background: COLORS.bg }}
          />
        </div>

        {/* Side Panel */}
        <div className="flex flex-col gap-4 min-w-[120px]">
          {/* Score */}
          <div className="bg-white rounded-xl ring-1 ring-purple-100 p-4 shadow-sm">
            <div className="text-xs font-semibold text-ink-500 uppercase tracking-widest mb-1">Score</div>
            <div className="text-xl font-bold text-ink-900 tabular-nums">{uiScore.toLocaleString()}</div>
          </div>

          {/* High Score */}
          <div className="bg-white rounded-xl ring-1 ring-purple-100 p-4 shadow-sm">
            <div className="text-xs font-semibold text-ink-500 uppercase tracking-widest mb-1">Best</div>
            <div className="text-xl font-bold text-ink-700 tabular-nums">{uiHighScore.toLocaleString()}</div>
          </div>

          {/* Level & Lines */}
          <div className="bg-white rounded-xl ring-1 ring-purple-100 p-4 shadow-sm">
            <div className="flex flex-col gap-2">
              <div>
                <div className="text-xs font-semibold text-ink-500 uppercase tracking-widest mb-0.5">Level</div>
                <div className="text-lg font-bold text-ink-900 tabular-nums">{uiLevel}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-ink-500 uppercase tracking-widest mb-0.5">Lines</div>
                <div className="text-lg font-bold text-ink-900 tabular-nums">{uiLines}</div>
              </div>
            </div>
          </div>

          {/* Next Piece */}
          <div className="bg-white rounded-xl ring-1 ring-purple-100 p-4 shadow-sm">
            <div className="text-xs font-semibold text-ink-500 uppercase tracking-widest mb-2">Next</div>
            <div className="rounded-lg overflow-hidden">
              <canvas
                ref={previewRef}
                width={PREVIEW_SIZE}
                height={PREVIEW_SIZE}
                className="block"
                style={{ background: COLORS.bg }}
              />
            </div>
          </div>

          {/* Controls */}
          {gameState === 'idle' && (
            <button
              onClick={startGame}
              className="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-semibold rounded-xl px-4 py-3 text-sm shadow-sm transition-colors"
            >
              Start
            </button>
          )}
          {gameState === 'gameover' && (
            <>
              <MintScoreNFTButton gameId="tetris" gameTitle="Tetris" gameIcon="🧱" score={uiScore} />
              <button
                onClick={startGame}
                className="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-semibold rounded-xl px-4 py-3 text-sm shadow-sm transition-colors"
              >
                Restart
              </button>
            </>
          )}
          {(gameState === 'playing' || gameState === 'paused') && (
            <button
              onClick={() => {
                if (gameStateRef.current === 'playing') {
                  gameStateRef.current = 'paused';
                  setGameState('paused');
                  cancelAnimationFrame(rafRef.current);
                  render();
                } else {
                  gameStateRef.current = 'playing';
                  setGameState('playing');
                  lastTimeRef.current = performance.now();
                  rafRef.current = requestAnimationFrame(gameLoop);
                }
              }}
              className="bg-slate-100 hover:bg-slate-200 text-ink-700 font-semibold rounded-xl px-4 py-3 text-sm shadow-sm transition-colors ring-1 ring-slate-200"
            >
              {gameState === 'paused' ? 'Resume' : 'Pause'}
            </button>
          )}
        </div>
      </div>

      {/* Controls legend */}
      <div className="text-xs text-ink-500 flex gap-4 flex-wrap justify-center">
        <span>← → Move</span>
        <span>↑ Rotate</span>
        <span>↓ Soft drop</span>
        <span>Space Hard drop</span>
        <span>P Pause</span>
        <span>Z Rotate CCW</span>
      </div>
    </div>
  );
}
