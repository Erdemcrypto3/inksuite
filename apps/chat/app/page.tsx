'use client';

import { InkWalletProvider, ConnectButton, useAccount, useSendTransaction, useWaitForTransactionReceipt } from '@inksuite/wallet';
import { useState, useEffect, useCallback } from 'react';
import { isAddress, toHex } from 'viem';
import { BLOCKSCOUT_API_URL, EXPLORER_URL } from '@inksuite/chain';

type Message = {
  from: string;
  to: string;
  text: string;
  txHash: string;
  timestamp: number;
  direction: 'sent' | 'received';
};

const MSG_PREFIX = 'inkchat:';

function decodeMessage(input: string): string | null {
  if (!input || input === '0x') return null;
  try {
    const hex = input.startsWith('0x') ? input.slice(2) : input;
    const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
    const text = new TextDecoder().decode(bytes);
    if (text.startsWith(MSG_PREFIX)) return text.slice(MSG_PREFIX.length);
    return null;
  } catch { return null; }
}

function shortenAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function ChatApp() {
  const { address, isConnected } = useAccount();
  const [peerAddress, setPeerAddress] = useState('');
  const [activePeer, setActivePeer] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [newMsg, setNewMsg] = useState('');
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<string | null>(null);

  const { sendTransaction, isPending } = useSendTransaction();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // Load conversation between address and activePeer
  const loadMessages = useCallback(async () => {
    if (!address || !activePeer) return;
    setLoading(true);
    setMessages([]);

    try {
      // Fetch sent txs (from me to peer)
      const sentUrl = `${BLOCKSCOUT_API_URL}?module=account&action=txlist&address=${address}&startblock=0&endblock=latest&sort=desc&page=1&offset=500`;
      const sentRes = await fetch(sentUrl);
      const sentData = await sentRes.json();

      // Fetch received txs (from peer to me)
      const recvUrl = `${BLOCKSCOUT_API_URL}?module=account&action=txlist&address=${activePeer}&startblock=0&endblock=latest&sort=desc&page=1&offset=500`;
      const recvRes = await fetch(recvUrl);
      const recvData = await recvRes.json();

      const allMsgs: Message[] = [];

      // Parse sent
      if (sentData.status === '1' && Array.isArray(sentData.result)) {
        for (const tx of sentData.result) {
          if (tx.from.toLowerCase() !== address.toLowerCase()) continue;
          if (tx.to.toLowerCase() !== activePeer.toLowerCase()) continue;
          if (tx.isError !== '0') continue;
          const text = decodeMessage(tx.input);
          if (text) {
            allMsgs.push({
              from: tx.from, to: tx.to, text, txHash: tx.hash,
              timestamp: Number(tx.timeStamp), direction: 'sent',
            });
          }
        }
      }

      // Parse received
      if (recvData.status === '1' && Array.isArray(recvData.result)) {
        for (const tx of recvData.result) {
          if (tx.from.toLowerCase() !== activePeer.toLowerCase()) continue;
          if (tx.to.toLowerCase() !== address.toLowerCase()) continue;
          if (tx.isError !== '0') continue;
          const text = decodeMessage(tx.input);
          if (text) {
            allMsgs.push({
              from: tx.from, to: tx.to, text, txHash: tx.hash,
              timestamp: Number(tx.timeStamp), direction: 'received',
            });
          }
        }
      }

      allMsgs.sort((a, b) => a.timestamp - b.timestamp);
      setMessages(allMsgs);
    } catch {
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [address, activePeer]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  // Reload after sending
  useEffect(() => {
    if (isSuccess) {
      setTimeout(loadMessages, 3000); // Wait for indexing
      setNewMsg('');
      setTxHash(undefined);
    }
  }, [isSuccess, loadMessages]);

  const handleSend = useCallback(() => {
    if (!activePeer || !newMsg.trim() || !address) return;
    setError(null);
    const calldata = toHex(`${MSG_PREFIX}${newMsg.trim()}`);
    sendTransaction(
      { to: activePeer as `0x${string}`, value: BigInt(0), data: calldata },
      { onSuccess: (hash) => setTxHash(hash) },
    );
  }, [activePeer, newMsg, address, sendTransaction]);

  const startChat = () => {
    const peer = peerAddress.trim();
    if (!isAddress(peer)) { setError('Invalid address'); return; }
    if (peer.toLowerCase() === address?.toLowerCase()) { setError("Can't chat with yourself"); return; }
    setActivePeer(peer);
    setError(null);
  };

  if (!isConnected) {
    return (
      <div className="space-y-8">
        <div className="flex justify-end"><ConnectButton showBalance={false} /></div>
        <div className="rounded-xl bg-white p-8 text-center ring-1 ring-inset ring-purple-100 shadow-sm">
          <div className="text-4xl mb-4">On-chain Chat</div>
          <p className="text-ink-600">Connect your wallet to start messaging.</p>
          <p className="mt-2 text-xs text-ink-400">Every message is a 0-value transaction with your text as calldata.</p>
        </div>
      </div>
    );
  }

  if (!activePeer) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div />
          <ConnectButton showBalance={false} />
        </div>

        <div className="rounded-xl bg-white p-6 ring-1 ring-inset ring-purple-100 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-ink-900">Start a Conversation</h2>
          <p className="text-sm text-ink-600">Enter a wallet address to chat with. Messages are on-chain and permanent.</p>
          <div className="flex gap-3">
            <input
              value={peerAddress} onChange={(e) => setPeerAddress(e.target.value)}
              placeholder="0x... (recipient wallet)"
              className="flex-1 rounded-lg border border-purple-200 bg-ink-50 px-4 py-2.5 font-mono text-sm text-ink-900 placeholder:text-ink-300 focus:border-ink-500 focus:outline-none"
              onKeyDown={(e) => e.key === 'Enter' && startChat()}
            />
            <button onClick={startChat}
              className="rounded-lg bg-ink-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-ink-600">
              Chat
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {/* How it works */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-ink-500 text-sm font-bold text-white">1</div>
            <h3 className="text-sm font-semibold text-ink-900">Enter Address</h3>
            <p className="mt-1 text-xs text-ink-600">Paste the wallet address you want to message.</p>
          </div>
          <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-ink-500 text-sm font-bold text-white">2</div>
            <h3 className="text-sm font-semibold text-ink-900">Write & Send</h3>
            <p className="mt-1 text-xs text-ink-600">Type your message. It becomes calldata in a 0-value transaction. Costs only gas.</p>
          </div>
          <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-ink-500 text-sm font-bold text-white">3</div>
            <h3 className="text-sm font-semibold text-ink-900">Permanent Record</h3>
            <p className="mt-1 text-xs text-ink-600">Messages live on Ink chain forever. Verifiable, censorship-resistant, fully transparent.</p>
          </div>
        </div>
      </div>
    );
  }

  // Active chat view
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => { setActivePeer(null); setMessages([]); }}
          className="inline-flex items-center gap-2 rounded-lg bg-purple-100 px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-purple-200 shadow-sm transition hover:bg-purple-200">
          ← Back
        </button>
        <ConnectButton showBalance={false} />
      </div>

      {/* Chat header */}
      <div className="rounded-xl bg-white p-4 ring-1 ring-inset ring-purple-100 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs text-ink-500">Chatting with</p>
          <a href={`${EXPLORER_URL}/address/${activePeer}`} target="_blank" rel="noopener noreferrer"
            className="font-mono text-sm text-ink-700 hover:text-ink-500 underline">{shortenAddr(activePeer)}</a>
        </div>
        <button onClick={loadMessages} className="text-xs text-ink-500 hover:text-ink-700">Refresh</button>
      </div>

      {/* Messages */}
      <div className="rounded-xl bg-white ring-1 ring-inset ring-purple-100 shadow-sm overflow-hidden">
        <div className="h-80 overflow-y-auto p-4 space-y-3">
          {loading && <p className="text-center text-sm text-ink-400">Loading messages...</p>}
          {!loading && messages.length === 0 && (
            <p className="text-center text-sm text-ink-400 py-12">No messages yet. Send the first one!</p>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.direction === 'sent' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-xl px-4 py-2.5 ${
                msg.direction === 'sent'
                  ? 'bg-ink-500 text-white'
                  : 'bg-ink-50 text-ink-900'
              }`}>
                <p className="text-sm">{msg.text}</p>
                <div className={`mt-1 flex items-center gap-2 text-[10px] ${msg.direction === 'sent' ? 'text-white/60' : 'text-ink-400'}`}>
                  <span>{new Date(msg.timestamp * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                  <a href={`${EXPLORER_URL}/tx/${msg.txHash}`} target="_blank" rel="noopener noreferrer"
                    className={`underline ${msg.direction === 'sent' ? 'text-white/60 hover:text-white/80' : 'text-ink-400 hover:text-ink-600'}`}>tx</a>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="border-t border-purple-100 p-3 flex gap-2">
          <input
            value={newMsg} onChange={(e) => setNewMsg(e.target.value)}
            placeholder="Type a message..."
            maxLength={200}
            className="flex-1 rounded-lg border border-purple-200 bg-ink-50 px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 focus:border-ink-500 focus:outline-none"
            onKeyDown={(e) => e.key === 'Enter' && !isPending && handleSend()}
          />
          <button onClick={handleSend} disabled={isPending || !newMsg.trim()}
            className="rounded-lg bg-ink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-ink-600 disabled:opacity-50">
            {isPending ? '...' : 'Send'}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {isPending && <p className="text-xs text-amber-600 text-center">Confirm in wallet...</p>}
      {isSuccess && <p className="text-xs text-emerald-600 text-center">Message sent! Loading...</p>}

      <p className="text-center text-[10px] text-ink-400">
        Each message is a 0-value tx with text as calldata. Costs only gas (~$0.001).
        Messages are permanent and public on Ink chain.
      </p>
    </div>
  );
}

export default function ChatPage() {
  return (
    <InkWalletProvider>
      <main className="mx-auto max-w-2xl px-6 py-10 sm:py-16">
        <header className="mb-8">
          <a href="https://inksuite.xyz"
            className="mb-6 inline-flex items-center gap-2 rounded-lg bg-purple-100 px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-purple-200 shadow-sm transition hover:bg-purple-200 hover:text-ink-900">
            ← inksuite.xyz
          </a>
          <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">InkChat</h1>
          <p className="mt-2 text-sm text-ink-600">Wallet-to-wallet messaging on Ink chain. Permanent. Verifiable.</p>
        </header>

        <ChatApp />

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
