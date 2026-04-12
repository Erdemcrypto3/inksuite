'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const GRID = 20;
const CELL = 20;
const INITIAL_SPEED = 150;
const SPEED_INCREASE = 2;

type Pos = { x: number; y: number };
type Dir = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

function randomFood(snake: Pos[]): Pos {
  let pos: Pos;
  do {
    pos = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
  } while (snake.some((s) => s.x === pos.x && s.y === pos.y));
  return pos;
}

function saveHighScore(score: number) {
  const key = 'inksuite-games-snake-highscore';
  const prev = Number(localStorage.getItem(key) || '0');
  if (score > prev) localStorage.setItem(key, String(score));
}

export function Snake() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'over'>('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  const snakeRef = useRef<Pos[]>([{ x: 10, y: 10 }]);
  const dirRef = useRef<Dir>('RIGHT');
  const nextDirRef = useRef<Dir>('RIGHT');
  const foodRef = useRef<Pos>(randomFood(snakeRef.current));
  const scoreRef = useRef(0);
  const speedRef = useRef(INITIAL_SPEED);
  const loopRef = useRef<number>(0);

  useEffect(() => {
    const prev = Number(localStorage.getItem('inksuite-games-snake-highscore') || '0');
    setHighScore(prev);
  }, []);

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const size = GRID * CELL;
    ctx.fillStyle = '#e8e0ff';
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(100,50,150,0.1)';
    for (let i = 0; i <= GRID; i++) {
      ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(size, i * CELL); ctx.stroke();
    }

    const snake = snakeRef.current;
    snake.forEach((s, i) => {
      ctx.fillStyle = i === 0 ? '#22c55e' : '#16a34a';
      ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
    });

    const food = foodRef.current;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  const tick = useCallback(() => {
    dirRef.current = nextDirRef.current;
    const snake = [...snakeRef.current];
    const head = { ...snake[0] };

    if (dirRef.current === 'UP') head.y--;
    if (dirRef.current === 'DOWN') head.y++;
    if (dirRef.current === 'LEFT') head.x--;
    if (dirRef.current === 'RIGHT') head.x++;

    if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID || snake.some((s) => s.x === head.x && s.y === head.y)) {
      saveHighScore(scoreRef.current);
      setHighScore(Math.max(scoreRef.current, Number(localStorage.getItem('inksuite-games-snake-highscore') || '0')));
      setGameState('over');
      return;
    }

    snake.unshift(head);

    if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
      scoreRef.current += 10;
      setScore(scoreRef.current);
      foodRef.current = randomFood(snake);
      speedRef.current = Math.max(50, speedRef.current - SPEED_INCREASE);
    } else {
      snake.pop();
    }

    snakeRef.current = snake;
    draw();
    loopRef.current = window.setTimeout(tick, speedRef.current);
  }, [draw]);

  const startGame = useCallback(() => {
    snakeRef.current = [{ x: 10, y: 10 }];
    dirRef.current = 'RIGHT';
    nextDirRef.current = 'RIGHT';
    foodRef.current = randomFood(snakeRef.current);
    scoreRef.current = 0;
    speedRef.current = INITIAL_SPEED;
    setScore(0);
    setGameState('playing');
    window.clearTimeout(loopRef.current);
    draw();
    loopRef.current = window.setTimeout(tick, speedRef.current);
  }, [draw, tick]);

  useEffect(() => {
    return () => window.clearTimeout(loopRef.current);
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (gameState !== 'playing') return;
      const d = dirRef.current;
      if ((e.key === 'ArrowUp' || e.key === 'w') && d !== 'DOWN') nextDirRef.current = 'UP';
      if ((e.key === 'ArrowDown' || e.key === 's') && d !== 'UP') nextDirRef.current = 'DOWN';
      if ((e.key === 'ArrowLeft' || e.key === 'a') && d !== 'RIGHT') nextDirRef.current = 'LEFT';
      if ((e.key === 'ArrowRight' || e.key === 'd') && d !== 'LEFT') nextDirRef.current = 'RIGHT';
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameState]);

  useEffect(() => { draw(); }, [draw]);

  const size = GRID * CELL;

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex items-center gap-6 text-sm">
        <span className="text-ink-700">Score: <span className="font-mono text-ink-900">{score}</span></span>
        <span className="text-ink-700">Best: <span className="font-mono text-ink-500">{highScore}</span></span>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={size}
          height={size}
          className="rounded-lg ring-1 ring-inset ring-purple-200"
        />
        {gameState === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/90">
            <button onClick={startGame} className="rounded-lg bg-ink-500 px-8 py-3 text-sm font-semibold text-white hover:bg-ink-700">
              Start Game
            </button>
          </div>
        )}
        {gameState === 'over' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-lg bg-white/90">
            <div className="text-lg font-semibold text-red-500">Game Over</div>
            <div className="font-mono text-2xl text-ink-900">{score} pts</div>
            <button onClick={startGame} className="rounded-lg bg-ink-500 px-8 py-3 text-sm font-semibold text-white hover:bg-ink-700">
              Play Again
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-ink-500">Arrow keys or WASD to move.</p>
    </div>
  );
}
