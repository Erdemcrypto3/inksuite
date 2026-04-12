'use client';

import { InkWalletProvider, ConnectButton, useAccount, useReadContract, useWriteContract, useSendTransaction } from '@inksuite/wallet';
import { useState, useEffect } from 'react';
import { formatEther, parseEther } from 'viem';
import { CONTRACT_ADDRESS, INKPRESS_ABI, WALRUS_AGGREGATOR, BLOG_TAGS } from './components/contract';

const IS_DEPLOYED = CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000';

type Article = {
  id: bigint;
  author: string;
  title: string;
  contentBlobId: string;
  tag: string;
  timestamp: bigint;
  mintPrice: bigint;
  totalMinted: bigint;
  isActive: boolean;
};

function ArticleCard({ article, onRead }: { article: Article; onRead: (a: Article) => void }) {
  const date = new Date(Number(article.timestamp) * 1000);
  return (
    <button
      onClick={() => onRead(article)}
      className="group w-full rounded-xl bg-white p-6 text-left ring-1 ring-inset ring-purple-100 shadow-sm transition hover:bg-purple-50 hover:ring-ink-500"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-lg font-semibold text-ink-900 group-hover:text-ink-600">{article.title}</h3>
        <span className="shrink-0 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-ink-600 ring-1 ring-inset ring-purple-200">
          {article.tag}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-ink-500">
        <span className="font-mono">{article.author.slice(0, 6)}...{article.author.slice(-4)}</span>
        <span>{date.toLocaleDateString()}</span>
        <span>{Number(article.totalMinted)} minted</span>
        {article.mintPrice > 0n && (
          <span>{formatEther(article.mintPrice)} ETH</span>
        )}
      </div>
    </button>
  );
}

function ArticleReader({ article, onBack }: { article: Article; onBack: () => void }) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const { address } = useAccount();
  const { writeContract, isPending: isMinting } = useWriteContract();

  useEffect(() => {
    if (!article.contentBlobId) {
      setContent('Content not available.');
      setLoading(false);
      return;
    }
    fetch(`${WALRUS_AGGREGATOR}/v1/${article.contentBlobId}`)
      .then((r) => r.text())
      .then(setContent)
      .catch(() => setContent('Failed to load content from Walrus.'))
      .finally(() => setLoading(false));
  }, [article.contentBlobId]);

  const handleMint = () => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: INKPRESS_ABI,
      functionName: 'mintArticle',
      args: [article.id],
      value: article.mintPrice,
    });
  };

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 rounded-lg bg-purple-100 px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-purple-200 shadow-sm transition hover:bg-purple-200"
      >
        ← Back to articles
      </button>
      <article className="rounded-xl bg-white p-8 ring-1 ring-inset ring-purple-100 shadow-sm">
        <h1 className="mb-4 text-3xl font-bold text-ink-900">{article.title}</h1>
        <div className="mb-6 flex items-center gap-3 text-sm text-ink-500">
          <span className="font-mono">{article.author.slice(0, 6)}...{article.author.slice(-4)}</span>
          <span>{new Date(Number(article.timestamp) * 1000).toLocaleDateString()}</span>
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-ink-600">{article.tag}</span>
        </div>
        {loading ? (
          <div className="py-12 text-center text-ink-400">Loading content from Walrus...</div>
        ) : (
          <div className="prose prose-ink max-w-none" dangerouslySetInnerHTML={{ __html: content }} />
        )}
        {address && (
          <div className="mt-8 border-t border-purple-100 pt-6">
            <button
              onClick={handleMint}
              disabled={isMinting}
              className="rounded-lg bg-ink-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-ink-600 disabled:opacity-50"
            >
              {isMinting ? 'Minting...' : `Collect as NFT ${article.mintPrice > 0n ? `(${formatEther(article.mintPrice)} ETH)` : '(Free)'}`}
            </button>
          </div>
        )}
      </article>
    </div>
  );
}

