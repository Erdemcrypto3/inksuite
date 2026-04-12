'use client';

import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from '@inksuite/wallet';
import { toHex } from 'viem';
import { useState } from 'react';

type Props = {
  gameId: string;
  score: number;
};

export function RecordScore({ gameId, score }: Props) {
  const { address, isConnected } = useAccount();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const { sendTransaction, isPending } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  if (!isConnected || score <= 0) return null;

  const calldata = toHex(`inksuite:${gameId}:${score}`);

  const handleRecord = () => {
    if (!address) return;
    sendTransaction(
      { to: address, value: BigInt(0), data: calldata },
      { onSuccess: (hash) => setTxHash(hash) },
    );
  };

  if (isSuccess && txHash) {
    return (
      <div className="mt-3 text-center">
        <span className="text-xs text-emerald-600 font-semibold">Score recorded on-chain!</span>
        <a
          href={`https://explorer.inkonchain.com/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 text-xs text-ink-500 underline hover:text-ink-600"
        >
          View tx
        </a>
      </div>
    );
  }

  return (
    <button
      onClick={handleRecord}
      disabled={isPending || isConfirming}
      className="mt-3 rounded-lg bg-ink-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-ink-600 disabled:opacity-50 disabled:cursor-wait"
    >
      {isPending ? 'Confirm in wallet...' : isConfirming ? 'Recording...' : `Record ${score} pts on-chain`}
    </button>
  );
}
