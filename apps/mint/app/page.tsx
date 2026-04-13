'use client';

import { InkWalletProvider, ConnectButton, useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useSendTransaction } from '@inksuite/wallet';
import { useState, useEffect, useCallback } from 'react';
import { parseEther } from 'viem';
import { INKMINT_ADDRESS, INKMINT_ABI, WALRUS_AGGREGATOR, WALRUS_UPLOAD_PROXY, AI_WORKER_URL } from './components/contract';

const GENERATION_FEE = parseEther('0.0002');
const MINT_FEE = parseEther('0.000577');
const FEE_RECIPIENT = '0x9E84D77264d94C646dF91A70dbae99C20330eAD0' as const;

type Step = 'prompt' | 'paying' | 'generating' | 'preview' | 'uploading' | 'minting' | 'confirming' | 'done';

function MintApp() {
  const { address, isConnected } = useAccount();
  const [prompt, setPrompt] = useState('');
  const [step, setStep] = useState<Step>('prompt');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payTxHash, setPayTxHash] = useState<`0x${string}` | undefined>();
  const [mintTxHash, setMintTxHash] = useState<`0x${string}` | undefined>();
  const [mintedTokenId, setMintedTokenId] = useState<number | null>(null);

  const { sendTransaction, isPending: isPayPending } = useSendTransaction();
  const { isSuccess: isPayConfirmed, isLoading: isPayWaiting } = useWaitForTransactionReceipt({ hash: payTxHash });
  const { writeContract } = useWriteContract();
  const { isSuccess: isMintConfirmed } = useWaitForTransactionReceipt({ hash: mintTxHash });

  const { data: totalSupplyRaw } = useReadContract({
    address: INKMINT_ADDRESS, abi: INKMINT_ABI, functionName: 'totalSupply',
  });
  const { data: maxSupplyRaw } = useReadContract({
    address: INKMINT_ADDRESS, abi: INKMINT_ABI, functionName: 'maxSupply',
  });

  const totalSupply = Number(totalSupplyRaw ?? 0);
  const maxSupply = Number(maxSupplyRaw ?? 10000);

  // Step 1: Pay generation fee
  const handlePay = useCallback(() => {
    if (!address || !prompt.trim()) return;
    setError(null);
    setStep('paying');
    sendTransaction(
      { to: FEE_RECIPIENT, value: GENERATION_FEE },
      {
        onSuccess: (hash) => setPayTxHash(hash),
        onError: (e) => { setError(e.message); setStep('prompt'); },
      },
    );
  }, [address, prompt, sendTransaction]);

  // Step 2: After payment confirmed, generate image
  const generateImage = useCallback(async (txh: string) => {
    setStep('generating');
    // Wait for Blockscout to index the tx
    await new Promise((r) => setTimeout(r, 8000));

    try {
      const res = await fetch(`${AI_WORKER_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), txHash: txh }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Generation failed' }));
        throw new Error(errData.error || `Generation failed: ${res.status}`);
      }

      const blob = await res.blob();
      const localUrl = URL.createObjectURL(blob);
      setImageUrl(localUrl);
      setImageBlob(blob);
      setStep('preview');
    } catch (e: any) {
      setError(e.message || 'Generation failed');
      setStep('prompt');
    }
  }, [prompt]);

  // Watch for payment confirmation
  useEffect(() => {
    if (isPayConfirmed && payTxHash && step === 'paying') {
      generateImage(payTxHash);
    }
  }, [isPayConfirmed, payTxHash, step, generateImage]);

  // Step 3: Mint as NFT
  const handleMint = useCallback(async () => {
    if (!imageBlob || !address) return;
    setError(null);
    setStep('uploading');

    try {
      // Upload image to Walrus via proxy
      const walrusRes = await fetch(WALRUS_UPLOAD_PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'image/png' },
        body: imageBlob,
      });
      if (!walrusRes.ok) throw new Error('Image upload failed');
      const walrusData = await walrusRes.json();
      const blobId = walrusData?.newlyCreated?.blobObject?.blobId || walrusData?.alreadyCertified?.blobId;
      if (!blobId) throw new Error('No blob ID');

      // Upload metadata
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

      // Mint on contract
      setStep('minting');
      writeContract({
        address: INKMINT_ADDRESS,
        abi: INKMINT_ABI,
        functionName: 'mint',
        args: [tokenURI, prompt],
        value: MINT_FEE,
      }, {
        onSuccess: (hash) => {
          setMintTxHash(hash);
          setStep('confirming');
          setMintedTokenId(totalSupply + 1);
        },
        onError: (e) => { setError(e.message); setStep('preview'); },
      });
    } catch (e: any) {
      setError(e.message || 'Mint failed');
      setStep('preview');
    }
  }, [imageBlob, address, prompt, totalSupply, writeContract]);

  const reset = () => {
    setPrompt('');
    setImageUrl(null);
    setImageBlob(null);
    setStep('prompt');
    setError(null);
    setPayTxHash(undefined);
    setMintTxHash(undefined);
    setMintedTokenId(null);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div />
        <ConnectButton showBalance />
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
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Total Cost</div>
          <div className="mt-1 font-mono text-2xl font-bold text-ink-900">0.000777</div>
          <div className="text-[10px] text-ink-400">ETH (generate + mint)</div>
        </div>
      </div>

      {/* Mint success */}
      {(isMintConfirmed || step === 'done') && mintTxHash ? (
        <div className="rounded-xl bg-emerald-50 p-8 text-center ring-1 ring-inset ring-emerald-200">
          <div className="text-4xl mb-4">NFT Minted!</div>
          {imageUrl && <img src={imageUrl} alt="NFT" className="mx-auto mb-4 h-48 w-48 rounded-xl object-cover ring-2 ring-emerald-300" />}
          <p className="text-emerald-700 font-semibold">InkMint #{mintedTokenId}</p>
          <p className="mt-1 text-sm text-emerald-600">&quot;{prompt}&quot;</p>
          <a href={`https://explorer.inkonchain.com/tx/${mintTxHash}`} target="_blank" rel="noopener noreferrer"
            className="mt-3 inline-block text-sm text-ink-500 underline">View transaction</a>
          <div className="mt-4">
            <button onClick={reset} className="rounded-lg bg-ink-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-ink-600">
              Mint Another
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Main flow */}
          <div className="rounded-xl bg-white p-6 ring-1 ring-inset ring-purple-100 shadow-sm space-y-4">
            <h2 className="text-xl font-bold text-ink-900">Create Your NFT</h2>

            {/* Step indicator */}
            <div className="flex items-center gap-2 text-xs">
              <span className={`rounded-full px-2.5 py-1 font-semibold ${step === 'prompt' ? 'bg-ink-500 text-white' : 'bg-ink-100 text-ink-600'}`}>1. Prompt</span>
              <span className="text-ink-300">→</span>
              <span className={`rounded-full px-2.5 py-1 font-semibold ${step === 'paying' || step === 'generating' ? 'bg-ink-500 text-white' : imageUrl ? 'bg-emerald-100 text-emerald-600' : 'bg-ink-100 text-ink-600'}`}>2. Pay & Generate</span>
              <span className="text-ink-300">→</span>
              <span className={`rounded-full px-2.5 py-1 font-semibold ${step === 'preview' || step === 'uploading' || step === 'minting' || step === 'confirming' ? 'bg-ink-500 text-white' : 'bg-ink-100 text-ink-600'}`}>3. Mint</span>
            </div>

            {/* Prompt input */}
            <div>
              <label className="block text-xs font-semibold text-ink-600 mb-1">Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A cosmic whale swimming through a nebula, digital art, vibrant colors..."
                rows={3}
                disabled={step !== 'prompt'}
                className="w-full rounded-lg border border-purple-200 bg-ink-50 px-4 py-3 text-sm text-ink-900 placeholder:text-ink-300 focus:border-ink-500 focus:outline-none resize-y disabled:opacity-50"
              />
            </div>

            {/* Image preview */}
            {imageUrl && (
              <div className="flex justify-center">
                <img src={imageUrl} alt="AI Generated" className="h-64 w-64 rounded-xl object-cover ring-2 ring-purple-200 shadow-lg" />
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            {/* Action buttons */}
            <div className="space-y-3">
              {step === 'prompt' && (
                isConnected ? (
                  <button onClick={handlePay} disabled={!prompt.trim()}
                    className="w-full rounded-lg bg-ink-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-ink-600 disabled:opacity-50 disabled:cursor-not-allowed">
                    Generate Art (0.0002 ETH)
                  </button>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-ink-500 mb-3">Connect wallet to generate art</p>
                  </div>
                )
              )}

              {step === 'paying' && (
                <div className="text-center py-4">
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-ink-500 border-t-transparent" />
                  <p className="mt-2 text-sm text-amber-600">{isPayPending ? 'Confirm payment in wallet...' : 'Waiting for confirmation...'}</p>
                </div>
              )}

              {step === 'generating' && (
                <div className="text-center py-4">
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-ink-500 border-t-transparent" />
                  <p className="mt-2 text-sm text-ink-600">Payment confirmed! Generating your art...</p>
                  <p className="text-xs text-ink-400">This may take 10-15 seconds</p>
                </div>
              )}

              {step === 'preview' && (
                <button onClick={handleMint}
                  className="w-full rounded-lg bg-ink-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-ink-600">
                  Mint as NFT (0.000577 ETH)
                </button>
              )}

              {step === 'uploading' && (
                <div className="text-center py-2">
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-ink-500 border-t-transparent" />
                  <p className="mt-2 text-sm text-ink-600">Uploading to decentralized storage...</p>
                </div>
              )}

              {step === 'minting' && (
                <div className="text-center py-2">
                  <p className="text-sm text-amber-600">Confirm mint in wallet...</p>
                </div>
              )}

              {step === 'confirming' && (
                <div className="text-center py-2">
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                  <p className="mt-2 text-sm text-emerald-600">Minting... waiting for confirmation</p>
                </div>
              )}
            </div>

            {/* Pricing breakdown */}
            {step === 'prompt' && (
              <div className="rounded-lg bg-ink-50 p-3 text-xs text-ink-500">
                <div className="flex justify-between"><span>AI Generation fee</span><span className="font-mono">0.0002 ETH</span></div>
                <div className="flex justify-between"><span>NFT Mint fee</span><span className="font-mono">0.000577 ETH</span></div>
                <div className="flex justify-between border-t border-purple-200 mt-1 pt-1 font-semibold text-ink-700"><span>Total</span><span className="font-mono">0.000777 ETH</span></div>
              </div>
            )}
          </div>

          {/* How it works */}
          <div>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-600">How It Works</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-ink-500 text-sm font-bold text-white">1</div>
                <h3 className="text-sm font-semibold text-ink-900">Describe & Pay</h3>
                <p className="mt-1 text-xs text-ink-600">Write your prompt and pay 0.0002 ETH generation fee. AI creates your unique art.</p>
              </div>
              <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-ink-500 text-sm font-bold text-white">2</div>
                <h3 className="text-sm font-semibold text-ink-900">Preview</h3>
                <p className="mt-1 text-xs text-ink-600">See your generated art. Like it? Proceed to mint.</p>
              </div>
              <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-ink-500 text-sm font-bold text-white">3</div>
                <h3 className="text-sm font-semibold text-ink-900">Mint</h3>
                <p className="mt-1 text-xs text-ink-600">Mint as ERC-721 NFT (0.000577 ETH). Image stored on decentralized storage.</p>
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
          <div><span className="font-semibold text-ink-700">Storage:</span> Decentralized (Walrus)</div>
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
          <p className="mt-2 text-sm text-ink-600">AI-powered NFT generator on Ink chain. Pay, generate, mint.</p>
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
