'use client';

import { InkWalletProvider, ConnectButton, useAccount, useSendTransaction, useWaitForTransactionReceipt, useBalance } from '@inksuite/wallet';
import { useState, useEffect, useCallback } from 'react';
import { parseEther, formatEther, isAddress, getAddress, toHex } from 'viem';
import { EXPLORER_URL } from '@inksuite/chain';

const PRESET_AMOUNTS = ['0.0001', '0.0005', '0.001', '0.005', '0.01'];

// Ink Suite tip address (for "Tip Us" feature)
const INKSUITE_ADDRESS = '0x9E84D77264d94C646dF91A70dbae99C20330eAD0';

// [PAI-0030] Trusted recipient set. Any ?to= deviating from this set must
// trigger an explicit "this is NOT the default" confirmation before sending.
const TRUSTED_RECIPIENTS = new Set<string>([INKSUITE_ADDRESS.toLowerCase()]);

type TipRecord = { to: string; amount: string; txHash: string; message: string; date: string };

function loadTipHistory(): TipRecord[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('inksuite-tip-history') || '[]'); } catch { return []; }
}

function saveTip(tip: TipRecord) {
  const history = loadTipHistory();
  history.unshift(tip);
  if (history.length > 50) history.length = 50;
  localStorage.setItem('inksuite-tip-history', JSON.stringify(history));
}

function TipForm({ recipient: defaultRecipient, fromUrl }: { recipient?: string; fromUrl?: boolean }) {
  const { address, isConnected } = useAccount();
  const [recipient, setRecipient] = useState(defaultRecipient || '');
  const [amount, setAmount] = useState('0.001');
  const [message, setMessage] = useState('');
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<string | null>(null);
  // [PAI-0030] When recipient is supplied via ?to= and is NOT a trusted
  // address, force an explicit confirmation checkbox before Send is enabled.
  const [externalAck, setExternalAck] = useState(false);

  const { sendTransaction, isPending } = useSendTransaction();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const isUntrustedExternal = !!(
    fromUrl &&
    recipient &&
    isAddress(recipient) &&
    !TRUSTED_RECIPIENTS.has(recipient.toLowerCase())
  );

  useEffect(() => {
    if (isSuccess && txHash) {
      saveTip({ to: recipient, amount, txHash, message, date: new Date().toISOString() });
    }
  }, [isSuccess, txHash, recipient, amount, message]);

  const handleTip = useCallback(() => {
    const to = recipient.trim();
    if (!isAddress(to)) { setError('Invalid address'); return; }
    if (!amount || Number(amount) <= 0) { setError('Invalid amount'); return; }
    setError(null);

    const calldata = message.trim() ? toHex(`inktip:${message.trim()}`) : undefined;

    sendTransaction(
      { to: to as `0x${string}`, value: parseEther(amount), data: calldata },
      { onSuccess: (hash) => setTxHash(hash) },
    );
  }, [recipient, amount, message, sendTransaction]);

  if (isSuccess && txHash) {
    return (
      <div className="rounded-xl bg-emerald-50 p-8 text-center ring-1 ring-inset ring-emerald-200">
        <div className="text-4xl mb-4">Tip Sent!</div>
        <p className="text-emerald-700 font-semibold">{amount} ETH → {recipient.slice(0, 8)}...{recipient.slice(-6)}</p>
        {message && <p className="mt-1 text-sm text-emerald-600">&quot;{message}&quot;</p>}
        <a href={`${EXPLORER_URL}/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
          className="mt-3 inline-block text-sm text-ink-500 underline">View transaction</a>
        <div className="mt-4">
          <button onClick={() => { setTxHash(undefined); setMessage(''); }}
            className="rounded-lg bg-ink-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-ink-600">
            Send Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-6 ring-1 ring-inset ring-purple-100 shadow-sm space-y-4">
      <h2 className="text-lg font-bold text-ink-900">Send a Tip</h2>

      {/* [PAI-0030] Untrusted-recipient warning — full address shown,
          explicit checkbox required before Send becomes enabled. */}
      {isUntrustedExternal && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 space-y-2">
          <div className="text-sm font-semibold">⚠ Custom recipient from URL</div>
          <p className="text-xs leading-relaxed">
            This tip will be sent to a custom address taken from the page URL,
            <strong> NOT </strong> to the Ink Suite team. Verify the full
            address below matches who you intend to tip:
          </p>
          <div className="break-all font-mono text-[11px] bg-white px-2 py-1.5 rounded ring-1 ring-amber-200 text-ink-900">
            {recipient}
          </div>
          <label className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={externalAck}
              onChange={(e) => setExternalAck(e.target.checked)}
              className="mt-0.5"
            />
            <span>I understand this is NOT the Ink Suite team address.</span>
          </label>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-ink-600 mb-1">Recipient Address</label>
        <input
          value={recipient} onChange={(e) => setRecipient(e.target.value)}
          placeholder="0x..."
          className="w-full rounded-lg border border-purple-200 bg-ink-50 px-4 py-2.5 font-mono text-sm text-ink-900 placeholder:text-ink-300 focus:border-ink-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-ink-600 mb-1">Amount (ETH)</label>
        <div className="flex gap-2 mb-2 flex-wrap">
          {PRESET_AMOUNTS.map((a) => (
            <button key={a} onClick={() => setAmount(a)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition ${
                amount === a ? 'bg-ink-500 text-white ring-ink-600' : 'bg-white text-ink-700 ring-purple-200 hover:ring-ink-500'
              }`}>
              {a} ETH
            </button>
          ))}
        </div>
        <input
          type="number" step="0.0001" min="0.0001"
          value={amount} onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-lg border border-purple-200 bg-ink-50 px-4 py-2.5 font-mono text-sm text-ink-900 focus:border-ink-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-ink-600 mb-1">Message (optional)</label>
        <input
          value={message} onChange={(e) => setMessage(e.target.value)}
          placeholder="Thanks for the great work!"
          maxLength={100}
          className="w-full rounded-lg border border-purple-200 bg-ink-50 px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 focus:border-ink-500 focus:outline-none"
        />
        <p className="mt-1 text-[10px] text-ink-400">Message is encoded in the transaction calldata (on-chain forever)</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {isConnected ? (
        <button
          onClick={handleTip}
          disabled={isPending || !recipient.trim() || (isUntrustedExternal && !externalAck)}
          className="w-full rounded-lg bg-ink-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-ink-600 disabled:opacity-50">
          {isPending ? 'Confirm in wallet...' : `Send ${amount} ETH`}
        </button>
      ) : (
        <p className="text-center text-sm text-ink-400">Connect wallet to send a tip</p>
      )}
    </div>
  );
}

