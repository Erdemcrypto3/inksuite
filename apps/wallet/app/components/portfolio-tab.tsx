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
  ethPrice: number | null;
  tokens: TokenBalance[];
  erc20Tokens: TokenBalance[];
  nftTokens: TokenBalance[];
};

type SubTab = 'overview' | 'tokens' | 'nfts';

// Known legitimate tokens on Ink — matched by symbol (case-insensitive)
const VERIFIED_SYMBOLS = new Set([
  'WETH', 'USDC', 'USDC.E', 'USDT', 'DAI', 'WBTC',
  'INK', 'OP', 'VELO', 'AERO',
]);

// Symbols that map to known USD prices
const STABLECOINS = new Set(['USDC', 'USDC.E', 'USDT', 'DAI', 'FRAX', 'LUSD']);
const ETH_PEGGED = new Set(['WETH', 'STETH', 'WSTETH', 'CBETH', 'RETH']);

function isVerified(symbol: string): boolean {
  return VERIFIED_SYMBOLS.has(symbol.toUpperCase());
}

function getTokenUsdPrice(symbol: string, ethPrice: number | null): number | null {
  const upper = symbol.toUpperCase();
  if (STABLECOINS.has(upper)) return 1;
  if (ETH_PEGGED.has(upper) && ethPrice) return ethPrice;
  return null;
}

async function fetchEthPrice(): Promise<number | null> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.ethereum?.usd ?? null;
  } catch {
    return null;
  }
}

async function fetchPortfolio(address: Address): Promise<PortfolioData> {
  const [ethBalanceWei, tokenRes, ethPrice] = await Promise.all([
    inkPublicClient.getBalance({ address }),
    fetch(`${BLOCKSCOUT_API_URL}?module=account&action=tokenlist&address=${address}`).then((r) =>
      r.json(),
    ),
    fetchEthPrice(),
  ]);

  let tokens: TokenBalance[] = [];
  if (tokenRes.status === '1' && Array.isArray(tokenRes.result)) {
    tokens = tokenRes.result;
  }

  const erc20Tokens = tokens.filter((t) => t.type === 'ERC-20');
  const nftTokens = tokens.filter((t) => t.type === 'ERC-721' || t.type === 'ERC-1155');

  return { ethBalanceWei, ethPrice, tokens, erc20Tokens, nftTokens };
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

function formatUsd(value: number | null): string {
  if (value === null) return '—';
  if (value >= 1000) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.01) return `$${value.toFixed(4)}`;
  if (value === 0) return '$0';
  return `$${value.toExponential(2)}`;
}

