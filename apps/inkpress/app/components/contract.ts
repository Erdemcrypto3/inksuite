// InkPress contract config — same ABI as BasePress (BaseBlog.sol), deployed on Ink
// Update CONTRACT_ADDRESS once deployed to Ink mainnet

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

// Minimal ABI for read/write operations
export const INKPRESS_ABI = [
  {
    name: 'getArticles',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'author', type: 'address' },
          { name: 'title', type: 'string' },
          { name: 'contentBlobId', type: 'string' },
          { name: 'tag', type: 'string' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'mintPrice', type: 'uint256' },
          { name: 'totalMinted', type: 'uint256' },
          { name: 'isActive', type: 'bool' },
        ],
      },
    ],
  },
  {
    name: 'getArticle',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'articleId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'author', type: 'address' },
          { name: 'title', type: 'string' },
          { name: 'contentBlobId', type: 'string' },
          { name: 'tag', type: 'string' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'mintPrice', type: 'uint256' },
          { name: 'totalMinted', type: 'uint256' },
          { name: 'isActive', type: 'bool' },
        ],
      },
    ],
  },
  {
    name: 'totalArticles',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'publishArticle',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'title', type: 'string' },
      { name: 'contentBlobId', type: 'string' },
      { name: 'tag', type: 'string' },
      { name: 'mintPrice', type: 'uint256' },
    ],
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
    name: 'hasMinted',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
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
