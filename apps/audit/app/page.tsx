'use client';

import { InkWalletProvider, ConnectButton, useAccount, useSendTransaction, useWaitForTransactionReceipt } from '@inksuite/wallet';
import { useState, useCallback } from 'react';
import { toHex } from 'viem';

const AUDIT_API = 'https://audit-api.inksuite.xyz';
const AUDIT_FEE_ETH = '0.001';
const AUDIT_REGISTRY = '0x0000000000000000000000000000000000000002' as const;

type CheckResult = {
  present: boolean;
  score: number;
  grade: string;
  detail: string;
  raw?: string;
};

type AuditResult = {
  url: string;
  statusCode: number;
  scannedAt: string;
  overall: {
    score: number;
    maxScore: number;
    percentage: number;
    grade: string;
    label: string;
  };
  checks: Record<string, CheckResult>;
};

const CHECK_LABELS: Record<string, { name: string; description: string }> = {
  https: { name: 'HTTPS', description: 'Encrypted connection' },
  csp: { name: 'Content Security Policy', description: 'Controls which resources the browser can load' },
  hsts: { name: 'HTTP Strict Transport Security', description: 'Forces HTTPS connections' },
  xFrameOptions: { name: 'X-Frame-Options', description: 'Prevents clickjacking attacks' },
  xContentType: { name: 'X-Content-Type-Options', description: 'Prevents MIME-type sniffing' },
  referrerPolicy: { name: 'Referrer Policy', description: 'Controls referrer information sent with requests' },
  permissionsPolicy: { name: 'Permissions Policy', description: 'Controls browser feature access' },
  server: { name: 'Server Header', description: 'Exposing server info helps attackers' },
};

function gradeColor(grade: string) {
  switch (grade) {
    case 'A': return 'text-emerald-600 bg-emerald-100 ring-emerald-300';
    case 'B': return 'text-blue-600 bg-blue-100 ring-blue-300';
    case 'C': return 'text-amber-600 bg-amber-100 ring-amber-300';
    case 'D': return 'text-orange-600 bg-orange-100 ring-orange-300';
    default: return 'text-red-600 bg-red-100 ring-red-300';
  }
}

function overallGradeSize(grade: string) {
  const color = grade === 'A' ? 'from-emerald-500 to-emerald-600' :
    grade === 'B' ? 'from-blue-500 to-blue-600' :
    grade === 'C' ? 'from-amber-500 to-amber-600' :
    grade === 'D' ? 'from-orange-500 to-orange-600' :
    'from-red-500 to-red-600';
  return color;
}

