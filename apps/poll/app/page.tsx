'use client';

import { InkWalletProvider, ConnectButton, useAccount, useSendTransaction, useWaitForTransactionReceipt } from '@inksuite/wallet';
import { useState, useEffect, useCallback } from 'react';
import { toHex } from 'viem';
import { BLOCKSCOUT_API_URL } from '@inksuite/chain';

// Poll contract — we use a dedicated "poll registry" address for calldata-based votes
// Votes are 0-value txs TO this address with calldata: inkpoll:<pollId>:<optionIndex>
const POLL_REGISTRY = '0x0000000000000000000000000000000000000001' as const;

type Poll = {
  id: string;
  question: string;
  options: string[];
  creator: string;
  createdAt: number;
};

type Vote = {
  voter: string;
  optionIndex: number;
  txHash: string;
};

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function loadPolls(): Poll[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem('inkpoll-polls') || '[]');
  } catch { return []; }
}

function savePolls(polls: Poll[]) {
  localStorage.setItem('inkpoll-polls', JSON.stringify(polls));
}

/* ── Create Poll ── */
function CreatePoll({ onCreated }: { onCreated: () => void }) {
  const { address } = useAccount();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  const addOption = () => {
    if (options.length < 6) setOptions([...options, '']);
  };

  const updateOption = (i: number, val: string) => {
    const copy = [...options];
    copy[i] = val;
    setOptions(copy);
  };

  const removeOption = (i: number) => {
    if (options.length > 2) setOptions(options.filter((_, idx) => idx !== i));
  };

  const handleCreate = () => {
    if (!question.trim() || options.filter((o) => o.trim()).length < 2 || !address) return;
    const poll: Poll = {
      id: generateId(),
      question: question.trim(),
      options: options.filter((o) => o.trim()),
      creator: address,
      createdAt: Date.now(),
    };
    const polls = loadPolls();
    polls.unshift(poll);
    savePolls(polls);
    setQuestion('');
    setOptions(['', '']);
    onCreated();
  };

  return (
    <div className="rounded-xl bg-white p-6 ring-1 ring-inset ring-purple-100 shadow-sm space-y-4">
      <h2 className="text-lg font-bold text-ink-900">Create a Poll</h2>
      <div>
        <label className="block text-xs font-semibold text-ink-600 mb-1">Question</label>
        <input
          value={question} onChange={(e) => setQuestion(e.target.value)}
          placeholder="What should we build next?"
          className="w-full rounded-lg border border-purple-200 bg-ink-50 px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 focus:border-ink-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-ink-600 mb-1">Options (2-6)</label>
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={opt} onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
                className="flex-1 rounded-lg border border-purple-200 bg-ink-50 px-4 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-ink-500 focus:outline-none"
              />
              {options.length > 2 && (
                <button onClick={() => removeOption(i)} className="px-2 text-ink-400 hover:text-red-500 text-lg">x</button>
              )}
            </div>
          ))}
        </div>
        {options.length < 6 && (
          <button onClick={addOption} className="mt-2 text-sm text-ink-500 hover:text-ink-600">+ Add option</button>
        )}
      </div>
      <button
        onClick={handleCreate}
        disabled={!question.trim() || options.filter((o) => o.trim()).length < 2 || !address}
        className="rounded-lg bg-ink-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-ink-600 disabled:opacity-50"
      >
        Create Poll
      </button>
      <p className="text-[10px] text-ink-400">Polls are stored locally. Votes are recorded on-chain.</p>
    </div>
  );
}

