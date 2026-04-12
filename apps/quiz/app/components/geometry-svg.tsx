'use client';

const SVGS: Record<string, () => React.ReactElement> = {
  triangle_base6_height4: () => (
    <svg viewBox="0 0 200 150" className="h-32 w-40">
      <polygon points="20,130 180,130 100,20" fill="none" stroke="#7538F5" strokeWidth="2" />
      <text x="100" y="145" textAnchor="middle" fill="#3b1d6e" fontSize="12" fontFamily="monospace">b = 6</text>
      <line x1="100" y1="20" x2="100" y2="130" stroke="#a78bfa" strokeDasharray="4" strokeWidth="1" />
      <text x="112" y="80" fill="#3b1d6e" fontSize="12" fontFamily="monospace">h = 4</text>
    </svg>
  ),
  circle_r5: () => (
    <svg viewBox="0 0 200 200" className="h-32 w-32">
      <circle cx="100" cy="100" r="70" fill="none" stroke="#7538F5" strokeWidth="2" />
      <line x1="100" y1="100" x2="170" y2="100" stroke="#a78bfa" strokeWidth="1.5" />
      <text x="135" y="95" fill="#3b1d6e" fontSize="12" fontFamily="monospace">r = 5</text>
      <circle cx="100" cy="100" r="3" fill="#7538F5" />
    </svg>
  ),
  right_triangle_3_4: () => (
    <svg viewBox="0 0 200 200" className="h-32 w-32">
      <polygon points="20,180 180,180 20,40" fill="none" stroke="#7538F5" strokeWidth="2" />
      <rect x="20" y="164" width="16" height="16" fill="none" stroke="#a78bfa" strokeWidth="1" />
      <text x="100" y="196" textAnchor="middle" fill="#3b1d6e" fontSize="12" fontFamily="monospace">a = 3</text>
      <text x="8" y="115" fill="#3b1d6e" fontSize="12" fontFamily="monospace">b = 4</text>
      <text x="110" y="105" fill="#7538F5" fontSize="13" fontFamily="monospace" fontWeight="bold">c = ?</text>
    </svg>
  ),
  rectangle_8_3: () => (
    <svg viewBox="0 0 220 120" className="h-24 w-44">
      <rect x="20" y="20" width="180" height="80" fill="none" stroke="#7538F5" strokeWidth="2" />
      <text x="110" y="110" textAnchor="middle" fill="#3b1d6e" fontSize="12" fontFamily="monospace">w = 8</text>
      <text x="210" y="65" fill="#3b1d6e" fontSize="12" fontFamily="monospace">h = 3</text>
    </svg>
  ),
  circle_d10: () => (
    <svg viewBox="0 0 200 200" className="h-32 w-32">
      <circle cx="100" cy="100" r="70" fill="none" stroke="#7538F5" strokeWidth="2" />
      <line x1="30" y1="100" x2="170" y2="100" stroke="#a78bfa" strokeWidth="1.5" />
      <text x="100" y="95" textAnchor="middle" fill="#3b1d6e" fontSize="12" fontFamily="monospace">d = 10</text>
      <circle cx="100" cy="100" r="3" fill="#7538F5" />
    </svg>
  ),
  triangle_equilateral_6: () => (
    <svg viewBox="0 0 200 180" className="h-32 w-36">
      <polygon points="100,10 20,170 180,170" fill="none" stroke="#7538F5" strokeWidth="2" />
      <text x="100" y="186" textAnchor="middle" fill="#3b1d6e" fontSize="12" fontFamily="monospace">s = 6</text>
      <text x="48" y="95" fill="#3b1d6e" fontSize="12" fontFamily="monospace">6</text>
      <text x="148" y="95" fill="#3b1d6e" fontSize="12" fontFamily="monospace">6</text>
    </svg>
  ),
  cube_5: () => (
    <svg viewBox="0 0 200 200" className="h-32 w-32">
      <rect x="30" y="50" width="100" height="100" fill="none" stroke="#7538F5" strokeWidth="2" />
      <polygon points="30,50 70,20 170,20 130,50" fill="none" stroke="#7538F5" strokeWidth="1.5" />
      <line x1="130" y1="50" x2="170" y2="20" stroke="#7538F5" strokeWidth="1.5" />
      <line x1="130" y1="150" x2="170" y2="120" stroke="#a78bfa" strokeDasharray="3" strokeWidth="1" />
      <line x1="170" y1="20" x2="170" y2="120" stroke="#a78bfa" strokeDasharray="3" strokeWidth="1" />
      <text x="80" y="170" textAnchor="middle" fill="#3b1d6e" fontSize="12" fontFamily="monospace">s = 5</text>
    </svg>
  ),
  cylinder_r3_h7: () => (
    <svg viewBox="0 0 180 220" className="h-36 w-28">
      <ellipse cx="90" cy="40" rx="60" ry="20" fill="none" stroke="#7538F5" strokeWidth="2" />
      <line x1="30" y1="40" x2="30" y2="170" stroke="#7538F5" strokeWidth="2" />
      <line x1="150" y1="40" x2="150" y2="170" stroke="#7538F5" strokeWidth="2" />
      <ellipse cx="90" cy="170" rx="60" ry="20" fill="none" stroke="#7538F5" strokeWidth="2" />
      <line x1="90" y1="40" x2="150" y2="40" stroke="#a78bfa" strokeWidth="1" />
      <text x="120" y="35" fill="#3b1d6e" fontSize="11" fontFamily="monospace">r=3</text>
      <text x="155" y="110" fill="#3b1d6e" fontSize="11" fontFamily="monospace">h=7</text>
    </svg>
  ),
  angle_45: () => (
    <svg viewBox="0 0 200 200" className="h-32 w-32">
      <line x1="30" y1="170" x2="170" y2="170" stroke="#7538F5" strokeWidth="2" />
      <line x1="30" y1="170" x2="140" y2="40" stroke="#7538F5" strokeWidth="2" />
      <path d="M 60,170 A 30,30 0 0,1 52,148" fill="none" stroke="#a78bfa" strokeWidth="1.5" />
      <text x="68" y="158" fill="#7538F5" fontSize="13" fontFamily="monospace" fontWeight="bold">45°</text>
    </svg>
  ),
  parallelogram_b8_h5: () => (
    <svg viewBox="0 0 240 130" className="h-24 w-48">
      <polygon points="50,110 200,110 230,20 80,20" fill="none" stroke="#7538F5" strokeWidth="2" />
      <line x1="80" y1="20" x2="80" y2="110" stroke="#a78bfa" strokeDasharray="4" strokeWidth="1" />
      <text x="125" y="126" textAnchor="middle" fill="#3b1d6e" fontSize="12" fontFamily="monospace">b = 8</text>
      <text x="65" y="70" fill="#3b1d6e" fontSize="12" fontFamily="monospace">h = 5</text>
    </svg>
  ),
};

export function GeometrySvg({ name }: { name: string }) {
  const Svg = SVGS[name];
  if (!Svg) return null;
  return (
    <div className="inline-flex rounded-lg bg-purple-50/50 p-4 ring-1 ring-inset ring-purple-100">
      <Svg />
    </div>
  );
}
