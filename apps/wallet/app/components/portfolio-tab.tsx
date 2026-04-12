'use client';

import { useEffect, useState } from 'react';
import { formatEther, formatUnits, type Address } from 'viem';
import { inkPublicClient, BLOCKSCOUT_API_URL, EXPLORER_URL } from '@inksuite/chain';
import { MetricCard } from './metric-card';

type TokenBalance = {
  contractAddress: string;
  name: string;
  symbol: string;
  decimals: string;
  balance: string;
  type: string;
};

type PortfolioData = {
  ethBalanceWei: bigint;
  tokens: TokenBalance[];
  erc20Tokens: TokenBalance[];
  nftTokens: TokenBalance[];
};

type SubTab = 'overview' | 'tokens' | 'nfts';

async function fetchPortfolio(address: Address): Promise<PortfolioData> {
  const [ethBalanceWei, tokenRes] = await Promise.all([
    inkPublicClient.getBalance({ address }),
    fetch(`${BLOCKSCOUT_API_URL}?module=account&action=tokenlist&address=${address}`).then((r) => r.json()),
  ]);

  let tokens: TokenBalance[] = [];
  if (tokenRes.status === '1' && Array.isArray(tokenRes.result)) {
    tokens = tokenRes.result;
  }

  const erc20Tokens = tokens.filter((t) => t.type === 'ERC-20');
  const nftTokens = tokens.filter((t) => t.type === 'ERC-721' || t.type === 'ERC-1155');

  return { ethBalanceWei, tokens, erc20Tokens, nftTokens };
}

function formatBalance(balance: string, decimals: string): string {
  try {
    const d = Number(decimals) || 18;
    const val = Number(formatUnits(BigInt(balance), d));
    if (val === 0) return '0';
    if (val >= 1000) return val.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (val >= 1) return val.toFixed(4);
    if (val >= 0.0001) return val.toFixed(6);
    return val.toExponential(2);
  } catch {
    return '?';
  }
}

function formatEthBalance(wei: bigint): string {
  const eth = Number(formatEther(wei));
  if (eth === 0) return '0';
  if (eth >= 1) return eth.toFixed(4);
  if (eth >= 0.0001) return eth.toFixed(6);
  return eth.toExponential(2);
}

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function PortfolioTab({ address }: { address: Address }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PortfolioData | null>(null);
  const [subTab, setSubTab] = useState<SubTab>('overview');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchPortfolio(address)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Unknown error'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [address]);

  if (loading) return <div className="py-12 text-center text-ink-100/50">Loading portfolio…</div>;
  if (error) return (
    <div className="rounded-lg bg-red-500/10 p-4 text-sm text-red-300 ring-1 ring-inset ring-red-500/30">
      <strong>Error:</strong> {error}
    </div>
  );
  if (!data) return null;

  return (
    <>
      <div className="mb-6 flex gap-1 rounded-lg bg-white/5 p-1 ring-1 ring-inset ring-white/10">
        {(['overview', 'tokens', 'nfts'] as SubTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider transition ${
              subTab === tab
                ? 'bg-ink-500 text-white shadow-sm'
                : 'text-ink-100/50 hover:bg-white/5 hover:text-ink-100'
            }`}
          >
            {tab === 'overview' ? 'Overview' : tab === 'tokens' ? `Tokens (${data.erc20Tokens.length})` : `NFTs (${data.nftTokens.length})`}
          </button>
        ))}
      </div>

      {subTab === 'overview' && (
        <>
          <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="ETH balance" value={formatEthBalance(data.ethBalanceWei)} unit="ETH" />
            <MetricCard label="ERC-20 tokens" value={data.erc20Tokens.length.toString()} />
            <MetricCard label="NFTs held" value={data.nftTokens.length.toString()} />
            <MetricCard label="Total assets" value={(1 + data.erc20Tokens.length + data.nftTokens.length).toString()} dim />
          </section>

          {data.erc20Tokens.length > 0 && (
            <section className="mb-6">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-100/50">Top tokens</h3>
              <div className="overflow-hidden rounded-xl bg-white/5 ring-1 ring-inset ring-white/10">
                <table className="w-full text-sm">
                  <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-ink-100/40">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Token</th>
                      <th className="px-4 py-3 text-right font-medium">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data.erc20Tokens.slice(0, 5).map((t) => (
                      <tr key={t.contractAddress} className="hover:bg-white/5">
                        <td className="px-4 py-3">
                          <span className="font-semibold text-ink-50">{t.symbol || '?'}</span>
                          <span className="ml-2 text-ink-100/40">{t.name || 'Unknown'}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-ink-50">
                          {formatBalance(t.balance, t.decimals)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      {subTab === 'tokens' && (
        <section>
          <div className="mb-4 rounded-xl bg-white/5 p-5 ring-1 ring-inset ring-white/10">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-100/60">Native ETH</span>
              <span className="font-mono text-lg font-semibold text-ink-50">
                {formatEthBalance(data.ethBalanceWei)} <span className="text-sm font-normal text-ink-100/40">ETH</span>
              </span>
            </div>
          </div>

          {data.erc20Tokens.length === 0 ? (
            <div className="py-12 text-center text-ink-100/40">No ERC-20 tokens found for this address.</div>
          ) : (
            <div className="overflow-hidden rounded-xl bg-white/5 ring-1 ring-inset ring-white/10">
              <table className="w-full text-sm">
                <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-ink-100/40">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Token</th>
                    <th className="px-4 py-3 text-left font-medium">Contract</th>
                    <th className="px-4 py-3 text-right font-medium">Balance</th>
                    <th className="px-4 py-3 text-right font-medium">Explorer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.erc20Tokens.map((t) => (
                    <tr key={t.contractAddress} className="hover:bg-white/5">
                      <td className="px-4 py-3">
                        <span className="font-semibold text-ink-50">{t.symbol || '?'}</span>
                        <span className="ml-2 text-ink-100/40">{t.name || 'Unknown'}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-100/50">{shortAddress(t.contractAddress)}</td>
                      <td className="px-4 py-3 text-right font-mono text-ink-50">{formatBalance(t.balance, t.decimals)}</td>
                      <td className="px-4 py-3 text-right">
                        <a href={`${EXPLORER_URL}/token/${t.contractAddress}`} target="_blank" rel="noopener noreferrer" className="text-ink-500 hover:underline">open →</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {subTab === 'nfts' && (
        <section>
          {data.nftTokens.length === 0 ? (
            <div className="py-12 text-center text-ink-100/40">No NFTs found for this address.</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.nftTokens.map((t) => (
                <div
                  key={`${t.contractAddress}-${t.balance}`}
                  className="rounded-xl bg-white/5 p-5 ring-1 ring-inset ring-white/10"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-ink-50">{t.name || 'Unknown NFT'}</div>
                      <div className="text-xs text-ink-100/40">{t.symbol || '—'} · {t.type}</div>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-ink-500/10 px-2 py-0.5 text-xs font-medium text-ink-100 ring-1 ring-inset ring-ink-500/30">
                      ×{t.balance || '1'}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-mono text-xs text-ink-100/40">{shortAddress(t.contractAddress)}</span>
                    <a href={`${EXPLORER_URL}/token/${t.contractAddress}`} target="_blank" rel="noopener noreferrer" className="text-xs text-ink-500 hover:underline">view →</a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