/* ── Paid Audit with on-chain receipt ── */
function PaidAudit({ url, result }: { url: string; result: AuditResult }) {
  const { address, isConnected } = useAccount();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const { sendTransaction, isPending } = useSendTransaction();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const handlePay = () => {
    if (!address) return;
    const calldata = toHex(`inkaudit:${url}:${result.overall.grade}:${result.overall.percentage}`);
    sendTransaction(
      { to: AUDIT_REGISTRY, value: BigInt('1000000000000000'), data: calldata }, // 0.001 ETH
      { onSuccess: (hash) => setTxHash(hash) },
    );
  };

  if (isSuccess && txHash) {
    return (
      <div className="rounded-xl bg-emerald-50 p-5 ring-1 ring-inset ring-emerald-200">
        <p className="text-sm font-semibold text-emerald-700">Audit receipt recorded on-chain!</p>
        <a href={`https://explorer.inkonchain.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
          className="mt-1 inline-block text-xs text-ink-500 underline">View transaction</a>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
      <h3 className="text-sm font-semibold text-ink-900">Save Audit On-chain</h3>
      <p className="mt-1 text-xs text-ink-600">
        Record this audit result as an on-chain transaction for permanent proof. {AUDIT_FEE_ETH} ETH.
      </p>
      {isConnected ? (
        <button onClick={handlePay} disabled={isPending}
          className="mt-3 rounded-lg bg-ink-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-ink-600 disabled:opacity-50">
          {isPending ? 'Confirm in wallet...' : `Record Audit (${AUDIT_FEE_ETH} ETH)`}
        </button>
      ) : (
        <p className="mt-3 text-xs text-ink-400">Connect wallet to save audit on-chain</p>
      )}
    </div>
  );
}

/* ── Main App ── */
function AuditApp() {
  const [url, setUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = useCallback(async () => {
    const target = url.trim();
    if (!target) return;
    setScanning(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${AUDIT_API}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Scan failed' }));
        throw new Error(err.error || `Scan failed (${res.status})`);
      }

      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message || 'Scan failed');
    } finally {
      setScanning(false);
    }
  }, [url]);

  return (
    <div className="space-y-8">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div />
        <ConnectButton showBalance={false} />
      </div>

      {/* Scanner input */}
      <div className="rounded-xl bg-white p-6 ring-1 ring-inset ring-purple-100 shadow-sm">
        <h2 className="mb-1 text-lg font-bold text-ink-900">Scan a Website</h2>
        <p className="mb-4 text-sm text-ink-600">Enter any URL to check its security headers and configuration.</p>
        <div className="flex gap-3">
          <input
            value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="flex-1 rounded-lg border border-purple-200 bg-ink-50 px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 focus:border-ink-500 focus:outline-none"
            onKeyDown={(e) => e.key === 'Enter' && handleScan()}
          />
          <button onClick={handleScan} disabled={scanning || !url.trim()}
            className="rounded-lg bg-ink-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-ink-600 disabled:opacity-50">
            {scanning ? (
              <span className="flex items-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Scanning...
              </span>
            ) : 'Scan'}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Overall score */}
          <div className="rounded-xl bg-white p-6 ring-1 ring-inset ring-purple-100 shadow-sm">
            <div className="flex items-center gap-6">
              <div className={`flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br ${overallGradeSize(result.overall.grade)} text-white shadow-lg`}>
                <span className="text-4xl font-bold">{result.overall.grade}</span>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-ink-900">{result.overall.label}</h3>
                <p className="text-sm text-ink-600">Score: {result.overall.score}/{result.overall.maxScore} ({result.overall.percentage}%)</p>
                <p className="mt-1 font-mono text-xs text-ink-400">{result.url}</p>
                <p className="text-[10px] text-ink-300">Scanned: {new Date(result.scannedAt).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Individual checks */}
          <div>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-600">Security Checks</h2>
            <div className="space-y-3">
              {Object.entries(result.checks).map(([key, check]) => {
                const label = CHECK_LABELS[key] || { name: key, description: '' };
                return (
                  <div key={key} className="rounded-xl bg-white p-4 ring-1 ring-inset ring-purple-100 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ring-1 ring-inset ${gradeColor(check.grade)}`}>
                            {check.grade}
                          </span>
                          <h3 className="text-sm font-semibold text-ink-900">{label.name}</h3>
                        </div>
                        <p className="mt-1 text-xs text-ink-400">{label.description}</p>
                        <p className="mt-1 text-xs text-ink-600">{check.detail}</p>
                        {check.raw && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-[10px] text-ink-400 hover:text-ink-600">Show raw header</summary>
                            <pre className="mt-1 overflow-x-auto rounded bg-ink-50 p-2 text-[10px] text-ink-600">{check.raw}</pre>
                          </details>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-xs text-ink-500">{check.score}pts</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* On-chain receipt */}
          <PaidAudit url={url} result={result} />
        </div>
      )}

      {/* Info section — show when no results */}
      {!result && !scanning && (
        <div>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-600">What We Check</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Object.entries(CHECK_LABELS).map(([key, label]) => (
              <div key={key} className="rounded-xl bg-white p-4 ring-1 ring-inset ring-purple-100 shadow-sm">
                <h3 className="text-sm font-semibold text-ink-900">{label.name}</h3>
                <p className="mt-1 text-xs text-ink-600">{label.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm">
            <h3 className="text-sm font-semibold text-ink-900">How Scoring Works</h3>
            <div className="mt-3 grid grid-cols-5 gap-2 text-center text-xs">
              <div><span className="inline-block rounded-full bg-emerald-100 px-2 py-1 font-bold text-emerald-600">A</span><p className="mt-1 text-ink-500">90-100%</p></div>
              <div><span className="inline-block rounded-full bg-blue-100 px-2 py-1 font-bold text-blue-600">B</span><p className="mt-1 text-ink-500">75-89%</p></div>
              <div><span className="inline-block rounded-full bg-amber-100 px-2 py-1 font-bold text-amber-600">C</span><p className="mt-1 text-ink-500">55-74%</p></div>
              <div><span className="inline-block rounded-full bg-orange-100 px-2 py-1 font-bold text-orange-600">D</span><p className="mt-1 text-ink-500">35-54%</p></div>
              <div><span className="inline-block rounded-full bg-red-100 px-2 py-1 font-bold text-red-600">F</span><p className="mt-1 text-ink-500">0-34%</p></div>
            </div>
          </div>

          <div className="mt-6 rounded-xl bg-ink-500 p-5 text-white shadow-lg">
            <h3 className="font-semibold">Free Scan, Paid On-chain Proof</h3>
            <p className="mt-1 text-sm text-white/80">
              Scanning is free. Want a permanent, verifiable audit record on Ink chain?
              Save your result on-chain for {AUDIT_FEE_ETH} ETH.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuditPage() {
  return (
    <InkWalletProvider>
      <main className="mx-auto max-w-3xl px-6 py-10 sm:py-16">
        <header className="mb-8">
          <a href="https://inksuite.xyz"
            className="mb-6 inline-flex items-center gap-2 rounded-lg bg-purple-100 px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-purple-200 shadow-sm transition hover:bg-purple-200 hover:text-ink-900">
            ← inksuite.xyz
          </a>
          <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">InkAudit</h1>
          <p className="mt-2 text-sm text-ink-600">Web security scanner. Check any site&apos;s security headers instantly.</p>
        </header>

        <AuditApp />

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
