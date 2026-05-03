'use client';

import { InkWalletProvider, ConnectButton, useAccount, useSendTransaction, useWaitForTransactionReceipt } from '@inksuite/wallet';
import { useState, useEffect, useCallback } from 'react';
import { toHex } from 'viem';
import { GmCalendar } from './components/gm-calendar';

// GM is a 0-value self-transfer with "gm" as calldata
const GM_HEX = toHex('gm'); // 0x676d

type GmRecord = {
  date: string; // YYYY-MM-DD
  txHash: string;
};

type GmData = {
  records: GmRecord[];
  currentStreak: number;
  longestStreak: number;
  totalGms: number;
};

function getStorageKey(address: string) {
  return `inksuite-gm-${address.toLowerCase()}`;
}

function loadGmData(address: string): GmData {
  try {
    const raw = localStorage.getItem(getStorageKey(address));
    return raw ? JSON.parse(raw) : { records: [], currentStreak: 0, longestStreak: 0, totalGms: 0 };
  } catch {
    return { records: [], currentStreak: 0, longestStreak: 0, totalGms: 0 };
  }
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function calcStreak(records: GmRecord[]): { current: number; longest: number } {
  if (records.length === 0) return { current: 0, longest: 0 };
  const dates = [...new Set(records.map((r) => r.date))].sort().reverse();
  const today = todayStr();
  const yesterday = yesterdayStr();

  // Current streak: must include today or yesterday
  let current = 0;
  if (dates[0] === today || dates[0] === yesterday) {
    current = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]!);
      const curr = new Date(dates[i]!);
      const diffDays = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays === 1) current++;
      else break;
    }
  }

  // Longest streak
  const sorted = [...new Set(records.map((r) => r.date))].sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]!);
    const curr = new Date(sorted[i]!);
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays === 1) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }

  return { current, longest: Math.max(longest, current) };
}

function GmWidget() {
  const { address, isConnected } = useAccount();
  const [gmData, setGmData] = useState<GmData>({ records: [], currentStreak: 0, longestStreak: 0, totalGms: 0 });
  const [alreadySaidGm, setAlreadySaidGm] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { sendTransaction, isPending: isSending } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  // Load data when wallet connects
  useEffect(() => {
    if (!address) return;
    const data = loadGmData(address);
    const streaks = calcStreak(data.records);
    data.currentStreak = streaks.current;
    data.longestStreak = streaks.longest;
    setGmData(data);
    setAlreadySaidGm(data.records.some((r) => r.date === todayStr()));
  }, [address]);

  // Save after confirmed tx
  useEffect(() => {
    if (!isConfirmed || !txHash || !address) return;
    const data = loadGmData(address);
    const today = todayStr();
    if (!data.records.some((r) => r.date === today)) {
      data.records.push({ date: today, txHash });
      data.totalGms = data.records.length;
      const streaks = calcStreak(data.records);
      data.currentStreak = streaks.current;
      data.longestStreak = streaks.longest;
      localStorage.setItem(getStorageKey(address), JSON.stringify(data));
      setGmData(data);
      setAlreadySaidGm(true);
    }
  }, [isConfirmed, txHash, address]);

  const sayGm = useCallback(() => {
    if (!address) return;
    sendTransaction(
      {
        to: address, // self-transfer
        value: BigInt(0),
        data: GM_HEX,
      },
      {
        onSuccess: (hash) => setTxHash(hash),
      },
    );
  }, [address, sendTransaction]);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center gap-8 py-16">
        <div className="text-center">
          <div className="mb-4 text-6xl">gm</div>
          <p className="text-lg text-ink-600">Connect your wallet to say gm on-chain</p>
          <p className="mt-2 text-sm text-ink-500">A 0-value self-transfer with &quot;gm&quot; as calldata. Costs only gas.</p>
        </div>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with wallet */}
      <div className="flex items-center justify-between">
        <div />
        <ConnectButton showBalance={false} />
      </div>

      {/* Main GM button */}
      <div className="flex flex-col items-center gap-6">
        <button
          onClick={sayGm}
          disabled={isSending || isConfirming || alreadySaidGm}
          className={`group relative flex h-40 w-40 items-center justify-center rounded-full text-5xl font-bold shadow-lg transition-all ${
            alreadySaidGm
              ? 'bg-emerald-100 text-emerald-600 ring-2 ring-emerald-300 cursor-default'
              : isSending || isConfirming
              ? 'bg-amber-100 text-amber-600 ring-2 ring-amber-300 animate-pulse cursor-wait'
              : 'bg-ink-500 text-white hover:bg-ink-600 hover:scale-105 active:scale-95 cursor-pointer'
          }`}
        >
          {alreadySaidGm ? 'gm!' : isSending ? '...' : isConfirming ? '...' : 'gm'}
        </button>

        {/* Status text */}
        {alreadySaidGm && (
          <div className="text-center">
            <p className="text-lg font-semibold text-emerald-600">You said gm today!</p>
            {txHash && (
              <a
                href={`https://explorer.inkonchain.com/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-ink-500 hover:text-ink-600 underline"
              >
                View transaction
              </a>
            )}
          </div>
        )}
        {isSending && <p className="text-amber-600">Confirm in your wallet...</p>}
        {isConfirming && <p className="text-amber-600">Waiting for confirmation...</p>}
        {!alreadySaidGm && !isSending && !isConfirming && (
          <p className="text-sm text-ink-500">Send a 0-value tx to yourself with &quot;gm&quot; as calldata</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-white p-4 text-center ring-1 ring-inset ring-purple-100 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Current Streak</div>
          <div className="mt-1 font-mono text-3xl font-bold text-ink-500">
            {gmData.currentStreak}
          </div>
          <div className="text-xs text-ink-400">days</div>
        </div>
        <div className="rounded-xl bg-white p-4 text-center ring-1 ring-inset ring-purple-100 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Longest Streak</div>
          <div className="mt-1 font-mono text-3xl font-bold text-ink-900">
            {gmData.longestStreak}
          </div>
          <div className="text-xs text-ink-400">days</div>
        </div>
        <div className="rounded-xl bg-white p-4 text-center ring-1 ring-inset ring-purple-100 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Total GMs</div>
          <div className="mt-1 font-mono text-3xl font-bold text-ink-900">
            {gmData.totalGms}
          </div>
          <div className="text-xs text-ink-400">on-chain</div>
        </div>
      </div>

      {/* Calendar */}
      <GmCalendar records={gmData.records} />
    </div>
  );
}

export default function GmPage() {
  return (
    <InkWalletProvider>
      <main className="mx-auto max-w-lg px-6 py-10 sm:py-16">
        <header className="mb-8">
          <a
            href="https://inksuite.xyz"
            className="mb-6 inline-flex items-center gap-2 rounded-lg bg-purple-100 px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-purple-200 shadow-sm transition hover:bg-purple-200 hover:text-ink-900"
          >
            ← inksuite.xyz
          </a>
          <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
            GM Widget
          </h1>
          <p className="mt-2 text-sm text-ink-600">
            Say gm on-chain every day. Build your streak.
          </p>
        </header>

        <GmWidget />

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
