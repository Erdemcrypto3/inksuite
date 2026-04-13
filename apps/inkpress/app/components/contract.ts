export const CONTRACT_ADDRESS = '0x7A0bB0C37a934b3858436E61838719a5a7F63720' as const;

export const WALRUS_AGGREGATOR = 'https://walrus-mainnet.chainode.tech:9002';
export const WALRUS_UPLOAD_PROXY = 'https://api.inksuite.xyz/walrus-upload';

export const BLOG_TAGS = [
  'Tech/Web3',
  'DeFi',
  'NFTs',
  'Ink Ecosystem',
  'Tutorials',
  'Opinion',
  'News',
] as const;

// Matches BaseBlog.sol Article struct exactly:
// walrusBlobId, title, description, coverImageBlobId, author, totalMinted, publishedAt, active, tags[]
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
