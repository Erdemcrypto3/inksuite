'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatEther } from 'viem';
import { BLOCKSCOUT_API_URL, EXPLORER_URL } from '@inksuite/chain';

type Tab = 'bridge' | 'dex';

// Known bridge contracts on Ink (L1 → L2 deposits show up as txs from these)
const BRIDGE_CONTRACTS: Record<string, string> = {
  '0x88ff1e5b602916615391f55854b8a5c2536c2518': 'Ink Standard Bridge',
  '0x5d0bb2c2a6a4c9e611363ac1a541e8a3c3ae5b87': 'Ink Bridge (Gelato)',
};

// Known DEX routers on Ink
const DEX_CONTRACTS: Record<string, string> = {
  // Velodrome Router
  '0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43': 'Velodrome Router',
  // Add more as we discover them
};

function shortenAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatValue(wei: string): string {
  try {
    const eth = Number(formatEther(BigInt(wei)));
    if (eth === 0) return '0';
    if (eth < 0.001) return '<0.001';
    return eth.toFixed(4);
  } catch { return '0'; }
}

type TxItem = {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  functionName: string;
  isError: string;
  input: string;
};

/* ── Bridge Tab ── */
function BridgeMonitor() {
  const [txs, setTxs] = useState<TxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalTxs: 0, uniqueWallets: 0, totalValueEth: 0 });

  useEffect(() => {
    const bridgeAddrs = Object.keys(BRIDGE_CONTRACTS);
    const fetchAll = async () => {
      setLoading(true);
      const allTxs: TxItem[] = [];

      for (const addr of bridgeAddrs) {
        try {
          const url = `${BLOCKSCOUT_API_URL}?module=account&action=txlist&address=${addr}&startblock=0&endblock=latest&sort=desc&page=1&offset=200`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.status === '1' && Array.isArray(data.result)) {
            allTxs.push(...data.result.filter((tx: TxItem) => tx.isError === '0'));
          }
        } catch { /* skip */ }
      }

      // Sort by timestamp desc
      allTxs.sort((a, b) => Number(b.timeStamp) - Number(a.timeStamp));

      // Stats
      const uniqueFrom = new Set(allTxs.map((tx) => tx.from.toLowerCase()));
      const totalValue = allTxs.reduce((sum, tx) => {
        try { return sum + Number(formatEther(BigInt(tx.value))); } catch { return sum; }
      }, 0);

      setTxs(allTxs.slice(0, 100));
      setStats({ totalTxs: allTxs.length, uniqueWallets: uniqueFrom.size, totalValueEth: totalValue });
      setLoading(false);
    };

    fetchAll();
  }, []);

  if (loading) return <div className="py-12 text-center text-ink-500">Loading bridge data...</div>;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-white p-4 text-center ring-1 ring-inset ring-purple-100 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Bridge Txs</div>
          <div className="mt-1 font-mono text-2xl font-bold text-ink-500">{stats.totalTxs.toLocaleString()}</div>
        </div>
        <div className="rounded-xl bg-white p-4 text-center ring-1 ring-inset ring-purple-100 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Unique Wallets</div>
          <div className="mt-1 font-mono text-2xl font-bold text-ink-900">{stats.uniqueWallets.toLocaleString()}</div>
        </div>
        <div className="rounded-xl bg-white p-4 text-center ring-1 ring-inset ring-purple-100 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Total ETH</div>
          <div className="mt-1 font-mono text-2xl font-bold text-ink-900">{stats.totalValueEth.toFixed(2)}</div>
        </div>
      </div>

      {/* Bridge contracts */}
      <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-ink-900">Tracked Bridges</h3>
        <div className="space-y-2">
          {Object.entries(BRIDGE_CONTRACTS).map(([addr, name]) => (
            <div key={addr} className="flex items-center justify-between text-xs">
              <span className="font-medium text-ink-700">{name}</span>
              <a href={`${EXPLORER_URL}/address/${addr}`} target="_blank" rel="noopener noreferrer"
                className="font-mono text-ink-500 hover:text-ink-600 underline">{shortenAddr(addr)}</a>
            </div>
          ))}
        </div>
      </div>

      {/* Recent transactions */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-600">Recent Bridge Transactions</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-purple-200 text-left text-ink-500">
                <th className="pb-2 pr-4 font-semibold">Time</th>
                <th className="pb-2 pr-4 font-semibold">From</th>
                <th className="pb-2 pr-4 font-semibold">Bridge</th>
                <th className="pb-2 font-semibold text-right">Value (ETH)</th>
                <th className="pb-2 font-semibold text-right">Tx</th>
              </tr>
            </thead>
            <tbody>
              {txs.slice(0, 50).map((tx) => (
                <tr key={tx.hash} className="border-b border-purple-50">
                  <td className="py-2 pr-4 text-ink-400">
                    {new Date(Number(tx.timeStamp) * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-2 pr-4 font-mono text-ink-700">
                    <a href={`${EXPLORER_URL}/address/${tx.from}`} target="_blank" rel="noopener noreferrer" className="hover:text-ink-500">{shortenAddr(tx.from)}</a>
                  </td>
                  <td className="py-2 pr-4 text-ink-600">
                    {BRIDGE_CONTRACTS[tx.to.toLowerCase()] || shortenAddr(tx.to)}
                  </td>
                  <td className="py-2 font-mono text-right text-ink-900">{formatValue(tx.value)}</td>
                  <td className="py-2 text-right">
                    <a href={`${EXPLORER_URL}/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" className="text-ink-400 hover:text-ink-600 underline">view</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── DEX Tab ── */
function DexTracker() {
  const [txs, setTxs] = useState<TxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalSwaps: 0, uniqueTraders: 0, totalVolumeEth: 0 });

  useEffect(() => {
    const dexAddrs = Object.keys(DEX_CONTRACTS);
    const fetchAll = async () => {
      setLoading(true);
      const allTxs: TxItem[] = [];

      for (const addr of dexAddrs) {
        try {
          const url = `${BLOCKSCOUT_API_URL}?module=account&action=txlist&address=${addr}&startblock=0&endblock=latest&sort=desc&page=1&offset=200`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.status === '1' && Array.isArray(data.result)) {
            allTxs.push(...data.result.filter((tx: TxItem) => tx.isError === '0'));
          }
        } catch { /* skip */ }
      }

      allTxs.sort((a, b) => Number(b.timeStamp) - Number(a.timeStamp));

      const uniqueFrom = new Set(allTxs.map((tx) => tx.from.toLowerCase()));
      const totalVolume = allTxs.reduce((sum, tx) => {
        try { return sum + Number(formatEther(BigInt(tx.value))); } catch { return sum; }
      }, 0);

      setTxs(allTxs.slice(0, 100));
      setStats({ totalSwaps: allTxs.length, uniqueTraders: uniqueFrom.size, totalVolumeEth: totalVolume });
      setLoading(false);
    };

    fetchAll();
  }, []);

  if (loading) return <div className="py-12 text-center text-ink-500">Loading DEX data...</div>;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-white p-4 text-center ring-1 ring-inset ring-purple-100 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Swaps</div>
          <div className="mt-1 font-mono text-2xl font-bold text-ink-500">{stats.totalSwaps.toLocaleString()}</div>
        </div>
        <div className="rounded-xl bg-white p-4 text-center ring-1 ring-inset ring-purple-100 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Unique Traders</div>
          <div className="mt-1 font-mono text-2xl font-bold text-ink-900">{stats.uniqueTraders.toLocaleString()}</div>
        </div>
        <div className="rounded-xl bg-white p-4 text-center ring-1 ring-inset ring-purple-100 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Volume (ETH)</div>
          <div className="mt-1 font-mono text-2xl font-bold text-ink-900">{stats.totalVolumeEth.toFixed(2)}</div>
        </div>
      </div>

      {/* DEX contracts */}
      <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-ink-900">Tracked DEXs</h3>
        <div className="space-y-2">
          {Object.entries(DEX_CONTRACTS).map(([addr, name]) => (
            <div key={addr} className="flex items-center justify-between text-xs">
              <span className="font-medium text-ink-700">{name}</span>
              <a href={`${EXPLORER_URL}/address/${addr}`} target="_blank" rel="noopener noreferrer"
                className="font-mono text-ink-500 hover:text-ink-600 underline">{shortenAddr(addr)}</a>
            </div>
          ))}
        </div>
      </div>

      {/* Recent swaps */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-600">Recent Swaps</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-purple-200 text-left text-ink-500">
                <th className="pb-2 pr-4 font-semibold">Time</th>
                <th className="pb-2 pr-4 font-semibold">Trader</th>
                <th className="pb-2 pr-4 font-semibold">DEX</th>
                <th className="pb-2 font-semibold text-right">Value (ETH)</th>
                <th className="pb-2 font-semibold text-right">Tx</th>
              </tr>
            </thead>
            <tbody>
              {txs.slice(0, 50).map((tx) => (
                <tr key={tx.hash} className="border-b border-purple-50">
                  <td className="py-2 pr-4 text-ink-400">
                    {new Date(Number(tx.timeStamp) * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-2 pr-4 font-mono text-ink-700">
                    <a href={`${EXPLORER_URL}/address/${tx.from}`} target="_blank" rel="noopener noreferrer" className="hover:text-ink-500">{shortenAddr(tx.from)}</a>
                  </td>
                  <td className="py-2 pr-4 text-ink-600">
                    {DEX_CONTRACTS[tx.to.toLowerCase()] || shortenAddr(tx.to)}
                  </td>
                  <td className="py-2 font-mono text-right text-ink-900">{formatValue(tx.value)}</td>
                  <td className="py-2 text-right">
                    <a href={`${EXPLORER_URL}/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" className="text-ink-400 hover:text-ink-600 underline">view</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function FlowPage() {
  const [tab, setTab] = useState<Tab>('bridge');

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 sm:py-16">
      <header className="mb-8">
        <a href="https://inksuite.xyz"
          className="mb-6 inline-flex items-center gap-2 rounded-lg bg-purple-100 px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-purple-200 shadow-sm transition hover:bg-purple-200 hover:text-ink-900">
          ← inksuite.xyz
        </a>
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">InkFlow</h1>
        <p className="mt-2 text-sm text-ink-600">Bridge and DEX analytics for Ink chain.</p>
      </header>

      {/* Tabs */}
      <div className="mb-8 flex gap-1 rounded-xl bg-white p-1 ring-1 ring-inset ring-purple-100 shadow-sm">
        <button
          onClick={() => setTab('bridge')}
          className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
            tab === 'bridge' ? 'bg-ink-500 text-white shadow-sm' : 'text-ink-600 hover:text-ink-900'
          }`}
        >
          Bridge Monitor
        </button>
        <button
          onClick={() => setTab('dex')}
          className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
            tab === 'dex' ? 'bg-ink-500 text-white shadow-sm' : 'text-ink-600 hover:text-ink-900'
          }`}
        >
          DEX Tracker
        </button>
      </div>

      {tab === 'bridge' ? <BridgeMonitor /> : <DexTracker />}

      <footer className="mt-16 border-t border-purple-200 pt-8 text-sm text-ink-500">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span>Part of Ink Suite · MIT license · Data from Blockscout</span>
          <a href="https://github.com/erdemcrypto3/inksuite" className="hover:text-ink-500" target="_blank" rel="noopener noreferrer">source →</a>
        </div>
      </footer>
    </main>
  );
}
