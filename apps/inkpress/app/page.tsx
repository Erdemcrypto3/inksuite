'use client';

import { InkWalletProvider, ConnectButton, useAccount, useReadContract, useWriteContract, useSendTransaction, useWaitForTransactionReceipt } from '@inksuite/wallet';
import { useState, useEffect, useCallback } from 'react';
import { toHex } from 'viem';
import { CONTRACT_ADDRESS, INKPRESS_ABI, WALRUS_AGGREGATOR, WALRUS_UPLOAD_PROXY, BLOG_TAGS } from './components/contract';

type Article = {
  walrusBlobId: string;
  title: string;
  description: string;
  coverImageBlobId: string;
  author: string;
  totalMinted: bigint;
  publishedAt: bigint;
  active: boolean;
  tags: string[];
};

type View = 'feed' | 'read' | 'write' | 'apply';

/* ── Article Card ── */
function ArticleCard({ article, index, onRead }: { article: Article; index: number; onRead: (a: Article, i: number) => void }) {
  const date = new Date(Number(article.publishedAt) * 1000);
  return (
    <button
      onClick={() => onRead(article, index)}
      className="group w-full rounded-xl bg-white p-6 text-left ring-1 ring-inset ring-purple-100 shadow-sm transition hover:bg-purple-50 hover:ring-ink-500"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-lg font-semibold text-ink-900 group-hover:text-ink-600">{article.title}</h3>
        {article.tags.length > 0 && (
          <span className="shrink-0 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-ink-600 ring-1 ring-inset ring-purple-200">
            {article.tags[0]}
          </span>
        )}
      </div>
      {article.description && <p className="mb-2 text-sm text-ink-600 line-clamp-2">{article.description}</p>}
      <div className="flex items-center gap-3 text-xs text-ink-500">
        <span className="font-mono">{article.author.slice(0, 6)}...{article.author.slice(-4)}</span>
        <span>{date.toLocaleDateString()}</span>
        <span>{Number(article.totalMinted)} collected</span>
      </div>
    </button>
  );
}

/* ── Article Reader ── */
function ArticleReader({ article, articleId, onBack }: { article: Article; articleId: number; onBack: () => void }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const { address } = useAccount();
  const { writeContract, isPending: isMinting } = useWriteContract();

  useEffect(() => {
    if (!article.walrusBlobId) { setContent('Content not available.'); setLoading(false); return; }
    fetch(`${WALRUS_AGGREGATOR}/v1/${article.walrusBlobId}`)
      .then((r) => r.text()).then(setContent)
      .catch(() => setContent('Failed to load content from Walrus.'))
      .finally(() => setLoading(false));
  }, [article.walrusBlobId]);

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="inline-flex items-center gap-2 rounded-lg bg-purple-100 px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-purple-200 shadow-sm transition hover:bg-purple-200">
        ← Back
      </button>
      <article className="rounded-xl bg-white p-8 ring-1 ring-inset ring-purple-100 shadow-sm">
        <h1 className="mb-4 text-3xl font-bold text-ink-900">{article.title}</h1>
        <div className="mb-6 flex items-center gap-3 text-sm text-ink-500">
          <span className="font-mono">{article.author.slice(0, 6)}...{article.author.slice(-4)}</span>
          <span>{new Date(Number(article.publishedAt) * 1000).toLocaleDateString()}</span>
          {article.tags.length > 0 && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-ink-600">{article.tags[0]}</span>}
        </div>
        {loading ? (
          <div className="py-12 text-center text-ink-400">Loading content from Walrus...</div>
        ) : (
          <div className="prose max-w-none text-ink-800 leading-relaxed whitespace-pre-wrap">{content}</div>
        )}
        {address && (
          <div className="mt-8 border-t border-purple-100 pt-6 flex items-center gap-4">
            <button
              onClick={() => writeContract({
                address: CONTRACT_ADDRESS, abi: INKPRESS_ABI,
                functionName: 'mintArticle', args: [BigInt(articleId)],
              })}
              disabled={isMinting}
              className="rounded-lg bg-ink-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-ink-600 disabled:opacity-50"
            >
              {isMinting ? 'Minting...' : 'Collect as NFT'}
            </button>
            <span className="text-xs text-ink-400">{Number(article.totalMinted)} already collected</span>
          </div>
        )}
      </article>
    </div>
  );
}

