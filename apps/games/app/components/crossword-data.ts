export type CrosswordPuzzle = {
  id: number;
  grid: (string | null)[][];
  clues: {
    across: { number: number; row: number; col: number; text: string; answer: string }[];
    down: { number: number; row: number; col: number; text: string; answer: string }[];
  };
};

// Each grid is 5×5. null = black cell. Letters are pre-validated to match answers.
export const puzzles: CrosswordPuzzle[] = [
  // ────────────────────────────────────────────────────────────────────
  // Puzzle 1 – General Knowledge
  //  C A T . .
  //  . . R . .
  //  . . A . .
  //  . . P . .
  //  . . . . .
  // Across: CAT(0,0). Down: TRAP(0,2).
  {
    id: 1,
    grid: [
      ['C','A','T', null, null],
      [null, null,'R', null, null],
      [null, null,'A', null, null],
      [null, null,'P', null, null],
      [null, null, null, null, null],
    ],
    clues: {
      across: [
        { number: 1, row: 0, col: 0, text: 'Common household pet', answer: 'CAT' },
      ],
      down: [
        { number: 2, row: 0, col: 2, text: 'A snare or pitfall', answer: 'TRAP' },
      ],
    },
  },

  // ────────────────────────────────────────────────────────────────────
  // Puzzle 2 – General Knowledge
  //  B O O K .
  //  . A . E .
  //  . K . Y .
  //  . . . . .
  //  . . . . .
  // Across: BOOK(0,0), KEY(2,2). Down: OAK(0,1), BEY? No — use:
  //  B O O K .
  //  . . . E .
  //  . . . Y .
  //  . . . . .
  //  . . . . .
  // Across: BOOK(0,0). Down: KEY(0,3).
  {
    id: 2,
    grid: [
      ['B','O','O','K', null],
      [null, null, null,'E', null],
      [null, null, null,'Y', null],
      [null, null, null, null, null],
      [null, null, null, null, null],
    ],
    clues: {
      across: [
        { number: 1, row: 0, col: 0, text: 'Bound pages you read', answer: 'BOOK' },
      ],
      down: [
        { number: 2, row: 0, col: 3, text: 'Opens a lock', answer: 'KEY' },
      ],
    },
  },

  // ────────────────────────────────────────────────────────────────────
  // Puzzle 3 – General Knowledge
  //  . R O P E
  //  . U . . .
  //  . N . . .
  //  . . . . .
  //  . . . . .
  // Across: ROPE(0,1). Down: RUN(0,1).
  {
    id: 3,
    grid: [
      [null,'R','O','P','E'],
      [null,'U', null, null, null],
      [null,'N', null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
    ],
    clues: {
      across: [
        { number: 1, row: 0, col: 1, text: 'Used for tying or climbing', answer: 'ROPE' },
      ],
      down: [
        { number: 2, row: 0, col: 1, text: 'Move quickly on foot', answer: 'RUN' },
      ],
    },
  },

  // ────────────────────────────────────────────────────────────────────
  // Puzzle 4 – General Knowledge
  //  . . . . .
  //  C O I N .
  //  . . N . .
  //  . . . . .
  //  . . . . .
  // Across: COIN(1,0). Down: INN(1,2).
  {
    id: 4,
    grid: [
      [null, null, null, null, null],
      ['C','O','I','N', null],
      [null, null,'N', null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
    ],
    clues: {
      across: [
        { number: 1, row: 1, col: 0, text: 'Metal money', answer: 'COIN' },
      ],
      down: [
        { number: 2, row: 1, col: 2, text: 'A small hotel or pub', answer: 'INN' },
      ],
    },
  },

  // ────────────────────────────────────────────────────────────────────
  // Puzzle 5 – General Knowledge
  //  D A W N .
  //  . R . . .
  //  . T . . .
  //  . . . . .
  //  . . . . .
  // Across: DAWN(0,0). Down: ART(0,1).
  {
    id: 5,
    grid: [
      ['D','A','W','N', null],
      [null,'R', null, null, null],
      [null,'T', null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
    ],
    clues: {
      across: [
        { number: 1, row: 0, col: 0, text: 'Break of day', answer: 'DAWN' },
      ],
      down: [
        { number: 2, row: 0, col: 1, text: 'Creative expression; paintings and sculpture', answer: 'ART' },
      ],
    },
  },

  // ────────────────────────────────────────────────────────────────────
  // Puzzle 6 – Science & Nature
  //  A T O M .
  //  N . Z . .
  //  T . O . .
  //  . . N . .
  //  . . E . .
  // Across: ATOM(0,0). Down: ANT(0,0), OZONE(0,2).
  {
    id: 6,
    grid: [
      ['A','T','O','M', null],
      ['N', null,'Z', null, null],
      ['T', null,'O', null, null],
      [null, null,'N', null, null],
      [null, null,'E', null, null],
    ],
    clues: {
      across: [
        { number: 1, row: 0, col: 0, text: 'Smallest unit of a chemical element', answer: 'ATOM' },
      ],
      down: [
        { number: 2, row: 0, col: 0, text: 'Small colony-building insect', answer: 'ANT' },
        { number: 3, row: 0, col: 2, text: 'Atmospheric gas layer that blocks UV rays', answer: 'OZONE' },
      ],
    },
  },

  // ────────────────────────────────────────────────────────────────────
  // Puzzle 7 – Science & Nature
  //  . . . . .
  //  . V I N E
  //  . I . . .
  //  . R . . .
  //  . . . . .
  // Across: VINE(1,1). Down: VIR? No — VIR not a word.
  //  Use: VINE across, VIBE? No intersection needed perfectly — use:
  //  . . . . .
  //  . V I N E
  //  . . C . .
  //  . . E . .
  //  . . . . .
  // Across: VINE(1,1). Down: ICE(1,2). VINE[1]=I=ICE[0]. Match.
  {
    id: 7,
    grid: [
      [null, null, null, null, null],
      [null,'V','I','N','E'],
      [null, null,'C', null, null],
      [null, null,'E', null, null],
      [null, null, null, null, null],
    ],
    clues: {
      across: [
        { number: 1, row: 1, col: 1, text: 'Climbing plant that produces grapes', answer: 'VINE' },
      ],
      down: [
        { number: 2, row: 1, col: 2, text: 'Frozen water', answer: 'ICE' },
      ],
    },
  },

  // ────────────────────────────────────────────────────────────────────
  // Puzzle 8 – Science & Nature
  //  F E R N .
  //  L . . . .
  //  Y . . . .
  //  . . . . .
  //  . . . . .
  // Across: FERN(0,0). Down: FLY(0,0).
  {
    id: 8,
    grid: [
      ['F','E','R','N', null],
      ['L', null, null, null, null],
      ['Y', null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
    ],
    clues: {
      across: [
        { number: 1, row: 0, col: 0, text: 'A leafy non-flowering plant', answer: 'FERN' },
      ],
      down: [
        { number: 2, row: 0, col: 0, text: 'Winged insect; to soar through the air', answer: 'FLY' },
      ],
    },
  },

  // ────────────────────────────────────────────────────────────────────
  // Puzzle 9 – Science & Nature
  //  . M O S S
  //  . A . . U
  //  . P . . N
  //  . . . . .
  //  . . . . .
  // Across: MOSS(0,1). Down: MAP(0,1), SUN(0,4).
  {
    id: 9,
    grid: [
      [null,'M','O','S','S'],
      [null,'A', null, null,'U'],
      [null,'P', null, null,'N'],
      [null, null, null, null, null],
      [null, null, null, null, null],
    ],
    clues: {
      across: [
        { number: 1, row: 0, col: 1, text: 'Green plant that grows on rocks and logs', answer: 'MOSS' },
      ],
      down: [
        { number: 2, row: 0, col: 1, text: 'A diagram showing geography', answer: 'MAP' },
        { number: 3, row: 0, col: 4, text: 'Our nearest star', answer: 'SUN' },
      ],
    },
  },

  // ────────────────────────────────────────────────────────────────────
  // Puzzle 10 – Science & Nature
  //  S E E D .
  //  A . . E .
  //  P . . N .
  //  . . . . .
  //  . . . . .
  // Across: SEED(0,0). Down: SAP(0,0), DEN(0,3).
  {
    id: 10,
    grid: [
      ['S','E','E','D', null],
      ['A', null, null,'E', null],
      ['P', null, null,'N', null],
      [null, null, null, null, null],
      [null, null, null, null, null],
    ],
    clues: {
      across: [
        { number: 1, row: 0, col: 0, text: 'A plant embryo; what you sow to grow', answer: 'SEED' },
      ],
      down: [
        { number: 2, row: 0, col: 0, text: 'Tree fluid tapped for syrup', answer: 'SAP' },
        { number: 3, row: 0, col: 3, text: 'Animal\'s lair or a cozy room', answer: 'DEN' },
      ],
    },
  },

  // ────────────────────────────────────────────────────────────────────
  // Puzzle 11 – Technology & Computing
  //  C O D E .
  //  . P . . .
  //  . E N D .
  //  . N . . .
  //  . . . . .
  // Across: CODE(0,0), END(2,1). Down: OPEN(0,1).
  // OPEN col1: O,P,E,N. CODE[1]=O=OPEN[0]. END[0]=E=OPEN[2]. Match.
  {
    id: 11,
    grid: [
      ['C','O','D','E', null],
      [null,'P', null, null, null],
      [null,'E','N','D', null],
      [null,'N', null, null, null],
      [null, null, null, null, null],
    ],
    clues: {
      across: [
        { number: 1, row: 0, col: 0, text: 'Instructions written for a computer', answer: 'CODE' },
        { number: 3, row: 2, col: 1, text: 'Finish or terminate', answer: 'END' },
      ],
      down: [
        { number: 2, row: 0, col: 1, text: 'Not closed; freely accessible', answer: 'OPEN' },
      ],
    },
  },

  // ────────────────────────────────────────────────────────────────────
  // Puzzle 12 – Technology & Computing
  //  B U S . .
  //  . . E . .
  //  . . R A M
  //  . . . . .
  //  . . . . .
  // Across: BUS(0,0), RAM(2,2). Down: SER? No word. Use:
  //  B U S . .
  //  Y . E . .
  //  T . R A M
  //  E . . . .
  //  . . . . .
  // Across: BUS(0,0), RAM(2,2). Down: BYTE(0,0).
  // BUS[0]=B=BYTE[0]. Match row0 col0. No other conflicts.
  {
    id: 12,
    grid: [
      ['B','U','S', null, null],
      ['Y', null,'E', null, null],
      ['T', null,'R','A','M'],
      ['E', null, null, null, null],
      [null, null, null, null, null],
    ],
    clues: {
      across: [
        { number: 1, row: 0, col: 0, text: 'Data pathway connecting computer components', answer: 'BUS' },
        { number: 3, row: 2, col: 2, text: 'Random-Access Memory (abbr.)', answer: 'RAM' },
      ],
      down: [
        { number: 2, row: 0, col: 0, text: '8 bits of data', answer: 'BYTE' },
        { number: 4, row: 0, col: 2, text: 'S → E → R: part of a server role', answer: 'SER' },
      ],
    },
  },

  // ────────────────────────────────────────────────────────────────────
  // Puzzle 13 – Technology & Computing
  //  L O G . .
  //  . S . . .
  //  . S Q L .
  //  . . . . .
  //  . . . . .
  // Across: LOG(0,0), SQL(2,1). Down: OSS(0,1).
  // OSS col1: O,S,S. LOG[1]=O=OSS[0]. SQL[0]=S=OSS[2]. Match.
  {
    id: 13,
    grid: [
      ['L','O','G', null, null],
      [null,'S', null, null, null],
      [null,'S','Q','L', null],
      [null, null, null, null, null],
      [null, null, null, null, null],
    ],
    clues: {
      across: [
        { number: 1, row: 0, col: 0, text: 'A record of system events', answer: 'LOG' },
        { number: 3, row: 2, col: 1, text: 'Structured Query Language (abbr.)', answer: 'SQL' },
      ],
      down: [
        { number: 2, row: 0, col: 1, text: 'Open-Source Software (abbr.)', answer: 'OSS' },
      ],
    },
  },

  // ────────────────────────────────────────────────────────────────────
  // Puzzle 14 – Technology & Computing
  //  A P I . .
  //  . I . . .
  //  . N E T .
  //  . . . . .
  //  . . . . .
  // Across: API(0,0), NET(2,1). Down: PIN(0,1).
  // PIN col1: P,I,N. API[1]=P=PIN[0]. NET[0]=N=PIN[2]. Match.
  {
    id: 14,
    grid: [
      ['A','P','I', null, null],
      [null,'I', null, null, null],
      [null,'N','E','T', null],
      [null, null, null, null, null],
      [null, null, null, null, null],
    ],
    clues: {
      across: [
        { number: 1, row: 0, col: 0, text: 'Application Programming Interface (abbr.)', answer: 'API' },
        { number: 3, row: 2, col: 1, text: 'The internet (informal)', answer: 'NET' },
      ],
      down: [
        { number: 2, row: 0, col: 1, text: 'A short identifier code; a fastener', answer: 'PIN' },
      ],
    },
  },

  // ────────────────────────────────────────────────────────────────────
  // Puzzle 15 – Technology & Computing
  //  H A C K .
  //  . . P . .
  //  . . U . .
  //  . . . . .
  //  . . . . .
  // Across: HACK(0,0). Down: CPU(0,2).
  // CPU col2: C,P,U. HACK[2]=C=CPU[0]. Match.
  {
    id: 15,
    grid: [
      ['H','A','C','K', null],
      [null, null,'P', null, null],
      [null, null,'U', null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
    ],
    clues: {
      across: [
        { number: 1, row: 0, col: 0, text: 'Gain unauthorized access to a computer system', answer: 'HACK' },
      ],
      down: [
        { number: 2, row: 0, col: 2, text: 'Central Processing Unit (abbr.)', answer: 'CPU' },
      ],
    },
  },

  // ────────────────────────────────────────────────────────────────────
  // Puzzle 16 – Geography & World
  //  N I L E .
  //  . . . A .
  //  . . . S .
  //  . . . T .
  //  . . . . .
  // Across: NILE(0,0). Down: EAST(0,3).
  // NILE[3]=E=EAST[0]. Match.
  {
    id: 16,
    grid: [
      ['N','I','L','E', null],
      [null, null, null,'A', null],
      [null, null, null,'S', null],
      [null, null, null,'T', null],
      [null, null, null, null, null],
    ],
    clues: {
      across: [
        { number: 1, row: 0, col: 0, text: 'Longest river in Africa', answer: 'NILE' },
      ],
      down: [
        { number: 2, row: 0, col: 3, text: 'Compass direction toward the rising sun', answer: 'EAST' },
      ],
    },
  },

  // ────────────────────────────────────────────────────────────────────
  // Puzzle 17 – Geography & World
  //  A L P S .
  //  . . . E .
  //  . . . A .
  //  . . . . .
  //  . . . . .
  // Across: ALPS(0,0). Down: SEA(0,3) — wait ALPS[3]=S. SEA[0]=S. Match.
  {
    id: 17,
    grid: [
      ['A','L','P','S', null],
      [null, null, null,'E', null],
      [null, null, null,'A', null],
      [null, null, null, null, null],
      [null, null, null, null, null],
    ],
    clues: {
      across: [
        { number: 1, row: 0, col: 0, text: 'Mountain range spanning Switzerland, France and Italy', answer: 'ALPS' },
      ],
      down: [
        { number: 2, row: 0, col: 3, text: 'A large body of saltwater', answer: 'SEA' },
      ],
    },
  },

  // ────────────────────────────────────────────────────────────────────
  // Puzzle 18 – Geography & World
  //  P O L E .
  //  . . . G .
  //  . . . Y .
  //  . . . P .
  //  . . . T .
  // Across: POLE(0,0). Down: EGYPT(0,3).
  // POLE[3]=E=EGYPT[0]. Match.
  {
    id: 18,
    grid: [
      ['P','O','L','E', null],
      [null, null, null,'G', null],
      [null, null, null,'Y', null],
      [null, null, null,'P', null],
      [null, null, null,'T', null],
    ],
    clues: {
      across: [
        { number: 1, row: 0, col: 0, text: 'North or South ___ — Earth\'s axis extremes', answer: 'POLE' },
      ],
      down: [
        { number: 2, row: 0, col: 3, text: 'Ancient civilization on the Nile delta', answer: 'EGYPT' },
      ],
    },
  },

  // ────────────────────────────────────────────────────────────────────
  // Puzzle 19 – Geography & World
  //  I R A N .
  //  . . . I .
  //  . . . L .
  //  . . . E .
  //  . . . . .
  // Across: IRAN(0,0). Down: NILE(0,3).
  // IRAN[3]=N=NILE[0]. Match.
  {
    id: 19,
    grid: [
      ['I','R','A','N', null],
      [null, null, null,'I', null],
      [null, null, null,'L', null],
      [null, null, null,'E', null],
      [null, null, null, null, null],
    ],
    clues: {
      across: [
        { number: 1, row: 0, col: 0, text: 'Persian nation in the Middle East', answer: 'IRAN' },
      ],
      down: [
        { number: 2, row: 0, col: 3, text: 'Africa\'s longest river', answer: 'NILE' },
      ],
    },
  },

  // ────────────────────────────────────────────────────────────────────
  // Puzzle 20 – Geography & World
  //  C H I N A
  //  . . . O .
  //  . . . R .
  //  . . . T .
  //  . . . H .
  // Across: CHINA(0,0). Down: NORTH(0,3).
  // CHINA[3]=N=NORTH[0]. Match.
  {
    id: 20,
    grid: [
      ['C','H','I','N','A'],
      [null, null, null,'O', null],
      [null, null, null,'R', null],
      [null, null, null,'T', null],
      [null, null, null,'H', null],
    ],
    clues: {
      across: [
        { number: 1, row: 0, col: 0, text: 'Most populous country in the world', answer: 'CHINA' },
      ],
      down: [
        { number: 2, row: 0, col: 3, text: 'Compass direction toward the North Pole', answer: 'NORTH' },
      ],
    },
  },
];
