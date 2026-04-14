'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  InkWalletProvider,
  ConnectButton,
  useAccount,
  useWriteContract,
  useReadContract,
  useWaitForTransactionReceipt,
} from '@inksuite/wallet';
import { INKPOLL_ADDRESS, INKPOLL_ABI, CATEGORIES, categoriesToMask, maskToCategories } from './components/contract';

function getDeactivated(): number[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('inksight-deactivated-cats') || '[]'); } catch { return []; }
}

function isCategoryActive(index: number): boolean {
  return !getDeactivated().includes(index);
}

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

type Tab = 'inbox' | 'register' | 'send' | 'admin' | 'leaderboard';

interface UserProfile {
  registered: boolean;
  points: bigint;
  streak: bigint;
  categoryMask: number;
}

interface PollData {
  id: number;
  sender: string;
  contentCID: string;
  targetCategory: number;
  deadline: bigint;
  createdAt: bigint;
  status: number;
  totalResponses: bigint;
  payment: bigint;
  options: string[];
}

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

function TimeLeft({ deadline }: { deadline: bigint }) {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (deadline <= now) return <span className="text-red-500 font-medium">Ended</span>;
  const diff = Number(deadline - now);
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  if (days > 0) return <span className="text-ink-500 font-medium">{days}d {hours}h left</span>;
  const mins = Math.floor((diff % 3600) / 60);
  return <span className="text-orange-500 font-medium">{hours}h {mins}m left</span>;
}

function CategoryBadges({ mask }: { mask: number }) {
  const indices = maskToCategories(mask);
  return (
    <div className="flex flex-wrap gap-1.5">
      {indices.map((i) => (
        <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-ink-100 text-ink-700 font-medium">
          {CATEGORIES[i]}
        </span>
      ))}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl ring-1 ring-inset ring-purple-100 p-4 text-center">
      <div className="text-2xl font-bold text-ink-600">{value}</div>
      <div className="text-xs text-ink-400 mt-1">{label}</div>
    </div>
  );
}

function Addr({ address: a }: { address: string }) {
  return <span className="font-mono text-xs">{a.slice(0, 6)}...{a.slice(-4)}</span>;
}

// ═══════════════════════════════════════════════════════════
// Registration
// ═══════════════════════════════════════════════════════════

