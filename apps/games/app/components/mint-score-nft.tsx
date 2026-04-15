'use client';

import { useState } from 'react';
import { useAccount, useWriteContract } from '@inksuite/wallet';
import { parseEther } from 'viem';

const INKMINT_ADDRESS = '0x964bf77C2cF0901F0acFaC277601816d2dbEACEe' as const;
const INKMINT_ABI = [
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'uri', type: 'string' },
      { name: 'prompt', type: 'string' },
    ],
    outputs: [],
  },
] as const;
const MINT_FEE = parseEther('0.000577');
const API_URL = 'https://api.inksuite.xyz';

type Props = {
  gameId: string;
  gameTitle: string;
  gameIcon: string;
  score: number;
};

export function MintScoreNFTButton({ gameId, gameTitle, gameIcon, score }: Props) {
  const { address, isConnected } = useAccount();
  const { writeContract, isPending } = useWriteContract();
  const [minted, setMinted] = useState(false);
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isConnected || score <= 0) return null;

  const handleMint = async () => {
    if (!address) return;
    setError(null);
    setMinting(true);
    try {
      const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
      const timestamp = new Date().toISOString();
      const dateLabel = new Date().toLocaleDateString();

      // Build an SVG image with the game icon, title, score, and timestamp
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'>
  <defs>
    <linearGradient id='bg' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='#7C3AED'/>
      <stop offset='1' stop-color='#4338CA'/>
    </linearGradient>
  </defs>
  <rect width='400' height='400' fill='url(#bg)'/>
  <text x='200' y='130' font-size='110' text-anchor='middle' dominant-baseline='middle'>${gameIcon}</text>
  <text x='200' y='220' font-size='32' font-family='sans-serif' font-weight='bold' text-anchor='middle' fill='#fff'>${gameTitle}</text>
  <text x='200' y='280' font-size='56' font-family='monospace' font-weight='bold' text-anchor='middle' fill='#FCD34D'>${score} pts</text>
  <text x='200' y='340' font-size='18' font-family='sans-serif' text-anchor='middle' fill='#E9D5FF'>${dateLabel}</text>
  <text x='200' y='370' font-size='14' font-family='monospace' text-anchor='middle' fill='#C4B5FD'>${shortAddr}</text>
</svg>`;

      const imgRes = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'image/svg+xml' },
        body: svg,
      });
      if (!imgRes.ok) throw new Error('Image upload failed');
      const imgData = await imgRes.json();

      const metadata = {
        name: `${gameTitle} — ${score} pts`,
        description: `${gameIcon} ${gameTitle} score of ${score} by ${shortAddr} on Ink Game Hub. Minted ${dateLabel}.`,
        image: imgData.url,
        attributes: [
          { trait_type: 'Game', value: gameTitle },
          { trait_type: 'Icon', value: gameIcon },
          { trait_type: 'Score', value: score.toString() },
          { trait_type: 'Wallet', value: shortAddr },
          { trait_type: 'Timestamp', value: timestamp },
          { display_type: 'date', trait_type: 'Minted', value: Math.floor(Date.now() / 1000) },
        ],
      };
      const metaRes = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata),
      });
      if (!metaRes.ok) throw new Error('Metadata upload failed');
      const metaData = await metaRes.json();

      writeContract(
        {
          address: INKMINT_ADDRESS,
          abi: INKMINT_ABI,
          functionName: 'mint',
          args: [metaData.url, `${gameIcon} ${gameTitle}: ${score} pts @ ${dateLabel}`],
          value: MINT_FEE,
        },
        {
          onSuccess: () => setMinted(true),
          onError: (e) => {
            setError(e.message || 'Mint failed');
            setMinting(false);
          },
        },
      );
    } catch (e: any) {
      setError(e.message || 'Mint failed');
      setMinting(false);
    }
  };

  if (minted) {
    return (
      <div className="mt-3 text-center text-xs font-semibold text-emerald-600">
        Score NFT Minted!
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col items-center gap-1">
      <button
        onClick={handleMint}
        disabled={isPending || minting}
        className="rounded-lg bg-ink-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-ink-600 disabled:opacity-50 disabled:cursor-wait"
      >
        {isPending || minting ? 'Minting…' : `Mint Score NFT (0.000577 ETH)`}
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