function getTokenUsdValue(
  balance: string,
  decimals: string,
  symbol: string,
  ethPrice: number | null,
): number | null {
  const price = getTokenUsdPrice(symbol, ethPrice);
  if (price === null) return null;
  try {
    const d = Number(decimals) || 18;
    const amount = Number(formatUnits(BigInt(balance), d));
    return amount * price;
  } catch {
    return null;
  }
}

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function VerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${
        verified
          ? 'bg-emerald-50 text-emerald-700 ring-emerald-300'
          : 'bg-amber-50 text-amber-700 ring-amber-300'
      }`}
    >
      {verified ? '✓ Verified' : '⚠ Unverified'}
    </span>
  );
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
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unknown error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [address]);

  if (loading) return <div className="py-12 text-center text-ink-600">Loading portfolio…</div>;
  if (error)
    return (
      <div className="rounded-lg bg-red-500/10 p-4 text-sm text-red-600 ring-1 ring-inset ring-red-500/30">
        <strong>Error:</strong> {error}
      </div>
    );
  if (!data) return null;

  // Calculate total portfolio USD value
  const ethUsdValue =
    data.ethPrice !== null ? Number(formatEther(data.ethBalanceWei)) * data.ethPrice : null;

  let totalUsdValue = ethUsdValue ?? 0;
  let hasAnyPrice = ethUsdValue !== null;
  const tokenValues: Map<string, number | null> = new Map();

  for (const t of data.erc20Tokens) {
    const val = getTokenUsdValue(t.balance, t.decimals, t.symbol, data.ethPrice);
    tokenValues.set(t.contractAddress, val);
    if (val !== null) {
      totalUsdValue += val;
      hasAnyPrice = true;
    }
  }

  return (
    <>
      <div className="mb-6 flex gap-1 rounded-lg bg-purple-50/50 p-1 ring-1 ring-inset ring-purple-100">
        {(['overview', 'tokens', 'nfts'] as SubTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider transition ${
              subTab === tab
                ? 'bg-ink-500 text-white shadow-sm'
                : 'text-ink-600 hover:bg-purple-50 hover:text-ink-800'
            }`}
          >
            {tab === 'overview'
              ? 'Overview'
              : tab === 'tokens'
              ? `Tokens (${data.erc20Tokens.length})`
              : `NFTs (${data.nftTokens.length})`}
          </button>
        ))}
      </div>

      {subTab === 'overview' && (
        <>
          <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="ETH balance"
              value={formatEthBalance(data.ethBalanceWei)}
              unit="ETH"
            />
            <MetricCard
              label="Portfolio value"
              value={hasAnyPrice ? formatUsd(totalUsdValue) : '—'}
            />
            <MetricCard label="ERC-20 tokens" value={data.erc20Tokens.length.toString()} />
            <MetricCard label="NFTs held" value={data.nftTokens.length.toString()} />
          </section>

          {data.ethPrice !== null && (
            <div className="mb-6 text-xs text-ink-500">
              ETH price: ${data.ethPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })} ·
              Source: CoinGecko
            </div>
          )}

          {data.erc20Tokens.length > 0 && (
            <section className="mb-6">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-600">
                Top tokens
              </h3>
              <div className="overflow-hidden rounded-xl bg-white ring-1 ring-inset ring-purple-100 shadow-sm">
                <table className="w-full text-sm">
                  <thead className="border-b border-purple-200 text-xs uppercase tracking-wider text-ink-500">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Token</th>
                      <th className="px-4 py-3 text-center font-medium">Status</th>
                      <th className="px-4 py-3 text-right font-medium">Balance</th>
                      <th className="px-4 py-3 text-right font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-100">
                    {data.erc20Tokens.slice(0, 5).map((t) => {
                      const usdVal = tokenValues.get(t.contractAddress) ?? null;
                      return (
                        <tr key={t.contractAddress} className="hover:bg-purple-50">
                          <td className="px-4 py-3">
                            <span className="font-semibold text-ink-900">
                              {t.symbol || '?'}
                            </span>
                            <span className="ml-2 text-ink-500">{t.name || 'Unknown'}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <VerifiedBadge verified={isVerified(t.symbol)} />
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-ink-900">
                            {formatBalance(t.balance, t.decimals)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-ink-700">
                            {formatUsd(usdVal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      {subTab === 'tokens' && (
        <section>
          <div className="mb-4 rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-ink-700">Native ETH</span>
                <span className="ml-2">
                  <VerifiedBadge verified={true} />
                </span>
              </div>
              <div className="text-right">
                <span className="font-mono text-lg font-semibold text-ink-900">
                  {formatEthBalance(data.ethBalanceWei)}{' '}
                  <span className="text-sm font-normal text-ink-500">ETH</span>
                </span>
                {ethUsdValue !== null && (
                  <div className="text-xs font-mono text-ink-500">{formatUsd(ethUsdValue)}</div>
                )}
              </div>
            </div>
          </div>

          {data.erc20Tokens.length === 0 ? (
            <div className="py-12 text-center text-ink-500">
              No ERC-20 tokens found for this address.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl bg-white ring-1 ring-inset ring-purple-100 shadow-sm">
              <table className="w-full text-sm">
                <thead className="border-b border-purple-200 text-xs uppercase tracking-wider text-ink-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Token</th>
                    <th className="px-4 py-3 text-center font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Balance</th>
                    <th className="px-4 py-3 text-right font-medium">Value</th>
                    <th className="px-4 py-3 text-right font-medium">Explorer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-100">
                  {data.erc20Tokens.map((t) => {
                    const usdVal = tokenValues.get(t.contractAddress) ?? null;
                    const verified = isVerified(t.symbol);
                    return (
                      <tr
                        key={t.contractAddress}
                        className={`hover:bg-purple-50 ${!verified ? 'opacity-60' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <div>
                            <span className="font-semibold text-ink-900">
                              {t.symbol || '?'}
                            </span>
                            <span className="ml-2 text-ink-500">{t.name || 'Unknown'}</span>
                          </div>
                          <div className="mt-0.5 font-mono text-[10px] text-ink-400">
                            {shortAddress(t.contractAddress)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <VerifiedBadge verified={verified} />
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-ink-900">
                          {formatBalance(t.balance, t.decimals)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-ink-700">
                          {formatUsd(usdVal)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <a
                            href={`${EXPLORER_URL}/token/${t.contractAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-ink-500 hover:underline"
                          >
                            open →
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-3 text-xs text-ink-400">
            Prices for ETH, WETH, and major stablecoins via CoinGecko. Unverified tokens are
            dimmed — they may be spam or airdrop tokens. Always verify on the explorer before
            interacting.
          </p>
        </section>
      )}

      {subTab === 'nfts' && (
        <section>
          {data.nftTokens.length === 0 ? (
            <div className="py-12 text-center text-ink-500">
              No NFTs found for this address.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.nftTokens.map((t) => (
                <div
                  key={`${t.contractAddress}-${t.balance}`}
                  className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-ink-900">
                        {t.name || 'Unknown NFT'}
                      </div>
                      <div className="text-xs text-ink-500">
                        {t.symbol || '—'} · {t.type}
                      </div>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-ink-700 ring-1 ring-inset ring-purple-300">
                      ×{t.balance || '1'}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-mono text-xs text-ink-500">
                      {shortAddress(t.contractAddress)}
                    </span>
                    <a
                      href={`${EXPLORER_URL}/token/${t.contractAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-ink-500 hover:underline"
                    >
                      view →
                    </a>
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
