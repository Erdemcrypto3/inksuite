'use client';

import { InkWalletProvider, ConnectButton, useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from '@inksuite/wallet';
import { useState, useCallback } from 'react';
import { parseEther } from 'viem';
import { INKMINT_ADDRESS, INKMINT_ABI, WALRUS_AGGREGATOR, WALRUS_UPLOAD_PROXY, AI_WORKER_URL } from './components/contract';

const MINT_PRICE = parseEther('0.000777');

type MintStep = 'idle' | 'generating' | 'uploading' | 'minting' | 'confirming' | 'done';

function MintApp() {
  const { address, isConnected } = useAccount();
  const [prompt, setPrompt] = useState('');
  const [step, setStep] = useState<MintStep>('idle');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [mintedTokenId, setMintedTokenId] = useState<number | null>(null);

  const { writeContract } = useWriteContract();
  const { isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  // Contract stats
  const { data: totalSupplyRaw } = useReadContract({
    address: INKMINT_ADDRESS, abi: INKMINT_ABI, functionName: 'totalSupply',
  });
  const { data: maxSupplyRaw } = useReadContract({
    address: INKMINT_ADDRESS, abi: INKMINT_ABI, functionName: 'maxSupply',
  });

  const totalSupply = Number(totalSupplyRaw ?? 0);
  const maxSupply = Number(maxSupplyRaw ?? 10000);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setError(null);
    setImageUrl(null);
    setStep('generating');

    try {
      // Call our Worker to generate image
      const res = await fetch(`${AI_WORKER_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || 'Image generation failed');
      }

      const blob = await res.blob();
      const localUrl = URL.createObjectURL(blob);
      setImageUrl(localUrl);
      setStep('idle');
    } catch (e: any) {
      setError(e.message || 'Generation failed');
      setStep('idle');
    }
  }, [prompt]);

  const handleMint = useCallback(async () => {
    if (!imageUrl || !address) return;
    setError(null);

    try {
      // Upload image to Walrus
      setStep('uploading');
      const imgRes = await fetch(imageUrl);
      const imgBlob = await imgRes.blob();

      const walrusRes = await fetch(WALRUS_UPLOAD_PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'image/png' },
        body: imgBlob,
      });

      if (!walrusRes.ok) throw new Error('Walrus upload failed');
      const walrusData = await walrusRes.json();
      const blobId = walrusData?.newlyCreated?.blobObject?.blobId || walrusData?.alreadyCertified?.blobId;
      if (!blobId) throw new Error('No blob ID from Walrus');

      // Create metadata JSON
      const metadata = {
        name: `InkMint #${totalSupply + 1}`,
        description: `AI-generated NFT on Ink chain. Prompt: "${prompt}"`,
        image: `${WALRUS_AGGREGATOR}/v1/${blobId}`,
        attributes: [
          { trait_type: 'Prompt', value: prompt },
          { trait_type: 'Generator', value: 'Stability AI' },
          { trait_type: 'Chain', value: 'Ink' },
        ],
      };

      // Upload metadata to Walrus
      const metaRes = await fetch(WALRUS_UPLOAD_PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata),
      });

      if (!metaRes.ok) throw new Error('Metadata upload failed');
      const metaData = await metaRes.json();
      const metaBlobId = metaData?.newlyCreated?.blobObject?.blobId || metaData?.alreadyCertified?.blobId;
      if (!metaBlobId) throw new Error('No metadata blob ID');

      const tokenURI = `${WALRUS_AGGREGATOR}/v1/${metaBlobId}`;

      // Mint on-chain
      setStep('minting');
      writeContract({
        address: INKMINT_ADDRESS,
        abi: INKMINT_ABI,
        functionName: 'mint',
        args: [tokenURI, prompt],
        value: MINT_PRICE,
      }, {
        onSuccess: (hash) => {
          setTxHash(hash);
          setStep('confirming');
          setMintedTokenId(totalSupply + 1);
        },
        onError: (e) => {
          setError(e.message);
          setStep('idle');
        },
      });
    } catch (e: any) {
      setError(e.message || 'Mint failed');
      setStep('idle');
    }
  }, [imageUrl, address, prompt, totalSupply, writeContract]);

  const reset = () => {
    setPrompt('');
    setImageUrl(null);
    setStep('idle');
    setError(null);
    setTxHash(undefined);
    setMintedTokenId(null);
  };

  return (
    <div className="space-y-8">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div />
        <ConnectButton showBalance={false} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-white p-4 text-center ring-1 ring-inset ring-purple-100 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Minted</div>
          <div className="mt-1 font-mono text-2xl font-bold text-ink-500">{totalSupply}</div>
        </div>
        <div className="rounded-xl bg-white p-4 text-center ring-1 ring-inset ring-purple-100 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Max Supply</div>
          <div className="mt-1 font-mono text-2xl font-bold text-ink-900">{maxSupply.toLocaleString()}</div>
        </div>
        <div className="rounded-xl bg-white p-4 text-center ring-1 ring-inset ring-purple-100 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Mint Price</div>
          <div className="mt-1 font-mono text-2xl font-bold text-ink-900">0.000777</div>
          <div className="text-[10px] text-ink-400">ETH</div>
        </div>
      </div>

      {/* Confirmed state */}
      {(isConfirmed || step === 'done') && txHash ? (
        <div className="rounded-xl bg-emerald-50 p-8 text-center ring-1 ring-inset ring-emerald-200">
          <div className="text-4xl mb-4">NFT Minted!</div>
          {imageUrl && (
            <img src={imageUrl} alt="Generated NFT" className="mx-auto mb-4 h-48 w-48 rounded-xl object-cover ring-2 ring-emerald-300" />
          )}
          <p className="text-emerald-700 font-semibold">InkMint #{mintedTokenId}</p>
          <p className="mt-1 text-sm text-emerald-600">&quot;{prompt}&quot;</p>
          <a
            href={`https://explorer.inkonchain.com/tx/${txHash}`}
            target="_blank" rel="noopener noreferrer"
            className="mt-3 inline-block text-sm text-ink-500 underline hover:text-ink-600"
          >
            View transaction
          </a>
          <div className="mt-4">
            <button onClick={reset}
              className="rounded-lg bg-ink-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-ink-600">
              Mint Another
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Generator */}
          <div className="rounded-xl bg-white p-6 ring-1 ring-inset ring-purple-100 shadow-sm space-y-4">
            <h2 className="text-xl font-bold text-ink-900">Create Your NFT</h2>
            <p className="text-sm text-ink-600">
              Describe what you want. AI generates the art. Mint it as an NFT on Ink chain.
            </p>

            <div>
              <label className="block text-xs font-semibold text-ink-600 mb-1">Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A cosmic whale swimming through a nebula, digital art, vibrant colors..."
                rows={3}
                disabled={step !== 'idle'}
                className="w-full rounded-lg border border-purple-200 bg-ink-50 px-4 py-3 text-sm text-ink-900 placeholder:text-ink-300 focus:border-ink-500 focus:outline-none resize-y disabled:opacity-50"
              />
            </div>

            {/* Generated image preview */}
            {imageUrl && (
              <div className="flex justify-center">
                <img src={imageUrl} alt="AI Generated" className="h-64 w-64 rounded-xl object-cover ring-2 ring-purple-200 shadow-lg" />
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex items-center gap-3">
              {!imageUrl ? (
                <button
                  onClick={handleGenerate}
                  disabled={step !== 'idle' || !prompt.trim()}
                  className="rounded-lg bg-ink-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-ink-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {step === 'generating' ? (
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Generating...
                    </span>
                  ) : 'Generate Art'}
                </button>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={handleMint}
                    disabled={!isConnected || step !== 'idle'}
                    className="rounded-lg bg-ink-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-ink-600 disabled:opacity-50"
                  >
                    {step === 'uploading' ? 'Uploading...' : step === 'minting' ? 'Confirm in wallet...' : step === 'confirming' ? 'Confirming...' : 'Mint as NFT (0.000777 ETH)'}
                  </button>
                  <button
                    onClick={() => { setImageUrl(null); setStep('idle'); }}
                    disabled={step !== 'idle'}
                    className="rounded-lg bg-white px-4 py-3 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-purple-200 hover:bg-purple-50 disabled:opacity-50"
                  >
                    Regenerate
                  </button>
                </div>
              )}
              {!isConnected && imageUrl && (
                <span className="text-xs text-ink-400">Connect wallet to mint</span>
              )}
            </div>
          </div>

          {/* How it works */}
          <div>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-600">How It Works</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-ink-500 text-sm font-bold text-white">1</div>
                <h3 className="text-sm font-semibold text-ink-900">Describe</h3>
                <p className="mt-1 text-xs text-ink-600">Write a text prompt describing the art you want. Be creative!</p>
              </div>
              <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-ink-500 text-sm font-bold text-white">2</div>
                <h3 className="text-sm font-semibold text-ink-900">Generate</h3>
                <p className="mt-1 text-xs text-ink-600">AI creates a unique image from your prompt. Don&apos;t like it? Regenerate for free.</p>
              </div>
              <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-ink-500 text-sm font-bold text-white">3</div>
                <h3 className="text-sm font-semibold text-ink-900">Mint</h3>
                <p className="mt-1 text-xs text-ink-600">Mint as an ERC-721 NFT on Ink chain (0.000777 ETH). Image stored on Walrus.</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Contract info */}
      <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-600">Contract</h2>
        <div className="space-y-1 text-xs text-ink-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink-700">Address:</span>
            <a href={`https://explorer.inkonchain.com/address/${INKMINT_ADDRESS}`} target="_blank" rel="noopener noreferrer"
              className="font-mono hover:text-ink-600 underline">{INKMINT_ADDRESS.slice(0, 10)}...{INKMINT_ADDRESS.slice(-8)}</a>
          </div>
          <div><span className="font-semibold text-ink-700">Standard:</span> ERC-721</div>
          <div><span className="font-semibold text-ink-700">AI Engine:</span> Stability AI</div>
          <div><span className="font-semibold text-ink-700">Storage:</span> Walrus (decentralized)</div>
        </div>
      </div>
    </div>
  );
}

export default function MintPage() {
  return (
    <InkWalletProvider>
      <main className="mx-auto max-w-2xl px-6 py-10 sm:py-16">
        <header className="mb-8">
          <a href="https://inksuite.xyz"
            className="mb-6 inline-flex items-center gap-2 rounded-lg bg-purple-100 px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-purple-200 shadow-sm transition hover:bg-purple-200 hover:text-ink-900">
            ← inksuite.xyz
          </a>
          <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">InkMint</h1>
          <p className="mt-2 text-sm text-ink-600">AI-powered NFT generator on Ink chain.</p>
        </header>

        <MintApp />

        <footer className="mt-16 border-t border-purple-200 pt-8 text-sm text-ink-500">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span>Part of Ink Suite · MIT license</span>
            <a href="https://github.com/erdemcrypto3/inksuite" className="hover:text-ink-500" target="_blank" rel="noopener noreferrer">source →</a>
          </div>
        </footer>
      </main>
    </InkWalletProvider>
  );
}
