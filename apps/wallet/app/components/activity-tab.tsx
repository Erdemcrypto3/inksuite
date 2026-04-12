'use client';

import { useEffect, useState } from 'react';
import { formatEther, type Address } from 'viem';
import { BLOCKSCOUT_API_URL, EXPLORER_URL } from '@inksuite/chain';
import { MetricCard } from './metric-card';

type BlockscoutTx = {
  hash: string;
  blockNumber: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  input: string;
  isError: string;
  txreceipt_status: string;
  contractAddress: string;
};

type Metrics = {
  totalTxs: number;
  successfulTxs: number;
  failedTxs: number;
  totalGasSpentWei: bigint;
  uniqueContracts: number;
  uniqueDestinations: number;
  firstTxAt: number | null;
  lastTxAt: number | null;
  topContracts: { address: string; txCount: number }[];
  totalValueTransferredWei: bigint;
};

const PAGE_SIZE = 10000;

async function fetchAllTxs(address: Address): Promise<BlockscoutTx[]> {
  const all: BlockscoutTx[] = [];
  let page = 1;
  while (true) {
    const url = `${BLOCKSCOUT_API_URL}?module=account&action=txlist&address=${address}&page=${page}&offset=${PAGE_SIZE}&sort=asc`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Blockscout HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== '1') {
      if (typeof data.result === 'string' && data.result.toLowerCase().includes('no transactions')) return all;
      if (Array.isArray(data.result) && data.result.length === 0) return all;
      throw new Error(typeof data.result === 'string' ? data.result : data.message || 'Unknown error');
    }
    const txs = Array.isArray(data.result) ? data.result : [];
    all.push(...txs);
    if (txs.length < PAGE_SIZE) break;
    page += 1;
    if (page > 10) break;
  }
  return all;
}

function computeMetrics(address: Address, txs: BlockscoutTx[]): Metrics {
  const sent = txs.filter((t) => t.from.toLowerCase() === address.toLowerCase());

  let totalGasSpentWei = 0n;
  let totalValueTransferredWei = 0n;
  let successfulTxs = 0;
  let failedTxs = 0;
  let firstTxAt: number | null = null;
  let lastTxAt: number | null = null;

  const contractTxCounts = new Map<string, number>();
  const destinations = new Set<string>();

  for (const tx of sent) {
    totalGasSpentWei += BigInt(tx.gasUsed || '0') * BigInt(tx.gasPrice || '0');
    totalValueTransferredWei += BigInt(tx.value || '0');

    if (tx.isError === '1' || tx.txreceipt_status === '0') {
      failedTxs += 1;
    } else {
      successfulTxs += 1;
    }

    const ts = Number(tx.timeStamp || '0');
    if (ts > 0) {
      if (firstTxAt === null || ts < firstTxAt) firstTxAt = ts;
      if (lastTxAt === null || ts > lastTxAt) lastTxAt = ts;
    }

    const to = (tx.to || '').toLowerCase();
    if (to && to !== '0x0000000000000000000000000000000000000000') {
      destinations.add(to);
      if (tx.input && tx.input !== '0x' && tx.input.length > 2) {
        contractTxCounts.set(to, (contractTxCounts.get(to) || 0) + 1);
      }
    }
  }

  const topContracts = Array.from(contractTxCounts.entries())
    .map(([address, txCount]) => ({ address, txCount }))
    .sort((a, b) => b.txCount - a.txCount)
    .slice(0, 5);

  return {
    totalTxs: sent.length,
    successfulTxs,
    failedTxs,
    totalGasSpentWei,
    uniqueContracts: contractTxCounts.size,
    uniqueDestinations: destinations.size,
    firstTxAt,
    lastTxAt,
    topContracts,
    totalValueTransferredWei,
  };
}

function formatEthShort(wei: bigint): string {
  const eth = Number(formatEther(wei));
  if (eth === 0) return '0';
  if (eth >= 1) return eth.toFixed(4);
  if (eth >= 0.0001) return eth.toFixed(6);
  return eth.toExponential(2);
}

function formatDate(ts: number | null): string {
  if (ts === null) return '—';
  return new Date(ts * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function daysBetween(from: number | null, to: number | null): string {
  if (from === null || to === null) return '—';
  const days = Math.max(1, Math.round((to - from) / 86400));
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

export function ActivityTab({ address }: { address: Address }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchAllTxs(address)
      .then((txs) => {
        if (cancelled) return;
        setMetrics(computeMetrics(address, txs));
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Unknown error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [address]);

  if (loading) return <div className="py-12 text-center text-ink-600">Loading activity…</div>;
  if (error) return (
    <div className="rounded-lg bg-red-500/10 p-4 text-sm text-red-600 ring-1 ring-inset ring-red-500/30">
      <strong>Error:</strong> {error}
    </div>
  );
  if (!metrics) return null;

  return (
    <>
      <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total transactions" value={metrics.totalTxs.toLocaleString()} />
        <MetricCard label="Total gas spent" value={formatEthShort(metrics.totalGasSpentWei)} unit="ETH" />
        <MetricCard label="Unique contracts" value={metrics.uniqueContracts.toLocaleString()} />
        <MetricCard label="Active for" value={daysBetween(metrics.firstTxAt, metrics.lastTxAt)} />
      </section>

      <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="First activity" value={formatDate(metrics.firstTxAt)} dim />
        <MetricCard label="Last activity" value={formatDate(metrics.lastTxAt)} dim />
        <MetricCard label="Successful / failed" value={`${metrics.successfulTxs} / ${metrics.failedTxs}`} dim />
        <MetricCard label="Total ETH transferred" value={formatEthShort(metrics.totalValueTransferredWei)} unit="ETH" dim />
      </section>

      {metrics.topContracts.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-600">Top contracts</h2>
          <div className="overflow-hidden rounded-xl bg-white ring-1 ring-inset ring-purple-100 shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-purple-200 text-xs uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Contract</th>
                  <th className="px-4 py-3 text-right font-medium">Interactions</th>
                  <th className="px-4 py-3 text-right font-medium">Explorer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-100 font-mono">
                {metrics.topContracts.map((c) => (
                  <tr key={c.address} className="hover:bg-purple-50">
                    <td className="px-4 py-3 text-ink-900">{shortAddress(c.address)}</td>
                    <td className="px-4 py-3 text-right text-ink-700">{c.txCount}</td>
                    <td className="px-4 py-3 text-right">
                      <a href={`https://explorer.inkonchain.com/address/${c.address}`} target="_blank" rel="noopener noreferrer" className="text-ink-500 hover:underline">open →</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
