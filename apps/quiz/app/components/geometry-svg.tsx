'use client';

const SVGS: Record<string, () => React.ReactElement> = {
  // geo_001: Rectangle w=8, h=3
  rectangle_8_3: () => (
    <svg viewBox="0 0 220 120" className="h-24 w-44">
      <rect x="20" y="20" width="160" height="60" fill="none" stroke="#7538F5" strokeWidth="2" />
      {/* right angle markers */}
      <polyline points="20,40 36,40 36,20" fill="none" stroke="#a78bfa" strokeWidth="1" />
      <polyline points="164,20 164,36 180,36" fill="none" stroke="#a78bfa" strokeWidth="1" />
      {/* dimension labels */}
      <text x="100" y="112" textAnchor="middle" fill="#3b1d6e" fontSize="12" fontFamily="monospace">w = 8 cm</text>
      <text x="196" y="54" textAnchor="start" fill="#3b1d6e" fontSize="12" fontFamily="monospace">h = 3</text>
    </svg>
  ),

  // geo_002: Square s=7 (perimeter)
  square_s7: () => (
    <svg viewBox="0 0 180 180" className="h-32 w-32">
      <rect x="30" y="30" width="120" height="120" fill="none" stroke="#7538F5" strokeWidth="2" />
      {/* right angle markers */}
      <polyline points="30,50 46,50 46,30" fill="none" stroke="#a78bfa" strokeWidth="1" />
      {/* perimeter arrows on each side */}
      <text x="90" y="22" textAnchor="middle" fill="#3b1d6e" fontSize="12" fontFamily="monospace">7 cm</text>
      <text x="90" y="168" textAnchor="middle" fill="#3b1d6e" fontSize="12" fontFamily="monospace">7 cm</text>
      <text x="22" y="95" textAnchor="middle" fill="#3b1d6e" fontSize="12" fontFamily="monospace" transform="rotate(-90,22,95)">7 cm</text>
      <text x="168" y="95" textAnchor="middle" fill="#3b1d6e" fontSize="12" fontFamily="monospace" transform="rotate(90,168,95)">7 cm</text>
    </svg>
  ),

  // geo_003: Triangle base=6, height=4
  triangle_base6_height4: () => (
    <svg viewBox="0 0 200 150" className="h-32 w-40">
      <polygon points="20,130 180,130 100,20" fill="none" stroke="#7538F5" strokeWidth="2" />
      <line x1="100" y1="20" x2="100" y2="130" stroke="#a78bfa" strokeDasharray="4" strokeWidth="1" />
      {/* right angle at foot of height */}
      <polyline points="100,130 100,114 116,114" fill="none" stroke="#a78bfa" strokeWidth="1" />
      <text x="100" y="145" textAnchor="middle" fill="#3b1d6e" fontSize="12" fontFamily="monospace">b = 6 cm</text>
      <text x="112" y="80" fill="#3b1d6e" fontSize="12" fontFamily="monospace">h = 4</text>
    </svg>
  ),

  // geo_004: Triangle with angles summing to 180°
  triangle_angles_sum: () => (
    <svg viewBox="0 0 220 160" className="h-32 w-44">
      <polygon points="110,10 20,150 200,150" fill="none" stroke="#7538F5" strokeWidth="2" />
      {/* angle arcs */}
      <path d="M 110,10 m -10,18 A 20,20 0 0,1 10,18" fill="none" stroke="#a78bfa" strokeWidth="1.5" />
      <path d="M 20,150 m 18,-8 A 20,20 0 0,1 18,8" fill="none" stroke="#a78bfa" strokeWidth="1.5" />
      <path d="M 200,150 m -18,-8 A 20,20 0 0,0 -18,8" fill="none" stroke="#a78bfa" strokeWidth="1.5" />
      {/* angle labels */}
      <text x="110" y="48" textAnchor="middle" fill="#3b1d6e" fontSize="12" fontFamily="monospace">α</text>
      <text x="46" y="140" fill="#3b1d6e" fontSize="12" fontFamily="monospace">β</text>
      <text x="168" y="140" fill="#3b1d6e" fontSize="12" fontFamily="monospace">γ</text>
      <text x="110" y="175" textAnchor="middle" fill="#7538F5" fontSize="13" fontFamily="monospace" fontWeight="bold">α+β+γ = 180°</text>
    </svg>
  ),

  // geo_005: Circle r=5 (circumference)
  circle_r5: () => (
    <svg viewBox="0 0 200 200" className="h-32 w-32">
      <circle cx="100" cy="100" r="70" fill="none" stroke="#7538F5" strokeWidth="2" />
      <line x1="100" y1="100" x2="170" y2="100" stroke="#a78bfa" strokeWidth="1.5" />
      <text x="135" y="95" fill="#3b1d6e" fontSize="12" fontFamily="monospace">r = 5</text>
      <circle cx="100" cy="100" r="3" fill="#7538F5" />
    </svg>
  ),

  // geo_006: Right angle 90° with square marker
  right_angle_90: () => (
    <svg viewBox="0 0 200 200" className="h-32 w-32">
      <line x1="30" y1="170" x2="170" y2="170" stroke="#7538F5" strokeWidth="2" />
      <line x1="30" y1="170" x2="30" y2="30" stroke="#7538F5" strokeWidth="2" />
      {/* right angle square marker */}
      <polyline points="30,150 50,150 50,170" fill="none" stroke="#a78bfa" strokeWidth="2" />
      {/* angle arc */}
      <path d="M 60,170 A 30,30 0 0,0 30,140" fill="none" stroke="#a78bfa" strokeWidth="1.5" />
      <text x="66" y="148" fill="#7538F5" fontSize="14" fontFamily="monospace" fontWeight="bold">90°</text>
    </svg>
  ),

  // geo_007: Square s=9 (area, shaded)
  square_s9_area: () => (
    <svg viewBox="0 0 180 180" className="h-32 w-32">
      <rect x="20" y="20" width="140" height="140" fill="#ede9fe" stroke="#7538F5" strokeWidth="2" />
      {/* right angle marker */}
      <polyline points="20,40 36,40 36,20" fill="none" stroke="#a78bfa" strokeWidth="1" />
      <text x="90" y="12" textAnchor="middle" fill="#3b1d6e" fontSize="12" fontFamily="monospace">s = 9 cm</text>
      <text x="90" y="95" textAnchor="middle" fill="#7538F5" fontSize="13" fontFamily="monospace" fontWeight="bold">A = s²</text>
      <text x="168" y="95" textAnchor="start" fill="#3b1d6e" fontSize="12" fontFamily="monospace" transform="rotate(90,168,95)">9 cm</text>
    </svg>
  ),

  // geo_008: Rectangle l=10, w=4 (perimeter)
  rectangle_10_4: () => (
    <svg viewBox="0 0 240 120" className="h-24 w-48">
      <rect x="20" y="20" width="200" height="80" fill="none" stroke="#7538F5" strokeWidth="2" />
      {/* right angle markers */}
      <polyline points="20,40 36,40 36,20" fill="none" stroke="#a78bfa" strokeWidth="1" />
      <text x="120" y="115" textAnchor="middle" fill="#3b1d6e" fontSize="12" fontFamily="monospace">l = 10 cm</text>
      <text x="228" y="64" textAnchor="start" fill="#3b1d6e" fontSize="12" fontFamily="monospace">w = 4</text>
    </svg>
  ),

  // geo_009: Right triangle legs=3,4, hypotenuse=?
  right_triangle_3_4: () => (
    <svg viewBox="0 0 200 200" className="h-32 w-32">
      <polygon points="20,180 160,180 20,60" fill="none" stroke="#7538F5" strokeWidth="2" />
      {/* right angle marker */}
      <polyline points="20,180 20,164 36,164" fill="none" stroke="#a78bfa" strokeWidth="2" />
      <text x="90" y="196" textAnchor="middle" fill="#3b1d6e" fontSize="12" fontFamily="monospace">a = 3 cm</text>
      <text x="4" y="125" textAnchor="middle" fill="#3b1d6e" fontSize="12" fontFamily="monospace" transform="rotate(-90,4,125)">b = 4 cm</text>
      <text x="102" y="115" fill="#7538F5" fontSize="13" fontFamily="monospace" fontWeight="bold">c = ?</text>
    </svg>
  ),

  // geo_010: Circle r=7 (area, shaded)
  circle_r7: () => (
    <svg viewBox="0 0 200 200" className="h-32 w-32">
      <circle cx="100" cy="100" r="80" fill="#ede9fe" stroke="#7538F5" strokeWidth="2" />
      <line x1="100" y1="100" x2="180" y2="100" stroke="#a78bfa" strokeWidth="1.5" />
      <text x="140" y="93" fill="#3b1d6e" fontSize="12" fontFamily="monospace">r = 7</text>
      <circle cx="100" cy="100" r="3" fill="#7538F5" />
      <text x="100" y="140" textAnchor="middle" fill="#7538F5" fontSize="12" fontFamily="monospace">A = πr²</text>
    </svg>
  ),

  // geo_011: Triangle with two angles 55°, 75°, third=?
  triangle_angles_55_75: () => (
    <svg viewBox="0 0 220 170" className="h-32 w-44">
      <polygon points="110,15 15,155 205,155" fill="none" stroke="#7538F5" strokeWidth="2" />
      {/* angle arcs */}
      <path d="M 125,35 A 25,25 0 0,1 95,35" fill="none" stroke="#a78bfa" strokeWidth="1.5" />
      <path d="M 37,147 A 25,25 0 0,1 32,125" fill="none" stroke="#a78bfa" strokeWidth="1.5" />
      <path d="M 183,147 A 25,25 0 0,0 188,125" fill="none" stroke="#a78bfa" strokeWidth="1.5" />
      {/* angle labels */}
      <text x="110" y="58" textAnchor="middle" fill="#7538F5" fontSize="12" fontFamily="monospace" fontWeight="bold">?°</text>
      <text x="42" y="142" fill="#3b1d6e" fontSize="12" fontFamily="monospace">55°</text>
      <text x="162" y="142" fill="#3b1d6e" fontSize="12" fontFamily="monospace">75°</text>
    </svg>
  ),

  // geo_012: Rectangle area=60, w=5, find perimeter
  rectangle_area60_w5: () => (
    <svg viewBox="0 0 240 120" className="h-24 w-48">
      <rect x="20" y="20" width="200" height="80" fill="#ede9fe" stroke="#7538F5" strokeWidth="2" />
      <polyline points="20,40 36,40 36,20" fill="none" stroke="#a78bfa" strokeWidth="1" />
      <text x="120" y="115" textAnchor="middle" fill="#3b1d6e" fontSize="12" fontFamily="monospace">l = ? cm</text>
      <text x="228" y="64" textAnchor="start" fill="#3b1d6e" fontSize="12" fontFamily="monospace">w = 5</text>
      <text x="120" y="65" textAnchor="middle" fill="#7538F5" fontSize="12" fontFamily="monospace" fontWeight="bold">A = 60 cm²</text>
    </svg>
  ),

  // geo_013: Trapezoid parallel sides=8,12, height=5
  trapezoid_8_12_h5: () => (
    <svg viewBox="0 0 260 150" className="h-28 w-52">
      {/* trapezoid: bottom=12 (200px), top=8 (133px), centered */}
      <polygon points="30,120 230,120 196,30 64,30" fill="none" stroke="#7538F5" strokeWidth="2" />
      {/* height dashed line */}
      <line x1="130" y1="30" x2="130" y2="120" stroke="#a78bfa" strokeDasharray="4" strokeWidth="1" />
      {/* right angle at foot */}
      <polyline points="130,120 130,104 146,104" fill="none" stroke="#a78bfa" strokeWidth="1" />
      {/* labels */}
      <text x="130" y="22" textAnchor="middle" fill="#3b1d6e" fontSize="12" fontFamily="monospace">a = 8 cm</text>
      <text x="130" y="140" textAnchor="middle" fill="#3b1d6e" fontSize="12" fontFamily="monospace">b = 12 cm</text>
      <text x="140" y="78" fill="#3b1d6e" fontSize="12" fontFamily="monospace">h = 5</text>
    </svg>
  ),

  // geo_014: Right triangle hypotenuse=13, leg=5, other=?
  right_triangle_5_13: () => (
    <svg viewBox="0 0 200 200" className="h-32 w-32">
      <polygon points="20,180 140,180 20,60" fill="none" stroke="#7538F5" strokeWidth="2" />
      {/* right angle marker */}
      <polyline points="20,180 20,164 36,164" fill="none" stroke="#a78bfa" strokeWidth="2" />
      <text x="80" y="196" textAnchor="middle" fill="#3b1d6e" fontSize="12" fontFamily="monospace">a = 5 cm</text>
      <text x="4" y="125" textAnchor="middle" fill="#7538F5" fontSize="12" fontFamily="monospace" fontWeight="bold" transform="rotate(-90,4,125)">b = ?</text>
      <text x="92" y="108" fill="#3b1d6e" fontSize="12" fontFamily="monospace">c = 13</text>
    </svg>
  ),

  // geo_015: Equilateral triangle s=6
  equilateral_triangle_s6: () => (
    <svg viewBox="0 0 200 180" className="h-32 w-36">
      <polygon points="100,10 20,170 180,170" fill="none" stroke="#7538F5" strokeWidth="2" />
      {/* 60° angle markers */}
      <path d="M 40,162 A 22,22 0 0,1 32,142" fill="none" stroke="#a78bfa" strokeWidth="1.5" />
      <path d="M 158,162 A 22,22 0 0,0 168,142" fill="none" stroke="#a78bfa" strokeWidth="1.5" />
      <path d="M 113,28 A 22,22 0 0,1 87,28" fill="none" stroke="#a78bfa" strokeWidth="1.5" />
      {/* angle labels */}
      <text x="44" y="148" fill="#3b1d6e" fontSize="10" fontFamily="monospace">60°</text>
      <text x="148" y="148" fill="#3b1d6e" fontSize="10" fontFamily="monospace">60°</text>
      <text x="100" y="54" textAnchor="middle" fill="#3b1d6e" fontSize="10" fontFamily="monospace">60°</text>
      {/* side labels */}
      <text x="100" y="186" textAnchor="middle" fill="#3b1d6e" fontSize="12" fontFamily="monospace">s = 6 cm</text>
      <text x="46" y="95" fill="#3b1d6e" fontSize="11" fontFamily="monospace">6</text>
      <text x="148" y="95" fill="#3b1d6e" fontSize="11" fontFamily="monospace">6</text>
    </svg>
  ),

  // geo_016: Sphere r=3 (3D view)
  sphere_r3: () => (
    <svg viewBox="0 0 200 200" className="h-32 w-32">
      {/* outer circle */}
      <circle cx="100" cy="100" r="75" fill="none" stroke="#7538F5" strokeWidth="2" />
      {/* equator ellipse */}
      <ellipse cx="100" cy="100" rx="75" ry="22" fill="none" stroke="#a78bfa" strokeDasharray="5 3" strokeWidth="1.5" />
      {/* meridian arc (front half) */}
      <path d="M 100,25 A 75,75 0 0,1 100,175" fill="none" stroke="#a78bfa" strokeWidth="1" strokeDasharray="3 3" />
      {/* radius line */}
      <line x1="100" y1="100" x2="175" y2="100" stroke="#a78bfa" strokeWidth="1.5" />
      <text x="137" y="93" fill="#3b1d6e" fontSize="12" fontFamily="monospace">r = 3</text>
      <circle cx="100" cy="100" r="3" fill="#7538F5" />
    </svg>
  ),

  // geo_017: Square s=10 with inscribed circle
  circle_inscribed_square_10: () => (
    <svg viewBox="0 0 200 200" className="h-32 w-32">
      {/* square */}
      <rect x="20" y="20" width="160" height="160" fill="#ede9fe" stroke="#7538F5" strokeWidth="2" />
      {/* inscribed circle */}
      <circle cx="100" cy="100" r="80" fill="white" stroke="#7538F5" strokeWidth="2" />
      {/* right angle marker */}
      <polyline points="20,40 36,40 36,20" fill="none" stroke="#a78bfa" strokeWidth="1" />
      {/* radius line */}
      <line x1="100" y1="100" x2="180" y2="100" stroke="#a78bfa" strokeWidth="1.5" />
      <text x="140" y="93" fill="#3b1d6e" fontSize="11" fontFamily="monospace">r = 5</text>
      <text x="100" y="12" textAnchor="middle" fill="#3b1d6e" fontSize="12" fontFamily="monospace">s = 10 cm</text>
    </svg>
  ),

  // geo_018: Cone r=4, h=9 (3D view)
  cone_r4_h9: () => (
    <svg viewBox="0 0 200 220" className="h-36 w-32">
      {/* base ellipse */}
      <ellipse cx="100" cy="175" rx="70" ry="22" fill="none" stroke="#7538F5" strokeWidth="2" />
      {/* sides */}
      <line x1="100" y1="30" x2="30" y2="175" stroke="#7538F5" strokeWidth="2" />
      <line x1="100" y1="30" x2="170" y2="175" stroke="#7538F5" strokeWidth="2" />
      {/* height dashed line */}
      <line x1="100" y1="30" x2="100" y2="175" stroke="#a78bfa" strokeDasharray="4" strokeWidth="1" />
      {/* right angle at base */}
      <polyline points="100,175 100,159 116,159" fill="none" stroke="#a78bfa" strokeWidth="1" />
      {/* radius line on base */}
      <line x1="100" y1="175" x2="170" y2="175" stroke="#a78bfa" strokeWidth="1.5" />
      {/* labels */}
      <text x="135" y="172" fill="#3b1d6e" fontSize="11" fontFamily="monospace">r = 4</text>
      <text x="108" y="108" fill="#3b1d6e" fontSize="11" fontFamily="monospace">h = 9</text>
    </svg>
  ),

  // geo_019: Circle r=10 with chord 6cm from center
  circle_chord_r10_d6: () => (
    <svg viewBox="0 0 220 220" className="h-36 w-36">
      <circle cx="110" cy="110" r="90" fill="none" stroke="#7538F5" strokeWidth="2" />
      {/* perpendicular from center to chord */}
      <line x1="110" y1="110" x2="110" y2="56" stroke="#a78bfa" strokeDasharray="4" strokeWidth="1.5" />
      {/* right angle at chord */}
      <polyline points="110,56 110,72 126,72" fill="none" stroke="#a78bfa" strokeWidth="1" />
      {/* chord */}
      <line x1="42" y1="56" x2="178" y2="56" stroke="#7538F5" strokeWidth="2.5" />
      {/* radius to chord end */}
      <line x1="110" y1="110" x2="178" y2="56" stroke="#a78bfa" strokeWidth="1.5" />
      {/* center dot */}
      <circle cx="110" cy="110" r="3" fill="#7538F5" />
      {/* labels */}
      <text x="116" y="86" fill="#3b1d6e" fontSize="11" fontFamily="monospace">d = 6</text>
      <text x="148" y="88" fill="#3b1d6e" fontSize="11" fontFamily="monospace">r = 10</text>
      <text x="110" y="50" textAnchor="middle" fill="#7538F5" fontSize="12" fontFamily="monospace" fontWeight="bold">chord = ?</text>
    </svg>
  ),

  // geo_020: Cylinder r=5, h=12 (3D view, surface area)
  cylinder_r5_h12: () => (
    <svg viewBox="0 0 180 240" className="h-40 w-28">
      {/* top ellipse */}
      <ellipse cx="90" cy="40" rx="60" ry="20" fill="none" stroke="#7538F5" strokeWidth="2" />
      {/* sides */}
      <line x1="30" y1="40" x2="30" y2="185" stroke="#7538F5" strokeWidth="2" />
      <line x1="150" y1="40" x2="150" y2="185" stroke="#7538F5" strokeWidth="2" />
      {/* bottom ellipse */}
      <ellipse cx="90" cy="185" rx="60" ry="20" fill="none" stroke="#7538F5" strokeWidth="2" />
      {/* radius line on top */}
      <line x1="90" y1="40" x2="150" y2="40" stroke="#a78bfa" strokeWidth="1.5" />
      {/* height dimension line */}
      <line x1="160" y1="40" x2="160" y2="185" stroke="#a78bfa" strokeWidth="1" strokeDasharray="3" />
      {/* labels */}
      <text x="120" y="34" fill="#3b1d6e" fontSize="11" fontFamily="monospace">r = 5</text>
      <text x="163" y="116" fill="#3b1d6e" fontSize="11" fontFamily="monospace">h = 12</text>
    </svg>
  ),

  // Legacy aliases kept for backwards compat
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
  circle_d10: () => (
    <svg viewBox="0 0 200 200" className="h-32 w-32">
      <circle cx="100" cy="100" r="70" fill="none" stroke="#7538F5" strokeWidth="2" />
      <line x1="30" y1="100" x2="170" y2="100" stroke="#a78bfa" strokeWidth="1.5" />
      <text x="100" y="95" textAnchor="middle" fill="#3b1d6e" fontSize="12" fontFamily="monospace">d = 10</text>
      <circle cx="100" cy="100" r="3" fill="#7538F5" />
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