function RegisterPanel({ user, onRegistered }: { user: UserProfile | null; onRegistered: () => void }) {
  const [selected, setSelected] = useState<number[]>([]);
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (user?.registered) {
      setSelected(maskToCategories(user.categoryMask));
    }
  }, [user]);

  useEffect(() => { if (isSuccess) onRegistered(); }, [isSuccess, onRegistered]);

  const toggle = (i: number) => {
    setSelected((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]);
  };

  const submit = () => {
    if (selected.length === 0) return;
    const mask = categoriesToMask(selected);
    const fn = user?.registered ? 'updateCategories' : 'register';
    writeContract({ address: INKPOLL_ADDRESS, abi: INKPOLL_ABI, functionName: fn, args: [mask] });
  };

  return (
    <div className="bg-white rounded-xl ring-1 ring-inset ring-purple-100 p-6 shadow-sm max-w-lg mx-auto">
      <h2 className="text-xl font-bold mb-1">
        {user?.registered ? 'Update Your Interests' : 'Register to Earn Points'}
      </h2>
      <p className="text-sm text-ink-400 mb-4">
        Select the categories you want to receive polls for. Earn points for every response.
      </p>
      <div className="grid grid-cols-2 gap-2 mb-5">
        {CATEGORIES.map((cat, i) => !isCategoryActive(i) ? null : (
          <button
            key={cat}
            onClick={() => toggle(i)}
            className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              selected.includes(i)
                ? 'bg-ink-500 text-white ring-2 ring-ink-300'
                : 'bg-ink-50 text-ink-600 hover:bg-ink-100'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
      <button
        onClick={submit}
        disabled={isPending || selected.length === 0}
        className="w-full py-3 rounded-xl bg-ink-500 text-white font-semibold hover:bg-ink-600 disabled:opacity-50 transition-all"
      >
        {isPending ? 'Confirming...' : user?.registered ? 'Update Categories' : 'Register (+50 points)'}
      </button>
      {user?.registered && (
        <p className="text-center text-xs text-ink-400 mt-3">
          Your points: <span className="font-bold text-ink-600">{user.points.toString()}</span> |
          Streak: <span className="font-bold text-ink-600">{user.streak.toString()}</span>
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Poll Card (Inbox)
// ═══════════════════════════════════════════════════════════

function PollCard({ poll, userResponse, results, onRespond, isPending }: {
  poll: PollData;
  userResponse: number; // 0 = not responded, otherwise optionIndex + 1
  results: bigint[];
  onRespond: (pollId: number, optionIndex: number) => void;
  isPending: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const responded = userResponse > 0;
  const respondedOption = userResponse - 1;
  const now = BigInt(Math.floor(Date.now() / 1000));
  const expired = poll.deadline <= now;
  const totalVotes = Number(poll.totalResponses);

  return (
    <div className="bg-white rounded-xl ring-1 ring-inset ring-purple-100 p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full ${responded ? 'bg-green-400' : expired ? 'bg-red-400' : 'bg-ink-400'}`} />
            <span className="text-xs text-ink-400">Poll #{poll.id}</span>
            <Addr address={poll.sender} />
          </div>
          <CategoryBadges mask={poll.targetCategory} />
        </div>
        <TimeLeft deadline={poll.deadline} />
      </div>

      <p className="text-sm text-ink-700 mb-4 font-medium">{poll.contentCID}</p>

      <div className="space-y-2 mb-4">
        {poll.options.map((opt, i) => {
          const isSelected = responded ? respondedOption === i : selected === i;
          const votes = results.length > i ? Number(results[i]) : 0;
          const pct = totalVotes > 0 && responded ? Math.round((votes / totalVotes) * 100) : 0;

          return (
            <button
              key={i}
              onClick={() => !responded && !expired && setSelected(i)}
              disabled={responded || expired}
              className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all relative overflow-hidden ${
                isSelected
                  ? 'bg-ink-500 text-white ring-2 ring-ink-300'
                  : responded
                  ? 'bg-gray-50 text-gray-500'
                  : 'bg-ink-50 text-ink-700 hover:bg-ink-100 cursor-pointer'
              }`}
            >
              {responded && (
                <div className="absolute inset-y-0 left-0 bg-ink-200 opacity-30" style={{ width: `${pct}%` }} />
              )}
              <span className="relative flex justify-between">
                <span>{opt}</span>
                {responded && <span className="text-xs opacity-70">{votes} ({pct}%)</span>}
              </span>
            </button>
          );
        })}
      </div>

      {!responded && !expired && (
        <button
          onClick={() => selected !== null && onRespond(poll.id, selected)}
          disabled={selected === null || isPending}
          className="w-full py-2.5 rounded-xl bg-ink-500 text-white font-semibold hover:bg-ink-600 disabled:opacity-50 text-sm transition-all"
        >
          {isPending ? 'Submitting...' : 'Submit Response (+10 pts)'}
        </button>
      )}
      {responded && (
        <div className="text-center text-xs text-green-600 font-medium">Responded — points earned</div>
      )}
      {expired && !responded && (
        <div className="text-center text-xs text-red-500 font-medium">Deadline passed</div>
      )}

      <div className="flex justify-between text-xs text-ink-400 mt-3 pt-3 border-t border-purple-50">
        <span>{poll.totalResponses.toString()} responses</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Inbox Poll Loader — loads poll data then renders PollCard
// ═══════════════════════════════════════════════════════════

function InboxPollLoader({ pollId, address, onRespond, isPending }: {
  pollId: number; address: string;
  onRespond: (pollId: number, optionIndex: number) => void;
  isPending: boolean;
}) {
  const { data: pollData } = useReadContract({
    address: INKPOLL_ADDRESS, abi: INKPOLL_ABI,
    functionName: 'polls', args: [BigInt(pollId)],
  });
  const { data: options } = useReadContract({
    address: INKPOLL_ADDRESS, abi: INKPOLL_ABI,
    functionName: 'getPollOptions', args: [BigInt(pollId)],
  });
  const { data: userResponse } = useReadContract({
    address: INKPOLL_ADDRESS, abi: INKPOLL_ABI,
    functionName: 'responses', args: [BigInt(pollId), address as `0x${string}`],
  });
  const { data: results } = useReadContract({
    address: INKPOLL_ADDRESS, abi: INKPOLL_ABI,
    functionName: 'getPollResults', args: [BigInt(pollId)],
  });

  if (!pollData || !options) return <div className="bg-white rounded-xl p-4 animate-pulse h-32" />;

  const p = pollData as [string, string, number, bigint, bigint, number, bigint, bigint];
  const poll: PollData = {
    id: pollId,
    sender: p[0], contentCID: p[1], targetCategory: p[2],
    deadline: p[3], createdAt: p[4], status: p[5],
    totalResponses: p[6], payment: p[7],
    options: options as string[],
  };

  return (
    <PollCard
      poll={poll}
      userResponse={Number(userResponse ?? 0)}
      results={(results as bigint[]) ?? []}
      onRespond={onRespond}
      isPending={isPending}
    />
  );
}

// ═══════════════════════════════════════════════════════════
// Inbox
// ═══════════════════════════════════════════════════════════

function InboxPanel({ address }: { address: string }) {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  // Get active polls matching user's categories
  const { data: pollIds, refetch } = useReadContract({
    address: INKPOLL_ADDRESS, abi: INKPOLL_ABI,
    functionName: 'getActivePolls', args: [address as `0x${string}`],
  });

  useEffect(() => { if (isSuccess) refetch(); }, [isSuccess, refetch]);

  const handleRespond = (pollId: number, optionIndex: number) => {
    writeContract({
      address: INKPOLL_ADDRESS, abi: INKPOLL_ABI,
      functionName: 'respond', args: [BigInt(pollId), optionIndex],
    });
  };

  const ids = (pollIds as bigint[]) || [];

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-xl font-bold mb-4">
        My Inbox <span className="text-ink-400 text-sm font-normal">({ids.length} polls)</span>
      </h2>
      {ids.length === 0 ? (
        <div className="bg-white rounded-xl ring-1 ring-inset ring-purple-100 p-8 text-center">
          <p className="text-ink-400">No polls matching your categories yet. Check back soon!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {ids.map((id) => (
            <InboxPollLoader
              key={id.toString()}
              pollId={Number(id)}
              address={address}
              onRespond={handleRespond}
              isPending={isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Send Poll (Sender)
// ═══════════════════════════════════════════════════════════

function SendPanel() {
  const [contentCID, setContentCID] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [selectedCats, setSelectedCats] = useState<number[]>([]);
  const [deadlineDays, setDeadlineDays] = useState(7);
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  const mask = categoriesToMask(selectedCats);

  const { data: audienceSize } = useReadContract({
    address: INKPOLL_ADDRESS, abi: INKPOLL_ABI,
    functionName: 'getAudienceSize', args: [mask],
    query: { enabled: mask > 0 },
  });

  const { data: price } = useReadContract({
    address: INKPOLL_ADDRESS, abi: INKPOLL_ABI,
    functionName: 'getPrice', args: [audienceSize ?? BigInt(0)],
    query: { enabled: audienceSize !== undefined },
  });

  const toggleCat = (i: number) => {
    setSelectedCats((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]);
  };

  const addOption = () => { if (options.length < 10) setOptions([...options, '']); };
  const removeOption = (i: number) => { if (options.length > 2) setOptions(options.filter((_, idx) => idx !== i)); };
  const updateOption = (i: number, val: string) => {
    const next = [...options];
    next[i] = val;
    setOptions(next);
  };

  const submit = () => {
    const validOptions = options.filter((o) => o.trim());
    if (validOptions.length < 2 || !contentCID.trim() || mask === 0) return;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineDays * 86400);
    writeContract({
      address: INKPOLL_ADDRESS, abi: INKPOLL_ABI,
      functionName: 'submitPoll',
      args: [contentCID, validOptions, deadline, mask],
    });
  };

  return (
    <div className="bg-white rounded-xl ring-1 ring-inset ring-purple-100 p-6 shadow-sm max-w-lg mx-auto">
      <h2 className="text-xl font-bold mb-1">Submit a Poll</h2>
      <p className="text-sm text-ink-400 mb-5">
        Reach categorized wallet holders on Ink. Pay in USDC.
      </p>

      {isSuccess && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm font-medium">
          Poll submitted! It will be reviewed by an admin.
        </div>
      )}

      <label className="block text-sm font-medium text-ink-600 mb-1">Your Question</label>
      <input
        value={contentCID} onChange={(e) => setContentCID(e.target.value)}
        placeholder="What do you want to ask the community?"
        className="w-full px-3 py-2 rounded-lg bg-ink-50 ring-1 ring-inset ring-purple-100 text-sm mb-4 focus:outline-none focus:ring-ink-300"
      />

      <label className="block text-sm font-medium text-ink-600 mb-1">Response Options</label>
      <div className="space-y-2 mb-4">
        {options.map((opt, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={opt} onChange={(e) => updateOption(i, e.target.value)}
              placeholder={`Option ${i + 1}`}
              className="flex-1 px-3 py-2 rounded-lg bg-ink-50 ring-1 ring-inset ring-purple-100 text-sm focus:outline-none focus:ring-ink-300"
            />
            {options.length > 2 && (
              <button onClick={() => removeOption(i)} className="px-2 text-red-400 hover:text-red-600 text-lg">&times;</button>
            )}
          </div>
        ))}
        {options.length < 10 && (
          <button onClick={addOption} className="text-sm text-ink-500 hover:text-ink-600 font-medium">+ Add option</button>
        )}
      </div>

      <label className="block text-sm font-medium text-ink-600 mb-1">Target Categories</label>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {CATEGORIES.map((cat, i) => (
          <button key={cat} onClick={() => toggleCat(i)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedCats.includes(i) ? 'bg-ink-500 text-white' : 'bg-ink-50 text-ink-600 hover:bg-ink-100'
            }`}
          >{cat}</button>
        ))}
      </div>

      <label className="block text-sm font-medium text-ink-600 mb-1">Deadline</label>
      <select
        value={deadlineDays} onChange={(e) => setDeadlineDays(Number(e.target.value))}
        className="w-full px-3 py-2 rounded-lg bg-ink-50 ring-1 ring-inset ring-purple-100 text-sm mb-5 focus:outline-none"
      >
        <option value={3}>3 days</option>
        <option value={7}>7 days</option>
        <option value={14}>14 days</option>
        <option value={30}>30 days</option>
      </select>

      {mask > 0 && (
        <div className="bg-ink-50 rounded-lg p-4 mb-5 text-sm">
          <div className="flex justify-between mb-1">
            <span className="text-ink-400">Matching audience:</span>
            <span className="font-bold text-ink-700">{audienceSize?.toString() ?? '...'} wallets</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-400">Price:</span>
            <span className="font-bold text-ink-700">
              {price ? `${(Number(price) / 1e6).toFixed(0)} USDC` : '...'}
            </span>
          </div>
        </div>
      )}

      <button
        onClick={submit}
        disabled={isPending || options.filter((o) => o.trim()).length < 2 || !contentCID.trim() || mask === 0}
        className="w-full py-3 rounded-xl bg-ink-500 text-white font-semibold hover:bg-ink-600 disabled:opacity-50 transition-all"
      >
        {isPending ? 'Submitting...' : 'Pay & Submit Poll'}
      </button>
      <p className="text-xs text-ink-400 text-center mt-2">
        You must approve USDC spending before submitting.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Admin Panel
// ═══════════════════════════════════════════════════════════

function AdminPanel({ address }: { address: string }) {
  const [generateInput, setGenerateInput] = useState('');

  const { data: isAdmin } = useReadContract({
    address: INKPOLL_ADDRESS, abi: INKPOLL_ABI,
    functionName: 'admins', args: [address as `0x${string}`],
  });
  const { data: ownerAddr } = useReadContract({
    address: INKPOLL_ADDRESS, abi: INKPOLL_ABI,
    functionName: 'owner',
  });
  const { data: totalPolls } = useReadContract({
    address: INKPOLL_ADDRESS, abi: INKPOLL_ABI,
    functionName: 'getTotalPolls',
  });
  const { data: totalUsers } = useReadContract({
    address: INKPOLL_ADDRESS, abi: INKPOLL_ABI,
    functionName: 'getTotalUsers',
  });

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  // Read on-chain categories (must be before any conditional return — React hooks rules)
  const { data: onChainCategories } = useReadContract({
    address: INKPOLL_ADDRESS, abi: INKPOLL_ABI,
    functionName: 'getAllCategories',
  });
  const [newCatName, setNewCatName] = useState('');
  const [deactivated, setDeactivated] = useState<number[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('inksight-deactivated-cats') || '[]'); } catch { return []; }
  });

  const saveDeactivated = (list: number[]) => {
    setDeactivated(list);
    localStorage.setItem('inksight-deactivated-cats', JSON.stringify(list));
  };

  const toggleDeactivate = (index: number) => {
    const list = deactivated.includes(index)
      ? deactivated.filter((i) => i !== index)
      : [...deactivated, index];
    saveDeactivated(list);
  };

  const authorized = isAdmin || (ownerAddr as string)?.toLowerCase() === address.toLowerCase();

  if (!authorized) {
    return (
      <div className="bg-white rounded-xl ring-1 ring-inset ring-purple-100 p-8 text-center max-w-lg mx-auto">
        <p className="text-ink-400">Admin access required.</p>
      </div>
    );
  }

  const categories = (onChainCategories as string[] | undefined) ?? [...CATEGORIES];

  const addCategoryOnChain = () => {
    if (!newCatName.trim()) return;
    writeContract({
      address: INKPOLL_ADDRESS, abi: INKPOLL_ABI,
      functionName: 'addCategory', args: [newCatName.trim()],
    });
    setNewCatName('');
  };

  const approve = (id: string) => {
    if (!id) return;
    writeContract({ address: INKPOLL_ADDRESS, abi: INKPOLL_ABI, functionName: 'approvePoll', args: [BigInt(id)] });
  };

  const reject = (id: string) => {
    if (!id) return;
    writeContract({ address: INKPOLL_ADDRESS, abi: INKPOLL_ABI, functionName: 'rejectPoll', args: [BigInt(id)] });
  };

  const closePoll = (id: string) => {
    if (!id) return;
    writeContract({ address: INKPOLL_ADDRESS, abi: INKPOLL_ABI, functionName: 'closePoll', args: [BigInt(id)] });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-xl font-bold">Admin Dashboard</h2>

      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Total Users" value={totalUsers?.toString() ?? '0'} />
        <StatCard label="Total Polls" value={totalPolls?.toString() ?? '0'} />
      </div>

      {isSuccess && (
        <div className="p-3 rounded-lg bg-green-50 text-green-700 text-sm font-medium">
          Transaction confirmed!
        </div>
      )}

      {/* Category Management */}
      <div className="bg-white rounded-xl ring-1 ring-inset ring-purple-100 p-5 shadow-sm">
        <h3 className="font-bold mb-3">Categories ({categories.length})</h3>
        <p className="text-xs text-ink-400 mb-3">On-chain categories. Users select these during registration. Polls target specific categories.</p>
        <div className="space-y-2 mb-4">
          {categories.map((cat, i) => {
            const mask = 1 << i;
            const isDeactivated = deactivated.includes(i);
            return (
              <CategoryRow key={i} index={i} name={cat} mask={mask}
                isDeactivated={isDeactivated}
                onToggle={() => toggleDeactivate(i)} />
            );
          })}
        </div>
        <div className="flex gap-2">
          <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
            placeholder="New category name..."
            className="flex-1 px-3 py-2 rounded-lg bg-ink-50 ring-1 ring-inset ring-purple-100 text-sm focus:outline-none"
            onKeyDown={(e) => e.key === 'Enter' && addCategoryOnChain()} />
          <button onClick={addCategoryOnChain} disabled={isPending || !newCatName.trim()}
            className="px-4 py-2 rounded-lg bg-ink-500 text-white text-sm font-medium hover:bg-ink-600 disabled:opacity-50">
            Add Category
          </button>
        </div>
        <p className="mt-2 text-[10px] text-ink-400">Adding a category requires an on-chain transaction. Categories cannot be removed once added.</p>
      </div>

      {/* Poll Actions */}
      <div className="bg-white rounded-xl ring-1 ring-inset ring-purple-100 p-5 shadow-sm">
        <h3 className="font-bold mb-3">Poll Actions</h3>
        <label className="text-xs font-medium text-ink-400 block mb-1">Poll ID</label>
        <input
          type="number"
          value={generateInput}
          onChange={(e) => setGenerateInput(e.target.value)}
          placeholder="Enter poll ID"
          className="w-full px-3 py-2 rounded-lg bg-ink-50 ring-1 ring-inset ring-purple-100 text-sm mb-3 focus:outline-none"
        />
        <div className="flex gap-2">
          <button
            onClick={() => approve(generateInput)}
            disabled={isPending || !generateInput}
            className="flex-1 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50"
          >Approve</button>
          <button
            onClick={() => reject(generateInput)}
            disabled={isPending || !generateInput}
            className="flex-1 py-2.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50"
          >Reject (Refund)</button>
          <button
            onClick={() => closePoll(generateInput)}
            disabled={isPending || !generateInput}
            className="flex-1 py-2.5 rounded-lg bg-ink-500 text-white text-sm font-medium hover:bg-ink-600 disabled:opacity-50"
          >Close</button>
        </div>
      </div>

      {isPending && (
        <div className="fixed bottom-4 right-4 bg-ink-500 text-white px-4 py-2 rounded-lg text-sm shadow-lg">
          Transaction pending...
        </div>
      )}
    </div>
  );
}

function CategoryRow({ index, name, mask, isDeactivated, onToggle }: { index: number; name: string; mask: number; isDeactivated: boolean; onToggle: () => void }) {
  const { data: audienceSize } = useReadContract({
    address: INKPOLL_ADDRESS, abi: INKPOLL_ABI,
    functionName: 'getAudienceSize', args: [mask],
  });
  const count = Number(audienceSize ?? 0);

  return (
    <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${isDeactivated ? 'bg-red-50 opacity-60' : 'bg-ink-50'}`}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-ink-700">{name}</span>
        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[9px] font-mono text-ink-500">bit {index}</span>
        {isDeactivated && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-semibold text-red-700">Hidden</span>}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-ink-500">{count} users</span>
        <button onClick={onToggle}
          className={`rounded-lg px-2 py-1 text-[10px] font-semibold ring-1 ring-inset ${isDeactivated ? 'text-emerald-700 ring-emerald-200 hover:bg-emerald-50' : 'text-red-600 ring-red-200 hover:bg-red-50'}`}>
          {isDeactivated ? 'Activate' : 'Deactivate'}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Leaderboard
// ═══════════════════════════════════════════════════════════

function LeaderboardPanel() {
  const { data } = useReadContract({
    address: INKPOLL_ADDRESS, abi: INKPOLL_ABI,
    functionName: 'getLeaderboard', args: [BigInt(20)],
  });

  const [addresses, points] = (data as [string[], bigint[]] | undefined) ?? [[], []];

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-xl font-bold mb-4">Leaderboard</h2>
      <p className="text-sm text-ink-400 mb-4">
        Top point earners. Points are soulbound and non-transferable.
        Future $INKSIGHT token airdrop will be based on your share of total points.
      </p>
      <div className="bg-white rounded-xl ring-1 ring-inset ring-purple-100 shadow-sm overflow-hidden">
        {addresses.length === 0 ? (
          <div className="p-8 text-center text-ink-400">No users yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ink-50 text-ink-400 text-xs">
                <th className="py-2 px-4 text-left">#</th>
                <th className="py-2 px-4 text-left">Wallet</th>
                <th className="py-2 px-4 text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {addresses.map((addr, i) => (
                <tr key={addr} className="border-t border-purple-50 hover:bg-ink-50/50">
                  <td className="py-3 px-4 font-bold text-ink-500">{i + 1}</td>
                  <td className="py-3 px-4 font-mono text-xs">{addr}</td>
                  <td className="py-3 px-4 text-right font-bold text-ink-600">{points[i].toString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Main App
// ═══════════════════════════════════════════════════════════

function InkPollApp() {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<Tab>('inbox');

  const { data: userData, refetch: refetchUser } = useReadContract({
    address: INKPOLL_ADDRESS, abi: INKPOLL_ABI,
    functionName: 'users', args: [address as `0x${string}`],
    query: { enabled: !!address },
  });

  const user: UserProfile | null = userData
    ? {
        registered: (userData as [boolean, bigint, bigint, bigint, number, bigint])[0],
        points: (userData as [boolean, bigint, bigint, bigint, number, bigint])[1],
        streak: (userData as [boolean, bigint, bigint, bigint, number, bigint])[2],
        categoryMask: (userData as [boolean, bigint, bigint, bigint, number, bigint])[4],
      }
    : null;

  const handleRegistered = useCallback(() => refetchUser(), [refetchUser]);

  useEffect(() => {
    if (user && !user.registered && tab === 'inbox') setTab('register');
  }, [user, tab]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'inbox', label: 'Inbox' },
    { id: 'register', label: user?.registered ? 'Profile' : 'Register' },
    { id: 'send', label: 'Send Poll' },
    { id: 'leaderboard', label: 'Leaderboard' },
    { id: 'admin', label: 'Admin' },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-purple-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="https://inksuite.xyz" className="inline-flex items-center gap-1 rounded-lg bg-purple-100 px-3 py-1.5 text-xs font-semibold text-ink-700 ring-1 ring-inset ring-purple-200 hover:bg-purple-200 hover:text-ink-900">← inksuite.xyz</a>
            <h1 className="text-lg font-bold text-ink-700">InkSight</h1>
            {user?.registered && (
              <span className="text-xs bg-ink-100 text-ink-600 px-2 py-0.5 rounded-full font-medium">
                {user.points.toString()} pts
              </span>
            )}
          </div>
          <ConnectButton />
        </div>
      </header>

      {!isConnected ? (
        <div className="max-w-lg mx-auto mt-20 text-center px-4">
          <h2 className="text-3xl font-bold text-ink-700 mb-3">InkSight</h2>
          <p className="text-ink-400 mb-2">Community insight platform for Ink L2</p>
          <p className="text-sm text-ink-300 mb-8">
            Projects pay to ask questions. You earn points for answering.
            Points convert to $INKSIGHT token airdrop.
          </p>
          <div className="grid grid-cols-3 gap-4 mb-8">
            <StatCard label="Register" value="1" />
            <StatCard label="Answer Polls" value="2" />
            <StatCard label="Earn Points" value="3" />
          </div>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </div>
      ) : (
        <>
          {/* Tab Navigation */}
          <nav className="max-w-4xl mx-auto px-4 pt-4">
            <div className="flex gap-1 bg-white rounded-xl ring-1 ring-inset ring-purple-100 p-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    tab === t.id ? 'bg-ink-500 text-white shadow-sm' : 'text-ink-400 hover:text-ink-600 hover:bg-ink-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </nav>

          {/* Content */}
          <main className="max-w-4xl mx-auto px-4 py-6">
            {tab === 'inbox' && address && <InboxPanel address={address} />}
            {tab === 'register' && <RegisterPanel user={user} onRegistered={handleRegistered} />}
            {tab === 'send' && <SendPanel />}
            {tab === 'leaderboard' && <LeaderboardPanel />}
            {tab === 'admin' && address && <AdminPanel address={address} />}
          </main>
        </>
      )}

      {/* Footer */}
      <footer className="mt-auto py-6 text-center text-xs text-ink-300">
        <a href="https://inksuite.xyz" className="hover:text-ink-500">Ink Suite</a>
        {' '}&middot;{' '}Built on Ink L2
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Export with Provider
// ═══════════════════════════════════════════════════════════

export default function Page() {
  return (
    <InkWalletProvider>
      <InkPollApp />
    </InkWalletProvider>
  );
}
