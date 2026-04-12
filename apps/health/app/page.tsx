'use client';

import { useState, useCallback } from 'react';
import { isAddress } from 'viem';
import { BLOCKSCOUT_API_URL, EXPLORER_URL } from '@inksuite/chain';

type TokenApproval = {
  hash: string;
  tokenName: string;
  tokenSymbol: string;
  tokenContract: string;
  spender: string;
  value: string;
  timestamp: string;
};

type TxItem = {
  hash: string;
  to: string;
  input: string;
  timeStamp: string;
  functionName: string;
  isError: string;
};

// ERC-20 approve function selector: 0x095ea7b3
const APPROVE_SELECTOR = '0x095ea7b3';

// Known contract labels
const KNOWN_CONTRACTS: Record<string, string> = {
  // Add known Ink contracts here as we discover them
};

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatDate(ts: string) {
  return new Date(Number(ts) * 1000).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export default function HealthPage() {
  const [address, setAddress] = useState('');
  const [approvals, setApprovals] = useState<TokenApproval[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [totalTxs, setTotalTxs] = useState(0);

  const searchApprovals = useCallback(async () => {
    const addr = address.trim();
    if (!isAddress(addr)) {
      setError('Enter a valid Ethereum address');
      return;
    }

    setLoading(true);
    setError(null);
    setApprovals([]);
    setSearched(false);

    try {
      // Fetch all transactions for this address
      const url = `${BLOCKSCOUT_API_URL}?module=account&action=txlist&address=${addr}&startblock=0&endblock=latest&sort=desc`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.status !== '1' || !Array.isArray(data.result)) {
        setApprovals([]);
        setTotalTxs(0);
        setSearched(true);
        setLoading(false);
        return;
      }

      const txs = data.result as TxItem[];
      setTotalTxs(txs.length);

      // Filter for approve transactions
      const approveTxs = txs.filter(
        (tx) => tx.input?.startsWith(APPROVE_SELECTOR) && tx.isError === '0'
      );

      // Parse approve data
      const parsed: TokenApproval[] = approveTxs.map((tx) => {
        // approve(address spender, uint256 value)
        const spender = '0x' + (tx.input.slice(34, 74) || '');
        const valueHex = tx.input.slice(74, 138) || '0';
        const isUnlimited = valueHex === 'f'.repeat(64) || BigInt('0x' + (valueHex || '0')) > BigInt('0xffffffffffffffffffffffffffff');

        return {
          hash: tx.hash,
          tokenName: '',
          tokenSymbol: '',
          tokenContract: tx.to,
          spender,
          value: isUnlimited ? 'Unlimited' : 'Limited',
          timestamp: tx.timeStamp,
        };
      });

      // Deduplicate — keep latest approval per (tokenContract, spender)
      const latest = new Map<string, TokenApproval>();
      for (const a of parsed) {
        const key = `${a.tokenContract}-${a.spender}`.toLowerCase();
        if (!latest.has(key)) {
          latest.set(key, a);
        }
      }

      setApprovals(Array.from(latest.values()));
      setSearched(true);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [address]);

  const revokeUrl = address.trim()
    ? `https://revoke.cash/address/${address.trim()}?chainId=57073`
    : 'https://revoke.cash';

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 sm:py-16">
      <header className="mb-8">
        <a href="https://inksuite.xyz"
          className="mb-6 inline-flex items-center gap-2 rounded-lg bg-purple-100 px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-purple-200 shadow-sm transition hover:bg-purple-200 hover:text-ink-900">
          ← inksuite.xyz
        </a>
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">Wallet Health</h1>
        <p className="mt-2 text-sm text-ink-600">
          Check token approvals for any Ink wallet. Spot risky unlimited approvals.
        </p>
      </header>

      {/* Search */}
      <div className="mb-8 rounded-xl bg-white p-6 ring-1 ring-inset ring-purple-100 shadow-sm">
        <label className="block text-xs font-semibold text-ink-600 mb-2">Wallet Address</label>
        <div className="flex gap-3">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x..."
            className="flex-1 rounded-lg border border-purple-200 bg-ink-50 px-4 py-2.5 font-mono text-sm text-ink-900 placeholder:text-ink-300 focus:border-ink-500 focus:outline-none"
            onKeyDown={(e) => e.key === 'Enter' && searchApprovals()}
          />
          <button
            onClick={searchApprovals}
            disabled={loading}
            className="rounded-lg bg-ink-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-ink-600 disabled:opacity-50"
          >
            {loading ? 'Scanning...' : 'Check'}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {/* Results */}
      {searched && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-white p-4 text-center ring-1 ring-inset ring-purple-100 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Total Txs</div>
              <div className="mt-1 font-mono text-2xl font-bold text-ink-900">{totalTxs}</div>
            </div>
            <div className="rounded-xl bg-white p-4 text-center ring-1 ring-inset ring-purple-100 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Approvals Found</div>
              <div className="mt-1 font-mono text-2xl font-bold text-ink-500">{approvals.length}</div>
            </div>
            <div className="rounded-xl bg-white p-4 text-center ring-1 ring-inset ring-purple-100 shadow-sm sm:col-span-1 col-span-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Unlimited</div>
              <div className="mt-1 font-mono text-2xl font-bold text-red-600">
                {approvals.filter((a) => a.value === 'Unlimited').length}
              </div>
            </div>
          </div>

          {/* Revoke CTA */}
          {approvals.length > 0 && (
            <div className="rounded-xl bg-amber-50 p-5 ring-1 ring-inset ring-amber-200">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-amber-800">Want to revoke approvals?</h3>
                  <p className="mt-1 text-sm text-amber-700">
                    Use Revoke.cash to review and revoke token approvals. It&apos;s the most trusted tool for managing wallet permissions.
                  </p>
                </div>
                <a
                  href={revokeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700"
                >
                  Open Revoke.cash
                </a>
              </div>
            </div>
          )}

          {/* Approvals list */}
          {approvals.length > 0 ? (
            <div>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-600">Token Approvals</h2>
              <div className="space-y-3">
                {approvals.map((a) => (
                  <div key={a.hash} className="rounded-xl bg-white p-4 ring-1 ring-inset ring-purple-100 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-ink-900">
                            Token: <a href={`${EXPLORER_URL}/address/${a.tokenContract}`} target="_blank" rel="noopener noreferrer" className="font-mono text-ink-500 hover:text-ink-600 underline">{shortenAddress(a.tokenContract)}</a>
                          </span>
                        </div>
                        <div className="text-xs text-ink-500">
                          Spender: <a href={`${EXPLORER_URL}/address/${a.spender}`} target="_blank" rel="noopener noreferrer" className="font-mono hover:text-ink-600 underline">
                            {KNOWN_CONTRACTS[a.spender.toLowerCase()] || shortenAddress(a.spender)}
                          </a>
                        </div>
                        <div className="text-xs text-ink-400">{formatDate(a.timestamp)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                          a.value === 'Unlimited'
                            ? 'bg-red-100 text-red-700 ring-red-300'
                            : 'bg-emerald-100 text-emerald-700 ring-emerald-300'
                        }`}>
                          {a.value}
                        </span>
                        <a href={`${EXPLORER_URL}/tx/${a.hash}`} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-ink-400 hover:text-ink-600 underline">tx</a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-emerald-50 p-8 text-center ring-1 ring-inset ring-emerald-200">
              <div className="text-3xl mb-3">Clean!</div>
              <p className="text-sm text-emerald-700">No token approvals found for this wallet on Ink.</p>
            </div>
          )}
        </div>
      )}

      {/* Info section */}
      {!searched && (
        <div>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-600">Why Check Approvals?</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
              <h3 className="text-sm font-semibold text-ink-900">Unlimited Approvals Are Risky</h3>
              <p className="mt-1 text-xs text-ink-600">
                When you approve a DeFi protocol, you often grant unlimited access to your tokens.
                If that contract is compromised, all your approved tokens can be drained.
              </p>
            </div>
            <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
              <h3 className="text-sm font-semibold text-ink-900">Regular Checkups Matter</h3>
              <p className="mt-1 text-xs text-ink-600">
                Review your approvals regularly. Revoke permissions for protocols you no longer use.
                It costs a small gas fee but protects your assets.
              </p>
            </div>
            <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
              <h3 className="text-sm font-semibold text-ink-900">No Wallet Connection Needed</h3>
              <p className="mt-1 text-xs text-ink-600">
                Just paste any Ink address to check. No wallet connection required for viewing.
                To revoke, you&apos;ll use Revoke.cash with your wallet connected.
              </p>
            </div>
            <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
              <h3 className="text-sm font-semibold text-ink-900">Powered by Blockscout</h3>
              <p className="mt-1 text-xs text-ink-600">
                Approval data is fetched from Ink&apos;s Blockscout explorer. All data is public and on-chain.
              </p>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-16 border-t border-purple-200 pt-8 text-sm text-ink-500">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span>Part of Ink Suite · MIT license</span>
          <a href="https://github.com/erdemcrypto3/inksuite" className="hover:text-ink-500" target="_blank" rel="noopener noreferrer">source →</a>
        </div>
      </footer>
    </main>
  );
}
