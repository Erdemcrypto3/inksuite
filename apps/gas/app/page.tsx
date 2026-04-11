'use client';

import { useEffect, useRef, useState } from 'react';
import { formatGwei } from 'viem';
import { inkPublicClient, EXPLORER_URL } from '@inksuite/chain';

type Sample = {
  at: number;
  gasPriceWei: bigint;
  blockNumber: bigint;
  baseFeeWei: bigint | null;
};

const POLL_MS = 4000;
const HISTORY_LIMIT = 30;

function formatGweiShort(wei: bigint | null, digits = 4): string {
  if (wei === null) return '—';
  const gwei = Number(formatGwei(wei));
  if (gwei >= 1) return gwei.toFixed(2);
  if (gwei >= 0.001) return gwei.toFixed(4);
  return gwei.toExponential(2);
}

function relativeTime(then: number, now: number): string {
  const s = Math.round((now - then) / 1000);
  if (s < 2) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return `${m}m ago`;
}

export default function GasTrackerPage() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const pollingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (pollingRef.current) return;
      pollingRef.current = true;
      try {
        const [gasPriceWei, block] = await Promise.all([
          inkPublicClient.getGasPrice(),
          inkPublicClient.getBlock({ blockTag: 'latest' }),
        ]);
        if (cancelled) return;
        const sample: Sample = {
          at: Date.now(),
          gasPriceWei,
          blockNumber: block.number,
          baseFeeWei: block.baseFeePerGas ?? null,
        };
        setSamples((prev) => [...prev.slice(-(HISTORY_LIMIT - 1)), sample]);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Unknown RPC error');
      } finally {
        pollingRef.current = false;
      }
    }

    poll();
    const pollInterval = setInterval(poll, POLL_MS);
    const clockInterval = setInterval(() => setNow(Date.now()), 1000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
      clearInterval(clockInterval);
    };
  }, []);

  const latest = samples[samples.length - 1] ?? null;
  const reversed = [...samples].reverse();

  return (
    <main className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
      <header className="mb-12">
        <a
          href="https://inksuite.xyz"
          className="mb-4 inline-flex items-center gap-1 text-sm text-ink-100/50 hover:text-ink-500"
        >
          ← inksuite.xyz
        </a>
        <h1 className="text-3xl font-semibold tracking-tight text-ink-50 sm:text-5xl">
          Ink Gas Tracker
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-100/60">
          Live gas price, base fee, and the most recent {HISTORY_LIMIT} samples for Ink mainnet.
          Polls every {POLL_MS / 1000}s directly from the chain — no backend, nothing cached.
        </p>
      </header>

      <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white/5 p-6 ring-1 ring-inset ring-white/10">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-100/40">
            Gas price
          </div>
          <div className="mt-3 font-mono text-3xl font-semibold text-ink-50">
            {latest ? formatGweiShort(latest.gasPriceWei) : '—'}
            <span className="ml-2 text-sm font-normal text-ink-100/40">gwei</span>
          </div>
        </div>
        <div className="rounded-xl bg-white/5 p-6 ring-1 ring-inset ring-white/10">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-100/40">
            Base fee
          </div>
          <div className="mt-3 font-mono text-3xl font-semibold text-ink-50">
            {latest ? formatGweiShort(latest.baseFeeWei) : '—'}
            <span className="ml-2 text-sm font-normal text-ink-100/40">gwei</span>
          </div>
        </div>
        <div className="rounded-xl bg-white/5 p-6 ring-1 ring-inset ring-white/10">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-100/40">
            Latest block
          </div>
          <div className="mt-3 font-mono text-3xl font-semibold text-ink-50">
            {latest ? `#${latest.blockNumber.toString()}` : '—'}
          </div>
          {latest && (
            <a
              href={`${EXPLORER_URL}/block/${latest.blockNumber.toString()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-ink-100/40 hover:text-ink-500"
            >
              view on explorer →
            </a>
          )}
        </div>
      </section>

      {error && (
        <div className="mb-8 rounded-lg bg-red-500/10 p-4 text-sm text-red-300 ring-1 ring-inset ring-red-500/30">
          <strong>RPC error:</strong> {error}
        </div>
      )}

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-100/50">
          Recent samples
        </h2>
        <div className="overflow-hidden rounded-xl bg-white/5 ring-1 ring-inset ring-white/10">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-ink-100/40">
              <tr>
                <th className="px-4 py-3 text-left font-medium">When</th>
                <th className="px-4 py-3 text-left font-medium">Block</th>
                <th className="px-4 py-3 text-right font-medium">Gas (gwei)</th>
                <th className="px-4 py-3 text-right font-medium">Base fee (gwei)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {reversed.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-ink-100/40">
                    Fetching first sample…
                  </td>
                </tr>
              ) : (
                reversed.map((s, i) => (
                  <tr key={`${s.blockNumber}-${i}`} className="hover:bg-white/5">
                    <td className="px-4 py-3 text-ink-100/70">{relativeTime(s.at, now)}</td>
                    <td className="px-4 py-3 text-ink-100/70">#{s.blockNumber.toString()}</td>
                    <td className="px-4 py-3 text-right text-ink-50">
                      {formatGweiShort(s.gasPriceWei)}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-100/60">
                      {formatGweiShort(s.baseFeeWei)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

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