function BlogFeed() {
  const { isConnected } = useAccount();
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  // Read articles from contract (only if deployed)
  const { data: articlesRaw } = useReadContract(
    IS_DEPLOYED
      ? {
          address: CONTRACT_ADDRESS,
          abi: INKPRESS_ABI,
          functionName: 'getArticles',
          args: [0n, 50n],
        }
      : undefined,
  );

  const articles = (articlesRaw as Article[] | undefined) ?? [];

  if (selectedArticle) {
    return <ArticleReader article={selectedArticle} onBack={() => setSelectedArticle(null)} />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div />
        <ConnectButton showBalance={false} />
      </div>

      {/* Hero */}
      <div className="rounded-xl bg-gradient-to-br from-ink-500 to-ink-700 p-8 text-white shadow-lg">
        <h2 className="text-2xl font-bold sm:text-3xl">Decentralized Blog on Ink</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/80">
          Publish articles as ERC-1155 NFTs. Content stored on Walrus (decentralized storage).
          Readers can collect articles they love. Authors earn from mints.
        </p>
        <div className="mt-4 flex gap-3 text-xs">
          <span className="rounded-full bg-white/20 px-3 py-1">ERC-1155 NFTs</span>
          <span className="rounded-full bg-white/20 px-3 py-1">Walrus Storage</span>
          <span className="rounded-full bg-white/20 px-3 py-1">Ink Chain</span>
        </div>
      </div>

      {!IS_DEPLOYED && (
        <div className="rounded-xl bg-amber-50 p-6 ring-1 ring-inset ring-amber-200">
          <h3 className="text-sm font-semibold text-amber-800">Contract Deployment Pending</h3>
          <p className="mt-1 text-sm text-amber-700">
            The InkPress smart contract is being deployed to Ink mainnet. Once live, you&apos;ll be able to
            publish and collect articles here. The contract is an ERC-1155 blog platform originally built
            as BasePress on Base chain, now ported to Ink.
          </p>
          <a
            href="https://github.com/erdemcrypto3/inksuite"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm font-medium text-amber-800 underline hover:text-amber-900"
          >
            View contract source on GitHub →
          </a>
        </div>
      )}

      {/* How it works */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
          <div className="mb-2 text-2xl">1</div>
          <h3 className="text-sm font-semibold text-ink-900">Connect Wallet</h3>
          <p className="mt-1 text-xs text-ink-600">Connect your wallet to publish or collect articles on Ink chain.</p>
        </div>
        <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
          <div className="mb-2 text-2xl">2</div>
          <h3 className="text-sm font-semibold text-ink-900">Write & Publish</h3>
          <p className="mt-1 text-xs text-ink-600">Content is stored on Walrus. Article metadata is on-chain as an ERC-1155 token.</p>
        </div>
        <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
          <div className="mb-2 text-2xl">3</div>
          <h3 className="text-sm font-semibold text-ink-900">Collect & Earn</h3>
          <p className="mt-1 text-xs text-ink-600">Readers mint articles as NFTs. Authors earn from every mint. Revenue splits built in.</p>
        </div>
      </div>

      {/* Articles list */}
      {articles.length > 0 && (
        <div>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-600">
            Latest Articles
          </h2>
          <div className="space-y-3">
            {articles
              .filter((a: Article) => a.isActive)
              .map((article: Article) => (
                <ArticleCard key={String(article.id)} article={article} onRead={setSelectedArticle} />
              ))}
          </div>
        </div>
      )}

      {/* Features */}
      <div className="rounded-xl bg-white p-6 ring-1 ring-inset ring-purple-100 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-600">Platform Features</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
            <span className="text-ink-700">Article NFTs (ERC-1155)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
            <span className="text-ink-700">Decentralized storage (Walrus)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
            <span className="text-ink-700">Author revenue splits</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
            <span className="text-ink-700">UUPS upgradeable proxy</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
            <span className="text-ink-700">Tag-based organization</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
            <span className="text-ink-700">Pausable & admin controls</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InkPressPage() {
  return (
    <InkWalletProvider>
      <main className="mx-auto max-w-3xl px-6 py-10 sm:py-16">
        <header className="mb-8">
          <a
            href="https://inksuite.xyz"
            className="mb-6 inline-flex items-center gap-2 rounded-lg bg-purple-100 px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-purple-200 shadow-sm transition hover:bg-purple-200 hover:text-ink-900"
          >
            ← inksuite.xyz
          </a>
          <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
            InkPress
          </h1>
          <p className="mt-2 text-sm text-ink-600">
            Publish &amp; collect articles as NFTs on Ink chain.
          </p>
        </header>

        <BlogFeed />

        <footer className="mt-16 border-t border-purple-200 pt-8 text-sm text-ink-500">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span>Part of Ink Suite · MIT license · Ported from BasePress</span>
            <a href="https://github.com/erdemcrypto3/inksuite" className="hover:text-ink-500" target="_blank" rel="noopener noreferrer">source →</a>
          </div>
        </footer>
      </main>
    </InkWalletProvider>
  );
}
