'use client';

import { useState } from 'react';
import { isAddress, type Address } from 'viem';
import { EXPLORER_URL } from '@inksuite/chain';
import { ActivityTab } from './components/activity-tab';
import { PortfolioTab } from './components/portfolio-tab';

type MainTab = 'activity' | 'portfolio';

export default function WalletDashboardPage() {
  const [input, setInput] = useState('');
  const [address, setAddress] = useState<Address | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MainTab>('activity');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAddress(null);
    const trimmed = input.trim();
    if (!isAddress(trimmed)) {
      setError('Not a valid Ethereum address (expected 0x… with 40 hex chars).');
      return;
    }
    setAddress(trimmed as Address);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
      <header className="mb-10">
        <a
          href="https://inksuite.xyz"
          className="mb-6 inline-flex items-center gap-2 rounded-lg bg-purple-100 px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-purple-200 shadow-sm transition hover:bg-purple-200 hover:text-ink-900"
        >
          ← inksuite.xyz
        </a>
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-5xl">
          Wallet Dashboard
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-700">
          Enter any Ink wallet address to see activity, gas usage, token balances, and NFT
          holdings. All data pulled live from Ink mainnet — no tracking, no backend.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="mb-8 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="0x…"
          spellCheck={false}
          autoComplete="off"
          className="flex-1 rounded-lg bg-white px-4 py-3 font-mono text-sm text-ink-900 ring-1 ring-inset ring-purple-200 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-ink-500 shadow-sm"
        />
        <button
          type="submit"
          className="rounded-lg bg-ink-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-ink-700"
        >
          Analyze
        </button>
      </form>

      {error && (
        <div className="mb-8 rounded-lg bg-red-500/10 p-4 text-sm text-red-600 ring-1 ring-inset ring-red-500/30">
          <strong>Error:</strong> {error}
        </div>
      )}

      {address && (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-ink-700">
            <span>Analyzing</span>
            <code className="rounded bg-white px-2 py-1 font-mono text-ink-900 ring-1 ring-inset ring-purple-200 shadow-sm">
              {address}
            </code>
            <a
              href={`${EXPLORER_URL}/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-500 hover:underline"
            >
              explorer →
            </a>
          </div>

          <div className="mb-8 flex gap-1 rounded-lg bg-purple-50/50 p-1 ring-1 ring-inset ring-purple-100">
            {(['activity', 'portfolio'] as MainTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 rounded-md px-4 py-2.5 text-sm font-semibold transition ${
                  activeTab === tab
                    ? 'bg-ink-500 text-white shadow-sm'
                    : 'text-ink-600 hover:bg-purple-50 hover:text-ink-800'
                }`}
              >
                {tab === 'activity' ? 'Activity' : 'Portfolio'}
              </button>
            ))}
          </div>

          {activeTab === 'activity' && <ActivityTab address={address} />}
          {activeTab === 'portfolio' && <PortfolioTab address={address} />}
        </>
      )}

      <footer className="mt-16 border-t border-purple-200 pt-8 text-sm text-ink-500">
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