/* ── Poll Card with voting ── */
function PollCard({ poll }: { poll: Poll }) {
  const { address, isConnected } = useAccount();
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loadingVotes, setLoadingVotes] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [hasVoted, setHasVoted] = useState(false);

  const { sendTransaction, isPending } = useSendTransaction();
  const { isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  // Load votes from Blockscout
  useEffect(() => {
    setLoadingVotes(true);
    fetch(`${BLOCKSCOUT_API_URL}?module=account&action=txlist&address=${POLL_REGISTRY}&startblock=0&endblock=latest&sort=desc`)
      .then((r) => r.json())
      .then((data) => {
        if (data.status !== '1' || !Array.isArray(data.result)) { setVotes([]); return; }
        const pollVotes: Vote[] = [];
        const seen = new Set<string>();
        for (const tx of data.result) {
          if (tx.isError !== '0' || !tx.input) continue;
          try {
            const decoded = Buffer.from(tx.input.slice(2), 'hex').toString('utf8');
            if (!decoded.startsWith(`inkpoll:${poll.id}:`)) continue;
            const optIdx = parseInt(decoded.split(':')[2], 10);
            if (isNaN(optIdx) || optIdx < 0 || optIdx >= poll.options.length) continue;
            const voter = tx.from.toLowerCase();
            if (seen.has(voter)) continue; // one vote per wallet
            seen.add(voter);
            pollVotes.push({ voter, optionIndex: optIdx, txHash: tx.hash });
          } catch { /* skip */ }
        }
        setVotes(pollVotes);
        if (address) setHasVoted(seen.has(address.toLowerCase()));
      })
      .catch(() => setVotes([]))
      .finally(() => setLoadingVotes(false));
  }, [poll.id, poll.options.length, address, isConfirmed]);

  const handleVote = (optionIndex: number) => {
    if (!address || hasVoted) return;
    const calldata = toHex(`inkpoll:${poll.id}:${optionIndex}`);
    sendTransaction(
      { to: POLL_REGISTRY, value: BigInt(0), data: calldata },
      { onSuccess: (hash) => { setTxHash(hash); setHasVoted(true); } },
    );
  };

  const totalVotes = votes.length;
  const voteCounts = poll.options.map((_, i) => votes.filter((v) => v.optionIndex === i).length);

  return (
    <div className="rounded-xl bg-white p-6 ring-1 ring-inset ring-purple-100 shadow-sm">
      <div className="mb-1 flex items-start justify-between">
        <h3 className="text-base font-semibold text-ink-900">{poll.question}</h3>
        <span className="shrink-0 text-xs text-ink-400">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
      </div>
      <p className="mb-4 text-[10px] text-ink-400">
        by {poll.creator.slice(0, 6)}...{poll.creator.slice(-4)} · {new Date(poll.createdAt).toLocaleDateString()}
      </p>

      <div className="space-y-2">
        {poll.options.map((opt, i) => {
          const count = voteCounts[i];
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const isWinner = totalVotes > 0 && count === Math.max(...voteCounts);

          return (
            <button
              key={i}
              onClick={() => handleVote(i)}
              disabled={!isConnected || hasVoted || isPending}
              className={`group relative w-full overflow-hidden rounded-lg p-3 text-left transition ring-1 ring-inset ${
                hasVoted || !isConnected
                  ? 'cursor-default ring-purple-100'
                  : 'cursor-pointer ring-purple-200 hover:ring-ink-500'
              }`}
            >
              {/* Progress bar background */}
              <div
                className={`absolute inset-y-0 left-0 transition-all ${isWinner ? 'bg-ink-500/10' : 'bg-purple-50'}`}
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between">
                <span className={`text-sm ${isWinner ? 'font-semibold text-ink-900' : 'text-ink-700'}`}>{opt}</span>
                {totalVotes > 0 && (
                  <span className="text-xs font-mono text-ink-500">{pct}% ({count})</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {isPending && <p className="mt-3 text-xs text-amber-600">Confirm in your wallet...</p>}
      {isConfirmed && txHash && (
        <p className="mt-3 text-xs text-emerald-600">
          Vote recorded! <a href={`https://explorer.inkonchain.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="underline">View tx</a>
        </p>
      )}
      {!isConnected && <p className="mt-3 text-xs text-ink-400">Connect wallet to vote</p>}
      {hasVoted && !isConfirmed && <p className="mt-3 text-xs text-ink-400">You already voted on this poll</p>}
    </div>
  );
}

/* ── Main Page ── */
function PollApp() {
  const { isConnected } = useAccount();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { setPolls(loadPolls()); }, []);

  const refresh = () => setPolls(loadPolls());

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          {isConnected && (
            <button onClick={() => setShowCreate(!showCreate)}
              className="rounded-lg bg-ink-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-ink-600">
              {showCreate ? 'Close' : 'Create Poll'}
            </button>
          )}
        </div>
        <ConnectButton showBalance={false} />
      </div>

      {showCreate && <CreatePoll onCreated={() => { refresh(); setShowCreate(false); }} />}

      {/* How it works */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-ink-500 text-sm font-bold text-white">1</div>
          <h3 className="text-sm font-semibold text-ink-900">Create</h3>
          <p className="mt-1 text-xs text-ink-600">Write a question with 2-6 options. Connect your wallet first.</p>
        </div>
        <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-ink-500 text-sm font-bold text-white">2</div>
          <h3 className="text-sm font-semibold text-ink-900">Vote</h3>
          <p className="mt-1 text-xs text-ink-600">Each vote is a 0-value on-chain tx. One vote per wallet. Costs only gas.</p>
        </div>
        <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-ink-500 text-sm font-bold text-white">3</div>
          <h3 className="text-sm font-semibold text-ink-900">Verify</h3>
          <p className="mt-1 text-xs text-ink-600">Results are transparent. Every vote is a verifiable transaction on Ink.</p>
        </div>
      </div>

      {/* Polls list */}
      {polls.length > 0 ? (
        <div>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-600">Active Polls</h2>
          <div className="space-y-4">
            {polls.map((poll) => <PollCard key={poll.id} poll={poll} />)}
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-white p-8 text-center ring-1 ring-inset ring-purple-100 shadow-sm">
          <div className="text-3xl mb-3">No polls yet</div>
          <p className="text-sm text-ink-500">Create the first on-chain poll!</p>
          {!isConnected && <p className="mt-2 text-xs text-ink-400">Connect your wallet to get started.</p>}
        </div>
      )}
    </div>
  );
}

export default function PollPage() {
  return (
    <InkWalletProvider>
      <main className="mx-auto max-w-2xl px-6 py-10 sm:py-16">
        <header className="mb-8">
          <a href="https://inksuite.xyz"
            className="mb-6 inline-flex items-center gap-2 rounded-lg bg-purple-100 px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-purple-200 shadow-sm transition hover:bg-purple-200 hover:text-ink-900">
            ← inksuite.xyz
          </a>
          <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">InkPoll</h1>
          <p className="mt-2 text-sm text-ink-600">On-chain polls on Ink. Every vote is a verifiable transaction.</p>
        </header>

        <PollApp />

        <footer className="mt-16 border-t border-purple-200 pt-8 text-sm text-ink-500">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span>Part of Ink Suite · MIT license</span>
            <a href="https://github.com/erdemcrypto3/inksuite" className="hover:text-ink-500" target="_blank" rel="noopener noreferrer">source →</a>
          </div>
        </footer>
      </main>
    </InkWalletProvider>
  );
}
