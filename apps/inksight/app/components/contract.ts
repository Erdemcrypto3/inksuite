export const INKPOLL_ADDRESS = '0x5ce45f8A28FffFf7A94390DE048610ff4146ff3c' as const;

export const CATEGORIES = [
  'DeFi', 'NFTs', 'Gaming', 'DAOs', 'Infrastructure', 'Social', 'Trading', 'Other',
] as const;

export type CategoryName = (typeof CATEGORIES)[number];

// Convert category indices to bitmask
export function categoriesToMask(indices: number[]): number {
  return indices.reduce((mask, i) => mask | (1 << i), 0);
}

// Convert bitmask to category indices
export function maskToCategories(mask: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < CATEGORIES.length; i++) {
    if (mask & (1 << i)) result.push(i);
  }
  return result;
}

export const INKPOLL_ABI = [
  // ── User Functions ──
  { type: 'function', name: 'register', inputs: [{ name: '_categoryMask', type: 'uint32' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'updateCategories', inputs: [{ name: '_categoryMask', type: 'uint32' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'respond', inputs: [{ name: '_pollId', type: 'uint256' }, { name: '_optionIndex', type: 'uint8' }], outputs: [], stateMutability: 'nonpayable' },

  // ── Sender Functions ──
  { type: 'function', name: 'getAudienceSize', inputs: [{ name: '_categoryMask', type: 'uint32' }], outputs: [{ name: 'count', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'getPrice', inputs: [{ name: '_audienceSize', type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'submitPoll', inputs: [{ name: '_contentCID', type: 'string' }, { name: '_options', type: 'string[]' }, { name: '_deadline', type: 'uint256' }, { name: '_targetCategory', type: 'uint32' }], outputs: [{ name: 'pollId', type: 'uint256' }], stateMutability: 'nonpayable' },

  // ── Admin Functions ──
  { type: 'function', name: 'approvePoll', inputs: [{ name: '_pollId', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'rejectPoll', inputs: [{ name: '_pollId', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'closePoll', inputs: [{ name: '_pollId', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'setPricing', inputs: [{ name: '_maxAudience', type: 'uint256[]' }, { name: '_prices', type: 'uint256[]' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'addCategory', inputs: [{ name: '_name', type: 'string' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'verifySender', inputs: [{ name: '_sender', type: 'address' }], outputs: [], stateMutability: 'nonpayable' },

  // ── Owner Functions ──
  { type: 'function', name: 'addAdmin', inputs: [{ name: '_admin', type: 'address' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'removeAdmin', inputs: [{ name: '_admin', type: 'address' }], outputs: [], stateMutability: 'nonpayable' },

  // ── View Functions ──
  { type: 'function', name: 'users', inputs: [{ name: '', type: 'address' }], outputs: [{ name: 'registered', type: 'bool' }, { name: 'points', type: 'uint256' }, { name: 'streak', type: 'uint256' }, { name: 'lastResponseTime', type: 'uint256' }, { name: 'categoryMask', type: 'uint32' }, { name: 'registeredAt', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'polls', inputs: [{ name: '', type: 'uint256' }], outputs: [{ name: 'sender', type: 'address' }, { name: 'contentCID', type: 'string' }, { name: 'targetCategory', type: 'uint32' }, { name: 'deadline', type: 'uint256' }, { name: 'createdAt', type: 'uint256' }, { name: 'status', type: 'uint8' }, { name: 'totalResponses', type: 'uint256' }, { name: 'payment', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'responses', inputs: [{ name: '', type: 'uint256' }, { name: '', type: 'address' }], outputs: [{ type: 'uint8' }], stateMutability: 'view' },
  { type: 'function', name: 'optionVotes', inputs: [{ name: '', type: 'uint256' }, { name: '', type: 'uint8' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'getActivePolls', inputs: [{ name: '_user', type: 'address' }], outputs: [{ type: 'uint256[]' }], stateMutability: 'view' },
  { type: 'function', name: 'getPollOptions', inputs: [{ name: '_pollId', type: 'uint256' }], outputs: [{ type: 'string[]' }], stateMutability: 'view' },
  { type: 'function', name: 'getPollResults', inputs: [{ name: '_pollId', type: 'uint256' }], outputs: [{ type: 'uint256[]' }], stateMutability: 'view' },
  { type: 'function', name: 'getRegisteredUsers', inputs: [{ name: '_categoryMask', type: 'uint32' }], outputs: [{ type: 'address[]' }], stateMutability: 'view' },
  { type: 'function', name: 'getTotalUsers', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'getTotalPolls', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'getAllCategories', inputs: [], outputs: [{ type: 'string[]' }], stateMutability: 'view' },
  { type: 'function', name: 'getLeaderboard', inputs: [{ name: '_limit', type: 'uint256' }], outputs: [{ type: 'address[]' }, { type: 'uint256[]' }], stateMutability: 'view' },
  { type: 'function', name: 'admins', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'bool' }], stateMutability: 'view' },
  { type: 'function', name: 'owner', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'verifiedSenders', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'bool' }], stateMutability: 'view' },
  { type: 'function', name: 'treasury', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },

  // ── Events ──
  { type: 'event', name: 'UserRegistered', inputs: [{ name: 'user', type: 'address', indexed: true }, { name: 'categoryMask', type: 'uint32', indexed: false }] },
  { type: 'event', name: 'CategoriesUpdated', inputs: [{ name: 'user', type: 'address', indexed: true }, { name: 'categoryMask', type: 'uint32', indexed: false }] },
  { type: 'event', name: 'PollSubmitted', inputs: [{ name: 'pollId', type: 'uint256', indexed: true }, { name: 'sender', type: 'address', indexed: true }, { name: 'targetCategory', type: 'uint32', indexed: false }, { name: 'deadline', type: 'uint256', indexed: false }] },
  { type: 'event', name: 'PollApproved', inputs: [{ name: 'pollId', type: 'uint256', indexed: true }] },
  { type: 'event', name: 'PollRejected', inputs: [{ name: 'pollId', type: 'uint256', indexed: true }] },
  { type: 'event', name: 'PollResponse', inputs: [{ name: 'pollId', type: 'uint256', indexed: true }, { name: 'user', type: 'address', indexed: true }, { name: 'optionIndex', type: 'uint8', indexed: false }] },
  { type: 'event', name: 'PointsAwarded', inputs: [{ name: 'user', type: 'address', indexed: true }, { name: 'amount', type: 'uint256', indexed: false }, { name: 'total', type: 'uint256', indexed: false }] },
] as const;
