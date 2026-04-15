'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MintScoreNFTButton } from './mint-score-nft';

// ── Constants ──
const COLS = 20;
const ROWS = 12;
const CELL = 40;
const W = COLS * CELL;
const H = ROWS * CELL;
const FPS = 30;
const PREP_TIME = 5; // seconds between waves

// Path: enemies follow this route (row 6, left to right with some bends)
const PATH: [number, number][] = [
  [0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [4, 3], [4, 2], [5, 2], [6, 2], [7, 2],
  [7, 3], [7, 4], [7, 5], [7, 6], [7, 7], [8, 7], [9, 7], [10, 7], [10, 6], [10, 5],
  [10, 4], [10, 3], [11, 3], [12, 3], [13, 3], [13, 4], [13, 5], [13, 6], [13, 7], [13, 8],
  [14, 8], [15, 8], [16, 8], [16, 7], [16, 6], [16, 5], [17, 5], [18, 5], [19, 5],
];

const PATH_SET = new Set(PATH.map(([c, r]) => `${c},${r}`));

type TowerType = 'firewall' | 'validator' | 'auditor' | 'burner';
type EnemyType = 'spam' | 'bot' | 'mev' | 'whale';

const TOWER_DEFS: Record<TowerType, { name: string; cost: number; damage: number; range: number; rate: number; color: string; aoe: boolean }> = {
  firewall:  { name: 'Firewall',   cost: 50,  damage: 10, range: 2.5, rate: 1.0, color: '#7538F5', aoe: false },
  validator: { name: 'Validator',   cost: 100, damage: 25, range: 3.0, rate: 0.7, color: '#3b82f6', aoe: false },
  auditor:   { name: 'Auditor',     cost: 200, damage: 80, range: 3.5, rate: 0.3, color: '#f59e0b', aoe: false },
  burner:    { name: 'Gas Burner',  cost: 300, damage: 15, range: 2.0, rate: 0.5, color: '#ef4444', aoe: true },
};

const ENEMY_DEFS: Record<EnemyType, { name: string; hp: number; speed: number; reward: number; color: string }> = {
  spam:  { name: 'Spam Tx',      hp: 40,   speed: 1.5, reward: 10, color: '#a3e635' },
  bot:   { name: 'Bot',          hp: 80,   speed: 1.2, reward: 20, color: '#facc15' },
  mev:   { name: 'MEV Attacker', hp: 50,   speed: 2.5, reward: 25, color: '#f97316' },
  whale: { name: 'Whale Exploit',hp: 400,  speed: 0.6, reward: 100,color: '#dc2626' },
};

type Tower = { col: number; row: number; type: TowerType; lastShot: number };
type Enemy = { id: number; type: EnemyType; hp: number; maxHp: number; pathIdx: number; progress: number; speed: number; reward: number; dead: boolean };
type Bullet = { x: number; y: number; tx: number; ty: number; damage: number; aoe: boolean; speed: number };

function generateWave(waveNum: number): EnemyType[] {
  const enemies: EnemyType[] = [];
  const count = 5 + waveNum * 2;
  for (let i = 0; i < count; i++) {
    if (waveNum >= 10 && i === count - 1) enemies.push('whale');
    else if (waveNum >= 5 && Math.random() < 0.3) enemies.push('mev');
    else if (waveNum >= 3 && Math.random() < 0.4) enemies.push('bot');
    else enemies.push('spam');
  }
  // Boss waves
  if (waveNum === 8 || waveNum === 12 || waveNum === 15) {
    enemies.push('whale');
    enemies.push('whale');
  }
  return enemies;
}

export function TowerDefense() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    towers: [] as Tower[],
    enemies: [] as Enemy[],
    bullets: [] as Bullet[],
    gold: 200,
    lives: 20,
    wave: 0,
    phase: 'prep' as 'prep' | 'wave' | 'gameover' | 'win',
    prepTimer: PREP_TIME,
    spawnQueue: [] as EnemyType[],
    spawnTimer: 0,
    nextEnemyId: 0,
    score: 0,
    selectedTower: 'firewall' as TowerType,
    lastTime: 0,
  });

  const [gold, setGold] = useState(200);
  const [lives, setLives] = useState(20);
  const [wave, setWave] = useState(0);
  const [phase, setPhase] = useState<'prep' | 'wave' | 'gameover' | 'win'>('prep');
  const [selectedTower, setSelectedTower] = useState<TowerType>('firewall');
  const [score, setScore] = useState(0);

  // Sync selected tower to ref
  useEffect(() => { stateRef.current.selectedTower = selectedTower; }, [selectedTower]);

  const startWave = useCallback(() => {
    const s = stateRef.current;
    s.wave++;
    if (s.wave > 15) {
      s.phase = 'win';
      setPhase('win');
      return;
    }
    s.phase = 'wave';
    s.spawnQueue = generateWave(s.wave);
    s.spawnTimer = 0;
    setWave(s.wave);
    setPhase('wave');
  }, []);

  // Canvas click — place tower
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const col = Math.floor(x / CELL);
    const row = Math.floor(y / CELL);
    const s = stateRef.current;

    if (s.phase === 'gameover' || s.phase === 'win') return;
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
    if (PATH_SET.has(`${col},${row}`)) return; // Can't place on path
    if (s.towers.some((t) => t.col === col && t.row === row)) return; // Occupied

    const def = TOWER_DEFS[s.selectedTower];
    if (s.gold < def.cost) return;

    s.gold -= def.cost;
    s.towers.push({ col, row, type: s.selectedTower, lastShot: 0 });
    setGold(s.gold);
  }, []);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const loop = (time: number) => {
      const s = stateRef.current;
      const dt = s.lastTime ? (time - s.lastTime) / 1000 : 1 / FPS;
      s.lastTime = time;
      const clampedDt = Math.min(dt, 0.1);

      // ── Update ──
      if (s.phase === 'prep') {
        s.prepTimer -= clampedDt;
        if (s.prepTimer <= 0) {
          startWave();
        }
      }

      if (s.phase === 'wave') {
        // Spawn enemies
        if (s.spawnQueue.length > 0) {
          s.spawnTimer -= clampedDt;
          if (s.spawnTimer <= 0) {
            const type = s.spawnQueue.shift()!;
            const def = ENEMY_DEFS[type];
            s.enemies.push({
              id: s.nextEnemyId++,
              type, hp: def.hp, maxHp: def.hp,
              pathIdx: 0, progress: 0, speed: def.speed, reward: def.reward, dead: false,
            });
            s.spawnTimer = 0.6;
          }
        }

        // Move enemies
        for (const enemy of s.enemies) {
          if (enemy.dead) continue;
          enemy.progress += enemy.speed * clampedDt;
          while (enemy.progress >= 1 && enemy.pathIdx < PATH.length - 1) {
            enemy.progress -= 1;
            enemy.pathIdx++;
          }
          if (enemy.pathIdx >= PATH.length - 1 && enemy.progress >= 1) {
            enemy.dead = true;
            s.lives--;
            setLives(s.lives);
            if (s.lives <= 0) {
              s.phase = 'gameover';
              setPhase('gameover');
              // Save high score
              const prev = Number(localStorage.getItem('inksuite-games-towerdefense-highscore') || '0');
              if (s.score > prev) localStorage.setItem('inksuite-games-towerdefense-highscore', String(s.score));
            }
          }
        }

        // Tower shooting
        for (const tower of s.towers) {
          const def = TOWER_DEFS[tower.type];
          tower.lastShot -= clampedDt;
          if (tower.lastShot > 0) continue;

          const tx = (tower.col + 0.5) * CELL;
          const ty = (tower.row + 0.5) * CELL;

          // Find nearest enemy in range
          let target: Enemy | null = null;
          let minDist = Infinity;
          for (const enemy of s.enemies) {
            if (enemy.dead) continue;
            const [ec, er] = PATH[Math.min(enemy.pathIdx, PATH.length - 1)];
            const ex = (ec + 0.5) * CELL;
            const ey = (er + 0.5) * CELL;
            const dist = Math.sqrt((tx - ex) ** 2 + (ty - ey) ** 2) / CELL;
            if (dist <= def.range && dist < minDist) {
              minDist = dist;
              target = enemy;
            }
          }

          if (target) {
            const [ec, er] = PATH[Math.min(target.pathIdx, PATH.length - 1)];
            s.bullets.push({
              x: tx, y: ty,
              tx: (ec + 0.5) * CELL, ty: (er + 0.5) * CELL,
              damage: def.damage, aoe: def.aoe, speed: 300,
            });
            tower.lastShot = 1 / def.rate;
          }
        }

        // Move bullets
        for (let i = s.bullets.length - 1; i >= 0; i--) {
          const b = s.bullets[i];
          const dx = b.tx - b.x;
          const dy = b.ty - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 5) {
            // Hit
            if (b.aoe) {
              for (const enemy of s.enemies) {
                if (enemy.dead) continue;
                const [ec, er] = PATH[Math.min(enemy.pathIdx, PATH.length - 1)];
                const ex = (ec + 0.5) * CELL;
                const ey = (er + 0.5) * CELL;
                const d = Math.sqrt((b.tx - ex) ** 2 + (b.ty - ey) ** 2);
                if (d < CELL * 2) {
                  enemy.hp -= b.damage;
                  if (enemy.hp <= 0 && !enemy.dead) {
                    enemy.dead = true;
                    s.gold += enemy.reward;
                    s.score += enemy.reward;
                    setGold(s.gold);
                    setScore(s.score);
                  }
                }
              }
            } else {
              // Single target — find closest enemy to bullet target
              let closest: Enemy | null = null;
              let minD = Infinity;
              for (const enemy of s.enemies) {
                if (enemy.dead) continue;
                const [ec, er] = PATH[Math.min(enemy.pathIdx, PATH.length - 1)];
                const ex = (ec + 0.5) * CELL;
                const ey = (er + 0.5) * CELL;
                const d = Math.sqrt((b.tx - ex) ** 2 + (b.ty - ey) ** 2);
                if (d < CELL && d < minD) { minD = d; closest = enemy; }
              }
              if (closest) {
                closest.hp -= b.damage;
                if (closest.hp <= 0 && !closest.dead) {
                  closest.dead = true;
                  s.gold += closest.reward;
                  s.score += closest.reward;
                  setGold(s.gold);
                  setScore(s.score);
                }
              }
            }
            s.bullets.splice(i, 1);
          } else {
            const step = b.speed * clampedDt;
            b.x += (dx / dist) * step;
            b.y += (dy / dist) * step;
          }
        }

        // Clean dead enemies
        s.enemies = s.enemies.filter((e) => !e.dead || e.hp > 0);

        // Check wave complete
        if (s.spawnQueue.length === 0 && s.enemies.filter((e) => !e.dead).length === 0 && s.phase === 'wave') {
          if (s.wave >= 15) {
            s.phase = 'win';
            setPhase('win');
            const prev = Number(localStorage.getItem('inksuite-games-towerdefense-highscore') || '0');
            if (s.score > prev) localStorage.setItem('inksuite-games-towerdefense-highscore', String(s.score));
          } else {
            s.phase = 'prep';
            s.prepTimer = PREP_TIME;
            setPhase('prep');
          }
        }
      }

      // ── Draw ──
      ctx.clearRect(0, 0, W, H);

      // Grid
      ctx.fillStyle = '#f0efff';
      ctx.fillRect(0, 0, W, H);

      // Grid lines
      ctx.strokeStyle = '#e0d9ff';
      ctx.lineWidth = 0.5;
      for (let c = 0; c <= COLS; c++) {
        ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, H); ctx.stroke();
      }
      for (let r = 0; r <= ROWS; r++) {
        ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(W, r * CELL); ctx.stroke();
      }

      // Path
      ctx.fillStyle = '#c4b5fd';
      for (const [c, r] of PATH) {
        ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
      }

      // Path direction arrows (subtle)
      ctx.fillStyle = '#a78bfa';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < PATH.length - 1; i += 3) {
        const [c1, r1] = PATH[i];
        const [c2, r2] = PATH[Math.min(i + 1, PATH.length - 1)];
        const dx = c2 - c1;
        const dy = r2 - r1;
        const arrow = dx > 0 ? '→' : dx < 0 ? '←' : dy > 0 ? '↓' : '↑';
        ctx.fillText(arrow, (c1 + 0.5) * CELL, (r1 + 0.5) * CELL);
      }

      // Towers
      for (const tower of s.towers) {
        const def = TOWER_DEFS[tower.type];
        const x = tower.col * CELL;
        const y = tower.row * CELL;
        ctx.fillStyle = def.color;
        ctx.fillRect(x + 4, y + 4, CELL - 8, CELL - 8);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(def.name[0], x + CELL / 2, y + CELL / 2);

        // Range circle (subtle)
        if (s.selectedTower === tower.type) {
          ctx.beginPath();
          ctx.arc(x + CELL / 2, y + CELL / 2, def.range * CELL, 0, Math.PI * 2);
          ctx.strokeStyle = def.color + '30';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Enemies
      for (const enemy of s.enemies) {
        if (enemy.dead) continue;
        const idx = Math.min(enemy.pathIdx, PATH.length - 1);
        const [c1, r1] = PATH[idx];
        let ex: number, ey: number;
        if (idx < PATH.length - 1) {
          const [c2, r2] = PATH[idx + 1];
          ex = (c1 + (c2 - c1) * enemy.progress + 0.5) * CELL;
          ey = (r1 + (r2 - r1) * enemy.progress + 0.5) * CELL;
        } else {
          ex = (c1 + 0.5) * CELL;
          ey = (r1 + 0.5) * CELL;
        }

        const def = ENEMY_DEFS[enemy.type];
        const size = enemy.type === 'whale' ? 14 : 8;

        // Enemy body
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.arc(ex, ey, size, 0, Math.PI * 2);
        ctx.fill();

        // HP bar
        const hpPct = enemy.hp / enemy.maxHp;
        ctx.fillStyle = '#000';
        ctx.fillRect(ex - 12, ey - size - 6, 24, 3);
        ctx.fillStyle = hpPct > 0.5 ? '#22c55e' : hpPct > 0.25 ? '#f59e0b' : '#ef4444';
        ctx.fillRect(ex - 12, ey - size - 6, 24 * hpPct, 3);
      }

      // Bullets
      ctx.fillStyle = '#fff';
      for (const b of s.bullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = b.aoe ? '#ef4444' : '#7538F5';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Prep timer overlay
      if (s.phase === 'prep' && s.wave > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Wave ${s.wave + 1} in ${Math.ceil(s.prepTimer)}s`, W / 2, H / 2);
        ctx.font = '14px sans-serif';
        ctx.fillText('Place your towers!', W / 2, H / 2 + 30);
      }

      // Start message
      if (s.phase === 'prep' && s.wave === 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Defend the Ink Network!', W / 2, H / 2 - 20);
        ctx.font = '14px sans-serif';
        ctx.fillText('Click on empty cells to place towers', W / 2, H / 2 + 10);
        ctx.fillText(`Wave 1 starts in ${Math.ceil(s.prepTimer)}s`, W / 2, H / 2 + 35);
      }

      // Game over
      if (s.phase === 'gameover') {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 32px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Network Compromised!', W / 2, H / 2 - 20);
        ctx.fillStyle = '#fff';
        ctx.font = '16px sans-serif';
        ctx.fillText(`Score: ${s.score} · Wave: ${s.wave}`, W / 2, H / 2 + 15);
      }

      // Win
      if (s.phase === 'win') {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#22c55e';
        ctx.font = 'bold 32px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Network Secured!', W / 2, H / 2 - 20);
        ctx.fillStyle = '#fff';
        ctx.font = '16px sans-serif';
        ctx.fillText(`Score: ${s.score} · All 15 waves cleared!`, W / 2, H / 2 + 15);
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [startWave]);

  const restart = () => {
    const s = stateRef.current;
    s.towers = [];
    s.enemies = [];
    s.bullets = [];
    s.gold = 200;
    s.lives = 20;
    s.wave = 0;
    s.phase = 'prep';
    s.prepTimer = PREP_TIME;
    s.spawnQueue = [];
    s.score = 0;
    setGold(200);
    setLives(20);
    setWave(0);
    setPhase('prep');
    setScore(0);
  };

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center justify-between rounded-xl bg-white p-3 ring-1 ring-inset ring-purple-100 shadow-sm text-sm">
        <div className="flex gap-4">
          <span className="font-semibold text-ink-900">Wave: <span className="font-mono text-ink-500">{wave}/15</span></span>
          <span className="font-semibold text-ink-900">Gold: <span className="font-mono text-amber-600">{gold}</span></span>
          <span className="font-semibold text-ink-900">Lives: <span className={`font-mono ${lives <= 5 ? 'text-red-600' : 'text-emerald-600'}`}>{lives}</span></span>
          <span className="font-semibold text-ink-900">Score: <span className="font-mono text-ink-500">{score}</span></span>
        </div>
        {(phase === 'gameover' || phase === 'win') && (
          <div className="flex items-center gap-2">
            <MintScoreNFTButton gameId="towerdefense" gameTitle="Tower Defense" gameIcon="🏰" score={score} />
            <button onClick={restart} className="rounded-lg bg-ink-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-ink-600">
              Play Again
            </button>
          </div>
        )}
      </div>

      {/* Tower selector */}
      <div className="flex gap-2 flex-wrap">
        {(Object.entries(TOWER_DEFS) as [TowerType, typeof TOWER_DEFS[TowerType]][]).map(([type, def]) => (
          <button
            key={type}
            onClick={() => setSelectedTower(type)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ring-1 ring-inset transition ${
              selectedTower === type
                ? 'bg-ink-500 text-white ring-ink-600'
                : gold >= def.cost
                ? 'bg-white text-ink-700 ring-purple-200 hover:ring-ink-500'
                : 'bg-white text-ink-300 ring-purple-100 cursor-not-allowed'
            }`}
          >
            <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: def.color }} />
            {def.name} ({def.cost}g)
            {def.aoe && <span className="text-[10px] text-amber-500">AOE</span>}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div className="overflow-x-auto rounded-xl ring-1 ring-inset ring-purple-200 shadow-sm">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onClick={handleClick}
          className="cursor-crosshair"
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-[10px] text-ink-500">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-[#a3e635]" /> Spam Tx</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-[#facc15]" /> Bot</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-[#f97316]" /> MEV Attacker</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-[#dc2626]" /> Whale Exploit</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded bg-[#c4b5fd]" /> Path</span>
      </div>
    </div>
  );
}