function TipApp() {
  const { isConnected } = useAccount();
  const [history, setHistory] = useState<TipRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => { setHistory(loadTipHistory()); }, []);

  // Check URL for recipient param
  const [urlRecipient, setUrlRecipient] = useState<string | undefined>();
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const to = params.get('to');
    // [LOW-03] Normalize to EIP-55 checksum so downstream string compares stay stable
    if (to && isAddress(to)) {
      try { setUrlRecipient(getAddress(to)); } catch { /* invalid checksum, ignore */ }
    }
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div />
        <ConnectButton showBalance />
      </div>

      {/* Tip Ink Suite */}
      <div className="rounded-xl bg-gradient-to-br from-ink-500 to-ink-700 p-6 text-white shadow-lg">
        <h2 className="text-xl font-bold">Support Ink Suite</h2>
        <p className="mt-2 text-sm text-white/80">
          Like what we built? Send a tip to the Ink Suite team. Every tip is on-chain and transparent.
        </p>
        <div className="mt-3 font-mono text-xs text-white/60">{INKSUITE_ADDRESS}</div>
      </div>

      {/* Tip form — flag fromUrl=true so PAI-0030 warning fires for untrusted ?to= */}
      <TipForm recipient={urlRecipient || INKSUITE_ADDRESS} fromUrl={!!urlRecipient} />

      {/* Share your tip link */}
      {isConnected && (
        <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
          <h3 className="text-sm font-semibold text-ink-900">Your Tip Link</h3>
          <p className="mt-1 text-xs text-ink-600">Share this link to receive tips from anyone on Ink.</p>
          <ShareLink />
        </div>
      )}

      {/* How it works */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-ink-500 text-sm font-bold text-white">1</div>
          <h3 className="text-sm font-semibold text-ink-900">Enter Address</h3>
          <p className="mt-1 text-xs text-ink-600">Paste any Ink wallet address or use a shared tip link.</p>
        </div>
        <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-ink-500 text-sm font-bold text-white">2</div>
          <h3 className="text-sm font-semibold text-ink-900">Choose Amount</h3>
          <p className="mt-1 text-xs text-ink-600">Pick a preset or enter custom amount. Add an optional message.</p>
        </div>
        <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-ink-500 text-sm font-bold text-white">3</div>
          <h3 className="text-sm font-semibold text-ink-900">Send On-chain</h3>
          <p className="mt-1 text-xs text-ink-600">Tip goes directly to the recipient. No middleman, no fees beyond gas.</p>
        </div>
      </div>

      {/* Tip history */}
      {history.length > 0 && (
        <div>
          <button onClick={() => setShowHistory(!showHistory)}
            className="text-sm font-semibold text-ink-600 hover:text-ink-900">
            {showHistory ? 'Hide' : 'Show'} Tip History ({history.length})
          </button>
          {showHistory && (
            <div className="mt-3 space-y-2">
              {history.slice(0, 20).map((tip, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-white p-3 text-xs ring-1 ring-inset ring-purple-100">
                  <div>
                    <span className="font-mono text-ink-700">{tip.to.slice(0, 8)}...{tip.to.slice(-4)}</span>
                    {tip.message && <span className="ml-2 text-ink-400">&quot;{tip.message}&quot;</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-ink-500">{tip.amount} ETH</span>
                    <a href={`${EXPLORER_URL}/tx/${tip.txHash}`} target="_blank" rel="noopener noreferrer" className="text-ink-400 underline">tx</a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ShareLink() {
  const { address } = useAccount();
  const [copied, setCopied] = useState(false);
  if (!address) return null;
  const link = `https://tip.inksuite.xyz/?to=${address}`;
  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="mt-2 flex gap-2">
      <input value={link} readOnly className="flex-1 rounded-lg bg-ink-50 px-3 py-2 font-mono text-[10px] text-ink-600" />
      <button onClick={handleCopy} className="rounded-lg bg-ink-500 px-3 py-2 text-xs font-semibold text-white hover:bg-ink-600">
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}

export default function TipPage() {
  return (
    <InkWalletProvider>
      <main className="mx-auto max-w-2xl px-6 py-10 sm:py-16">
        <header className="mb-8">
          <a href="https://inksuite.xyz"
            className="mb-6 inline-flex items-center gap-2 rounded-lg bg-purple-100 px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-purple-200 shadow-sm transition hover:bg-purple-200 hover:text-ink-900">
            ← inksuite.xyz
          </a>
          <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">InkTip</h1>
          <p className="mt-2 text-sm text-ink-600">Send on-chain tips to anyone on Ink. No middleman.</p>
        </header>

        <TipApp />

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
