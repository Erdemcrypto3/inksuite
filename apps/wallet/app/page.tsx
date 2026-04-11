'use client';

import { useState } from 'react';
import { formatEther, isAddress, type Address } from 'viem';
import { BLOCKSCOUT_API_URL, EXPLORER_URL } from '@inksuite/chain';

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

type BlockscoutResponse = {
  status: string;
  message: string;
  result: BlockscoutTx[] | string;
};

type Metrics = {
  address: Address;
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
    const data = (await res.json()) as BlockscoutResponse;
    if (data.status !== '1') {
      if (typeof data.result === 'string' && data.result.toLowerCase().includes('no transactions')) {
        return all;
      }
      if (Array.isArray(data.result) && data.result.length === 0) {
        return all;
      }
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
    const gasUsed = BigInt(tx.gasUsed || '0');
    const gasPrice = BigInt(tx.gasPrice || '0');
    totalGasSpentWei += gasUsed * gasPrice;

    const value = BigInt(tx.value || '0');
    totalValueTransferredWei += value;

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
      const looksLikeContract = tx.input && tx.input !== '0x' && tx.input.length > 2;
      if (looksLikeContract) {
        contractTxCounts.set(to, (contractTxCounts.get(to) || 0) + 1);
      }
    }
  }

  const topContracts = Array.from(contractTxCounts.entries())
    .map(([address, txCount]) => ({ address, txCount }))
    .sort((a, b) => b.txCount - a.txCount)
    .slice(0, 5);

  return {
    address,
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

function formatEthShort(wei: bigint, digits = 6): string {
  const eth = Number(formatEther(wei));
  if (eth === 0) return '0';
  if (eth >= 1) return eth.toFixed(4);
  if (eth >= 0.0001) return eth.toFixed(digits);
  return eth.toExponential(2);
}

function formatDate(ts: number | null): string {
  if (ts === null) return '—';
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function daysBetween(from: number | null, to: number | null): string {
  if (from === null || to === null) return '—';
  const days = Math.max(1, Math.round((to - from) / 86400));
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

export default function WalletDashboardPage() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMetrics(null);

    const trimmed = input.trim();
    if (!isAddress(trimmed)) {
      setError('Not a valid Ethereum address (expected 0x… with 40 hex chars).');
      return;
    }

    setLoading(true);
    try {
      const txs = await fetchAllTxs(trimmed as Address);
      const m = computeMetrics(trimmed as Address, txs);
      setMetrics(m);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error fetching data.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
      <header className="mb-10">
        <a
          href="https://inksuite.xyz"
          className="mb-4 inline-flex items-center gap-1 text-sm text-ink-100/50 hover:text-ink-500"
        >
          ← inksuite.xyz
        </a>
        <h1 className="text-3xl font-semibold tracking-tight text-ink-50 sm:text-5xl">
          Wallet Activity
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-100/60">
          Enter any Ink wallet address to see total transactions, gas spent, contracts
          interacted with, and active period. Data is pulled live from the Ink Blockscout
          explorer — no tracking, no backend.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="mb-10 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="0x…"
          spellCheck={false}
          autoComplete="off"
          className="flex-1 rounded-lg bg-white/5 px-4 py-3 font-mono text-sm text-ink-50 ring-1 ring-inset ring-white/10 placeholder:text-ink-100/30 focus:outline-none focus:ring-2 focus:ring-ink-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-ink-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Scanning…' : 'Analyze'}
        </button>
      </form>

      {error && (
        <div className="mb-8 rounded-lg bg-red-500/10 p-4 text-sm text-red-300 ring-1 ring-inset ring-red-500/30">
          <strong>Error:</strong> {error}
        </div>
      )}

      {metrics && (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-ink-100/60">
            <span>Analyzing</span>
            <code className="rounded bg-white/5 px-2 py-1 font-mono text-ink-50 ring-1 ring-inset ring-white/10">
              {metrics.address}
            </code>
            <a
              href={`${EXPLORER_URL}/address/${metrics.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-500 hover:underline"
            >
              view on explorer →
            </a>
          </div>

          <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Total transactions" value={metrics.totalTxs.toLocaleString()} />
            <MetricCard
              label="Total gas spent"
              value={formatEthShort(metrics.totalGasSpentWei)}
              unit="ETH"
            />
            <MetricCard label="Unique contracts" value={metrics.uniqueContracts.toLocaleString()} />
            <MetricCard label="Active for" value={daysBetween(metrics.firstTxAt, metrics.lastTxAt)} />
          </section>

          <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="First activity" value={formatDate(metrics.firstTxAt)} dim />
            <MetricCard label="Last activity" value={formatDate(metrics.lastTxAt)} dim />
            <MetricCard
              label="Successful / failed"
              value={`${metrics.successfulTxs} / ${metrics.failedTxs}`}
              dim
            />
            <MetricCard
              label="Total ETH transferred"
              value={formatEthShort(metrics.totalValueTransferredWei)}
              unit="ETH"
              dim
            />
          </section>

          {metrics.topContracts.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-100/50">
                Top contracts
              </h2>
              <div className="overflow-hidden rounded-xl bg-white/5 ring-1 ring-inset ring-white/10">
                <table className="w-full text-sm">
                  <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-ink-100/40">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Contract</th>
                      <th className="px-4 py-3 text-right font-medium">Interactions</th>
                      <th className="px-4 py-3 text-right font-medium">Explorer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {metrics.topContracts.map((c) => (
                      <tr key={c.address} className="hover:bg-white/5">
                        <td className="px-4 py-3 text-ink-50">{shortAddress(c.address)}</td>
                        <td className="px-4 py-3 text-right text-ink-100/70">{c.txCount}</td>
                        <td className="px-4 py-3 text-right">
                          <a
                            href={`${EXPLORER_URL}/address/${c.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-ink-500 hover:underline"
                          >
                            open →
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-ink-100/40">
                &ldquo;Contract&rdquo; here = any destination address where the transaction included
                calldata. Plain ETH transfers to EOAs are not counted as contract interactions.
              </p>
            </section>
          )}
        </>
      )}

      <footer className="mt-16 border-t border-white/10 pt-8 text-sm text-ink-100/40">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span>Part of Ink Suite · MIT license</span>
          <a
            href="https://github.com/erdemcrypto3/inksuite"
            className="hover:text-ink-500"
            target="_blank"
            rel="noopener noreferrer"
          >
            source →
          </a>
        </div>
      </footer>
    </main>
  );
}

function MetricCard({
  label,
  value,
  unit,
  dim,
}: {
  label: string;
  value: string;
  unit?: string;
  dim?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-5 ring-1 ring-inset ring-white/10 ${
        dim ? 'bg-white/[0.03]' : 'bg-white/5'
      }`}
    >
      <div className="text-xs font-semibold uppercase tracking-wider text-ink-100/40">{label}</div>
      <div className="mt-2 font-mono text-2xl font-semibold text-ink-50">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-ink-100/40">{unit}</span>}
      </div>
    </div>
  );
}
