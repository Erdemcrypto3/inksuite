export const CONTRACT_ADDRESS = '0x7A0bB0C37a934b3858436E61838719a5a7F63720' as const;

export const API_URL = 'https://api.inksuite.xyz';

export type CategoryItem = { main: string; subs: string[] };

export const DEFAULT_CATEGORIES: CategoryItem[] = [
  { main: 'Blockchain & Web3', subs: ['Layer 1 & Layer 2', 'Smart Contracts', 'Wallets & Security', 'Interoperability'] },
  { main: 'DeFi', subs: ['Lending & Borrowing', 'DEX & Trading', 'Yield & Staking', 'Stablecoins'] },
  { main: 'NFTs & Digital Assets', subs: ['Art & Collectibles', 'Gaming & Metaverse', 'Utility NFTs', 'Marketplaces'] },
  { main: 'Ink Ecosystem', subs: ['Ink Chain Updates', 'Ink dApps', 'Builder Stories', 'Tutorials & Guides'] },
  { main: 'Opinion & Analysis', subs: ['Market Analysis', 'Project Reviews', 'Predictions', 'Editorials'] },
  { main: 'Development', subs: ['Solidity & EVM', 'Frontend & dApps', 'Tools & Infrastructure', 'Open Source'] },
];

// [PAI-0035] Treat localStorage as untrusted: round-tripped JSON can be
// browser-extension-injected, manually edited, or corrupted by a prior bad
// write. Validate shape before use, fall back to DEFAULT_CATEGORIES on any
// shape mismatch, and enforce 32-byte UTF-8 caps with codepoint-safe slicing.

const TAG_BYTE_LIMIT = 32; // matches the on-chain bytes32 tag field

function utf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

// Codepoint-aware slice that never cuts a multi-byte UTF-8 character in half.
// Drops trailing codepoints until the byte length is within `limit`.
function clampUtf8Bytes(s: string, limit: number): string {
  if (utf8ByteLength(s) <= limit) return s;
  const codepoints = Array.from(s);
  let lo = 0, hi = codepoints.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (utf8ByteLength(codepoints.slice(0, mid).join('')) <= limit) lo = mid;
    else hi = mid - 1;
  }
  return codepoints.slice(0, lo).join('');
}

function isValidCategoryItem(x: unknown): x is CategoryItem {
  if (!x || typeof x !== 'object') return false;
  const c = x as Record<string, unknown>;
  if (typeof c.main !== 'string' || c.main.length === 0 || c.main.length > 64) return false;
  if (!Array.isArray(c.subs)) return false;
  for (const s of c.subs) {
    if (typeof s !== 'string' || s.length === 0 || s.length > 64) return false;
  }
  return true;
}

function validateCategorySchema(x: unknown): CategoryItem[] | null {
  if (!Array.isArray(x) || x.length === 0 || x.length > 32) return null;
  const valid: CategoryItem[] = [];
  for (const item of x) {
    if (!isValidCategoryItem(item)) return null;
    valid.push({ main: item.main, subs: [...item.subs] });
  }
  return valid;
}

export function loadCategories(): CategoryItem[] {
  if (typeof window === 'undefined') return DEFAULT_CATEGORIES;
  try {
    const raw = localStorage.getItem('inkpress-categories');
    if (!raw) return DEFAULT_CATEGORIES;
    const parsed = JSON.parse(raw);
    const valid = validateCategorySchema(parsed);
    if (!valid) {
      // Corrupt or attacker-injected payload — purge and fall back.
      console.warn('[inkpress] inkpress-categories failed schema validation, falling back to defaults');
      localStorage.removeItem('inkpress-categories');
      return DEFAULT_CATEGORIES;
    }
    return valid;
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

export function saveCategories(cats: CategoryItem[]) {
  // Validate-on-write so we never persist garbage that loadCategories will
  // later reject. Cap names at 32 bytes UTF-8 on codepoint boundaries.
  const valid = validateCategorySchema(cats);
  if (!valid) throw new Error('Invalid category schema');
  const clamped = valid.map((c) => ({
    main: clampUtf8Bytes(c.main, TAG_BYTE_LIMIT * 2),
    subs: c.subs.map((s) => clampUtf8Bytes(s, TAG_BYTE_LIMIT)),
  }));
  localStorage.setItem('inkpress-categories', JSON.stringify(clamped));
}

// Contract enforces 32-byte limit on each tag. Use codepoint-safe UTF-8
// clamp (PAI-0035) so emoji/CJK never get sliced mid-character.
export function getAllTags(cats: CategoryItem[]): string[] {
  const tags: string[] = [];
  for (const c of cats) {
    for (const s of c.subs) {
      const tag = clampUtf8Bytes(s, TAG_BYTE_LIMIT);
      if (!tags.includes(tag)) tags.push(tag);
    }
  }
  return tags;
}

// Returns {value, label} where value is the stored tag (sub) and label is "Main - Sub"
export function getAllTagOptions(cats: CategoryItem[]): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const c of cats) {
    for (const s of c.subs) {
      const value = clampUtf8Bytes(s, TAG_BYTE_LIMIT);
      if (seen.has(value)) continue;
      seen.add(value);
      opts.push({ value, label: `${c.main} - ${s}` });
    }
  }
  return opts;
}

// Matches BaseBlog.sol Article struct exactly. Field names are kept as-is to mirror the
// deployed contract ABI (0x7A0bB0C37a934b3858436E61838719a5a7F63720).
// Note: `walrusBlobId` / `coverImageBlobId` are legacy names from the pre-launch Walrus design;
// storage was migrated to Cloudflare R2 before mainnet. The strings now hold an R2 URL or blob id,
// not a Walrus blob id. Renaming would diverge from the on-chain ABI.
const ARTICLE_TUPLE = [
  { name: 'walrusBlobId', type: 'string' },
  { name: 'title', type: 'string' },
  { name: 'description', type: 'string' },
  { name: 'coverImageBlobId', type: 'string' },
  { name: 'author', type: 'address' },
  { name: 'totalMinted', type: 'uint256' },
  { name: 'publishedAt', type: 'uint256' },
  { name: 'active', type: 'bool' },
  { name: 'tags', type: 'string[]' },
] as const;

export const INKPRESS_ABI = [
  {
    name: 'publishArticle',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'walrusBlobId', type: 'string' },
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'coverImageBlobId', type: 'string' },
      { name: 'tags', type: 'string[]' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getArticles',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    outputs: [
      { name: 'result', type: 'tuple[]', components: ARTICLE_TUPLE },
      { name: 'total', type: 'uint256' },
    ],
  },
  {
    name: 'getArticle',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'articleId', type: 'uint256' }],
    outputs: [{ name: '', type: 'tuple', components: ARTICLE_TUPLE }],
  },
  {
    name: 'getActiveArticleCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'nextArticleId',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'unpublishArticle',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'articleId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'republishArticle',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'articleId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'mintArticle',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'articleId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'mintPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'hasMinted',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'articleId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'approvedAuthors',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;