/* ── Write Article (approved authors only) ── */
function WriteArticle({ onBack, onPublished }: { onBack: () => void; onPublished: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tag, setTag] = useState<string>(BLOG_TAGS[0]);
  const [step, setStep] = useState<'write' | 'uploading' | 'publishing' | 'done'>('write');
  const [error, setError] = useState<string | null>(null);
  const { writeContract, isPending } = useWriteContract();

  const handlePublish = useCallback(async () => {
    if (!title.trim() || !body.trim()) { setError('Title and content are required.'); return; }
    setError(null);
    setStep('uploading');

    try {
      // Upload content via Worker proxy (Walrus PUT needs server-side, CORS blocks browser PUT)
      const res = await fetch(WALRUS_UPLOAD_PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: body,
      });
      if (!res.ok) throw new Error('Walrus upload failed');
      const data = await res.json();
      const blobId = data?.newlyCreated?.blobObject?.blobId || data?.alreadyCertified?.blobId;
      if (!blobId) throw new Error('No blob ID returned');

      setStep('publishing');
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: INKPRESS_ABI,
        functionName: 'publishArticle',
        args: [blobId, title, '', '', [tag]],
      }, {
        onSuccess: () => { setStep('done'); setTimeout(onPublished, 2000); },
        onError: (e) => { setError(e.message); setStep('write'); },
      });
    } catch (e: any) {
      setError(e.message || 'Upload failed');
      setStep('write');
    }
  }, [title, body, tag, writeContract, onPublished]);

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="inline-flex items-center gap-2 rounded-lg bg-purple-100 px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-purple-200 shadow-sm transition hover:bg-purple-200">
        ← Back
      </button>

      {step === 'done' ? (
        <div className="rounded-xl bg-emerald-50 p-8 text-center ring-1 ring-inset ring-emerald-200">
          <div className="text-4xl mb-4">Published!</div>
          <p className="text-emerald-700">Your article is now live on Ink chain. Redirecting...</p>
        </div>
      ) : (
        <div className="rounded-xl bg-white p-6 ring-1 ring-inset ring-purple-100 shadow-sm space-y-4">
          <h2 className="text-xl font-bold text-ink-900">Write Article</h2>

          <div>
            <label className="block text-xs font-semibold text-ink-600 mb-1">Title</label>
            <input
              value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Article title..."
              className="w-full rounded-lg border border-purple-200 bg-ink-50 px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 focus:border-ink-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-600 mb-1">Tag</label>
            <select
              value={tag} onChange={(e) => setTag(e.target.value)}
              className="rounded-lg border border-purple-200 bg-ink-50 px-4 py-2.5 text-sm text-ink-900 focus:border-ink-500 focus:outline-none"
            >
              {BLOG_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-600 mb-1">Content</label>
            <textarea
              value={body} onChange={(e) => setBody(e.target.value)}
              placeholder="Write your article here..."
              rows={12}
              className="w-full rounded-lg border border-purple-200 bg-ink-50 px-4 py-3 text-sm text-ink-900 placeholder:text-ink-300 focus:border-ink-500 focus:outline-none resize-y"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              onClick={handlePublish}
              disabled={step !== 'write' || !title.trim() || !body.trim()}
              className="rounded-lg bg-ink-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-ink-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {step === 'uploading' ? 'Uploading to Walrus...' : step === 'publishing' ? 'Confirm in wallet...' : 'Publish Article'}
            </button>
            <span className="text-xs text-ink-400">Content stored on Walrus, metadata on Ink chain</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Become a Writer Application ── */
function ApplyWriter({ onBack }: { onBack: () => void }) {
  const { address } = useAccount();
  const [message, setMessage] = useState('');
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const { sendTransaction, isPending } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const handleApply = () => {
    if (!address || !message.trim()) return;
    const calldata = toHex(`inkpress:apply:${message}`);
    sendTransaction(
      { to: CONTRACT_ADDRESS, value: BigInt(0), data: calldata },
      { onSuccess: (hash) => setTxHash(hash) },
    );
  };

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="inline-flex items-center gap-2 rounded-lg bg-purple-100 px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-purple-200 shadow-sm transition hover:bg-purple-200">
        ← Back
      </button>

      <div className="rounded-xl bg-white p-6 ring-1 ring-inset ring-purple-100 shadow-sm space-y-4">
        <h2 className="text-xl font-bold text-ink-900">Become a Writer</h2>
        <p className="text-sm text-ink-600">
          Submit an on-chain application to become an approved writer on InkPress.
          The platform admin will review your application and approve your wallet address.
        </p>

        {isSuccess ? (
          <div className="rounded-xl bg-emerald-50 p-6 ring-1 ring-inset ring-emerald-200">
            <p className="font-semibold text-emerald-700">Application submitted!</p>
            <p className="mt-1 text-sm text-emerald-600">Your wallet address has been recorded. You&apos;ll be able to write once approved.</p>
            {txHash && (
              <a href={`https://explorer.inkonchain.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                className="mt-2 inline-block text-sm text-ink-500 underline hover:text-ink-600">
                View transaction
              </a>
            )}
          </div>
        ) : (
          <>
            <div>
              <label className="block text-xs font-semibold text-ink-600 mb-1">Your wallet</label>
              <div className="rounded-lg bg-ink-50 px-4 py-2.5 font-mono text-sm text-ink-700">
                {address || 'Connect wallet first'}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-600 mb-1">Why do you want to write?</label>
              <textarea
                value={message} onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us a bit about yourself and what you'd like to write about..."
                rows={4}
                className="w-full rounded-lg border border-purple-200 bg-ink-50 px-4 py-3 text-sm text-ink-900 placeholder:text-ink-300 focus:border-ink-500 focus:outline-none resize-y"
              />
            </div>
            <button
              onClick={handleApply}
              disabled={isPending || isConfirming || !message.trim() || !address}
              className="rounded-lg bg-ink-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-ink-600 disabled:opacity-50"
            >
              {isPending ? 'Confirm in wallet...' : isConfirming ? 'Submitting...' : 'Submit Application'}
            </button>
            <p className="text-[10px] text-ink-400">This sends a 0-value tx with your message as calldata. Costs only gas.</p>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Main Blog Feed ── */
function BlogFeed() {
  const { address, isConnected } = useAccount();
  const [view, setView] = useState<View>('feed');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);

  // Read articles from contract
  const { data: articlesRaw, refetch } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: INKPRESS_ABI,
    functionName: 'getArticles',
    args: [0n, 50n],
  });

  // Check if connected user is approved author or owner
  const { data: isApproved } = useReadContract(
    address
      ? {
          address: CONTRACT_ADDRESS,
          abi: INKPRESS_ABI,
          functionName: 'approvedAuthors',
          args: [address],
        }
      : undefined,
  );
  const { data: contractOwner } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: INKPRESS_ABI,
    functionName: 'owner',
  });
  const isAuthor = isApproved === true || (contractOwner && address && contractOwner.toString().toLowerCase() === address.toLowerCase());

  // getArticles returns [Article[], total]
  const articlesData = articlesRaw as [Article[], bigint] | undefined;
  const articles = articlesData?.[0] ?? [];
  const activeArticles = articles.filter((a) => a.active);
  const totalArticles = Number(articlesData?.[1] ?? 0);
  const totalMints = articles.reduce((s, a) => s + Number(a.totalMinted), 0);
  const uniqueAuthors = new Set(articles.map((a) => a.author)).size;

  // Article reader view
  if (view === 'read' && selectedArticle !== null && selectedArticleId !== null) {
    return <ArticleReader article={selectedArticle} articleId={selectedArticleId} onBack={() => { setView('feed'); setSelectedArticle(null); setSelectedArticleId(null); }} />;
  }

  // Write article view
  if (view === 'write') {
    return <WriteArticle onBack={() => setView('feed')} onPublished={() => { refetch(); setView('feed'); }} />;
  }

  // Apply to be writer view
  if (view === 'apply') {
    return <ApplyWriter onBack={() => setView('feed')} />;
  }

  return (
    <div className="space-y-8">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {isConnected && isAuthor && (
            <button onClick={() => setView('write')}
              className="rounded-lg bg-ink-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-ink-600">
              Write Article
            </button>
          )}
          {isConnected && !isAuthor && (
            <button onClick={() => setView('apply')}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-purple-200 shadow-sm hover:bg-purple-50">
              Become a Writer
            </button>
          )}
        </div>
        <ConnectButton showBalance={false} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-white p-4 text-center ring-1 ring-inset ring-purple-100 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Articles</div>
          <div className="mt-1 font-mono text-2xl font-bold text-ink-500">{totalArticles}</div>
        </div>
        <div className="rounded-xl bg-white p-4 text-center ring-1 ring-inset ring-purple-100 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Collected</div>
          <div className="mt-1 font-mono text-2xl font-bold text-ink-900">{totalMints}</div>
        </div>
        <div className="rounded-xl bg-white p-4 text-center ring-1 ring-inset ring-purple-100 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Writers</div>
          <div className="mt-1 font-mono text-2xl font-bold text-ink-900">{uniqueAuthors}</div>
        </div>
      </div>

      {/* Hero */}
      <div className="rounded-xl bg-gradient-to-br from-ink-500 to-ink-700 p-8 text-white shadow-lg">
        <h2 className="text-2xl font-bold sm:text-3xl">Decentralized Blog on Ink</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/80">
          Read articles and collect them as ERC-1155 NFTs on Ink chain. Content stored on
          Walrus (decentralized storage). Want to write? Apply to become an approved writer.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-white/20 px-3 py-1">ERC-1155 NFTs</span>
          <span className="rounded-full bg-white/20 px-3 py-1">Walrus Storage</span>
          <span className="rounded-full bg-white/20 px-3 py-1">Ink Chain</span>
          <span className="rounded-full bg-white/20 px-3 py-1">0.0005 ETH per mint</span>
        </div>
      </div>

      {/* Connected user info */}
      {isConnected && (
        <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Your Status</div>
              <div className="mt-1 flex items-center gap-2">
                {isAuthor ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-300">
                    Approved Writer
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-ink-600 ring-1 ring-inset ring-purple-200">
                    Reader
                  </span>
                )}
              </div>
            </div>
            {isAuthor ? (
              <button onClick={() => setView('write')}
                className="rounded-lg bg-ink-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-ink-600">
                Write Article
              </button>
            ) : (
              <button onClick={() => setView('apply')}
                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-purple-200 hover:bg-purple-50">
                Apply to Write
              </button>
            )}
          </div>
        </div>
      )}

      {/* Articles list */}
      {activeArticles.length > 0 ? (
        <div>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-600">Latest Articles</h2>
          <div className="space-y-3">
            {activeArticles.map((article, i) => (
              <ArticleCard key={i} index={i} article={article} onRead={(a, idx) => { setSelectedArticle(a); setSelectedArticleId(idx); setView('read'); }} />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-white p-8 text-center ring-1 ring-inset ring-purple-100 shadow-sm">
          <div className="text-3xl mb-3">No articles yet</div>
          <p className="text-sm text-ink-500">Articles will appear here once writers start publishing.</p>
          {!isConnected && <p className="mt-2 text-xs text-ink-400">Connect your wallet to collect articles or apply to write.</p>}
        </div>
      )}

      {/* How it works */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-600">How It Works</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-ink-500 text-sm font-bold text-white">1</div>
            <h3 className="text-sm font-semibold text-ink-900">Read Articles</h3>
            <p className="mt-1 text-xs text-ink-600">Browse articles published by approved writers. All content stored on decentralized Walrus.</p>
          </div>
          <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-ink-500 text-sm font-bold text-white">2</div>
            <h3 className="text-sm font-semibold text-ink-900">Collect as NFT</h3>
            <p className="mt-1 text-xs text-ink-600">Like an article? Collect it as an ERC-1155 NFT (0.0005 ETH). Authors earn from every collect.</p>
          </div>
          <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-ink-500 text-sm font-bold text-white">3</div>
            <h3 className="text-sm font-semibold text-ink-900">Want to Write?</h3>
            <p className="mt-1 text-xs text-ink-600">Apply to become a writer. Once approved, you can publish articles on InkPress.</p>
          </div>
        </div>
      </div>

      {/* Contract info */}
      <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-600">Contract</h2>
        <div className="space-y-1 text-xs text-ink-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink-700">Address:</span>
            <a href={`https://explorer.inkonchain.com/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer"
              className="font-mono hover:text-ink-600 underline">{CONTRACT_ADDRESS.slice(0, 10)}...{CONTRACT_ADDRESS.slice(-8)}</a>
          </div>
          <div><span className="font-semibold text-ink-700">Chain:</span> Ink Mainnet (57073)</div>
          <div><span className="font-semibold text-ink-700">Standard:</span> ERC-1155 (UUPS Upgradeable)</div>
          <div><span className="font-semibold text-ink-700">Storage:</span> Walrus (decentralized)</div>
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
          <a href="https://inksuite.xyz"
            className="mb-6 inline-flex items-center gap-2 rounded-lg bg-purple-100 px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-purple-200 shadow-sm transition hover:bg-purple-200 hover:text-ink-900">
            ← inksuite.xyz
          </a>
          <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">InkPress</h1>
          <p className="mt-2 text-sm text-ink-600">Decentralized blog on Ink chain. Read articles, collect them as NFTs.</p>
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
