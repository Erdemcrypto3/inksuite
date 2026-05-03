import { Hono } from 'hono';
import { uploadToArweave } from './arweave';
import {
  TxHashSchema,
  GenerateBodySchema,
  UploadContentTypeSchema,
  ScoreContentTypeSchema,
  FileKeySchema,
} from './schemas';

export { UploadCounter } from './counter';

// --- Bindings ---

interface Bindings {
  STORAGE: R2Bucket;
  USED_TXS: KVNamespace;
  RATE_LIMIT: KVNamespace;
  UPLOAD_COUNTER?: DurableObjectNamespace;
  ALLOWED_ORIGIN: string;
  INKMINT_ADDRESS: string;
  INKPOLL_ADDRESS: string;
  INKPRESS_ADDRESS: string;
  INKPOLL_V2_ADDRESS: string;
  IRYS_TOKEN: string;
  STABILITY_API_KEY: string;
  IRYS_PRIVATE_KEY?: string;
  ENVIRONMENT?: string;
  RATE_LIMIT_DEV?: string;
}

// --- Constants ---

const STABILITY_API = 'https://api.stability.ai/v2beta/stable-image/generate/core';
const FEE_RECIPIENT = '0x9E84D77264d94C646dF91A70dbae99C20330eAD0';
const INK_RPC = 'https://rpc-gel.inkonchain.com';
const INK_RPC_FALLBACK = 'https://rpc-qnd.inkonchain.com';
const MIN_FEE_WEI = 190000000000000n;
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const MAX_SCORE_UPLOAD_SIZE = 50 * 1024;
const MIN_CONFIRMATIONS = 3n;
const UPLOAD_BYTES_PER_MIN = 10 * 1024 * 1024;

// --- CORS ---

function corsHeaders(origin: string, allowedOrigin: string): Record<string, string> {
  let allowed = false;
  if (origin) {
    try {
      const u = new URL(origin);
      allowed =
        origin === allowedOrigin ||
        u.hostname === 'inksuite.xyz' ||
        u.hostname.endsWith('.inksuite.xyz') ||
        (u.hostname === 'localhost' && u.protocol === 'http:');
    } catch {
      allowed = false;
    }
  }
  return {
    'Access-Control-Allow-Origin': allowed ? origin : allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Payment-Tx',
    'Vary': 'Origin',
  };
}

// --- Helpers ---

function generateId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

function requireKV(env: Bindings): void {
  if (!env.USED_TXS) {
    throw new Response(
      JSON.stringify({ error: 'Service misconfigured: KV not bound' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function checkRateLimit(
  request: Request,
  env: Bindings,
  endpoint: string,
  limit: number,
  windowSec: number
): Promise<boolean> {
  if (!env.RATE_LIMIT) {
    const isDevBypass = env.ENVIRONMENT === 'development' && env.RATE_LIMIT_DEV === 'true';
    if (isDevBypass) {
      console.warn('[RATE_LIMIT] DEV BYPASS ACTIVE — KV unbound, ENVIRONMENT=development + RATE_LIMIT_DEV=true');
      return true;
    }
    console.error('[RATE_LIMIT] env.RATE_LIMIT KV binding missing — failing closed');
    throw new Response(
      JSON.stringify({ error: 'Service misconfigured: rate limit unavailable' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const bucket = Math.floor(Date.now() / (windowSec * 1000));
  const key = `rl:${endpoint}:${ip}:${bucket}`;
  const count = Number((await env.RATE_LIMIT.get(key)) || 0);
  if (count >= limit) return false;
  await env.RATE_LIMIT.put(key, String(count + 1), { expirationTtl: windowSec + 10 });
  return true;
}

async function checkUploadByteBudget(
  request: Request,
  env: Bindings,
  byteCount: number
): Promise<boolean> {
  if (!env.RATE_LIMIT) {
    const isDevBypass = env.ENVIRONMENT === 'development' && env.RATE_LIMIT_DEV === 'true';
    if (isDevBypass) return true;
    throw new Response(
      JSON.stringify({ error: 'Service misconfigured: rate limit unavailable' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const bucket = Math.floor(Date.now() / 60000);
  const key = `rl:upload-bytes:${ip}:${bucket}`;
  const used = Number((await env.RATE_LIMIT.get(key)) || 0);
  if (used + byteCount > UPLOAD_BYTES_PER_MIN) return false;
  await env.RATE_LIMIT.put(key, String(used + byteCount), { expirationTtl: 70 });
  return true;
}

function rateLimitResponse(retryAfter: number): Response {
  return Response.json(
    { error: 'Rate limited' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  );
}

interface RpcResponse {
  result?: unknown;
  error?: { message: string };
}

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const rpcs = [INK_RPC, INK_RPC_FALLBACK];
  for (const rpc of rpcs) {
    try {
      const res = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
      const data = (await res.json()) as RpcResponse;
      if (data.error) throw new Error(data.error.message);
      return data.result;
    } catch (e) {
      if (rpc === rpcs[rpcs.length - 1]) throw e;
    }
  }
}

interface TransactionReceipt {
  status: string;
  blockNumber: string;
}

interface Transaction {
  from: string;
  to: string | null;
  value: string;
}

interface PaymentRecord {
  from: string;
  value: string;
  usedAt: number;
  uploadsRemaining: number;
  lastUploadAt?: number;
}

interface VerifyResult {
  valid: boolean;
  reason?: string;
  from?: string;
}

async function verifyPayment(txHash: string, env: Bindings): Promise<VerifyResult> {
  requireKV(env);

  if (!TxHashSchema.safeParse(txHash).success) {
    return { valid: false, reason: 'Invalid tx hash format' };
  }

  const existing = await env.USED_TXS.get(txHash);
  if (existing) {
    return { valid: false, reason: 'Transaction already used' };
  }

  let receipt: TransactionReceipt | null;
  let tx: Transaction | null;
  try {
    [receipt, tx] = await Promise.all([
      rpcCall('eth_getTransactionReceipt', [txHash]) as Promise<TransactionReceipt | null>,
      rpcCall('eth_getTransactionByHash', [txHash]) as Promise<Transaction | null>,
    ]);
  } catch (e) {
    return { valid: false, reason: 'RPC error: ' + (e as Error).message };
  }

  if (!receipt || !tx) return { valid: false, reason: 'Tx not found' };
  if (receipt.status !== '0x1') return { valid: false, reason: 'Tx failed' };

  try {
    const currentBlockHex = (await rpcCall('eth_blockNumber', [])) as string;
    const currentBlock = BigInt(currentBlockHex);
    const txBlock = BigInt(receipt.blockNumber);
    if (currentBlock < txBlock) return { valid: false, reason: 'Block in future' };
    if (currentBlock - txBlock < MIN_CONFIRMATIONS) {
      return { valid: false, reason: `Need ${MIN_CONFIRMATIONS} confirmations, have ${currentBlock - txBlock}` };
    }
  } catch (e) {
    return { valid: false, reason: 'Confirmation check failed: ' + (e as Error).message };
  }

  if (tx.to?.toLowerCase() !== FEE_RECIPIENT.toLowerCase()) {
    return { valid: false, reason: 'Wrong recipient' };
  }

  const value = BigInt(tx.value);
  if (value < MIN_FEE_WEI) {
    return { valid: false, reason: `Insufficient: ${value} wei` };
  }

  await env.USED_TXS.put(
    txHash,
    JSON.stringify({ from: tx.from, value: tx.value, usedAt: Date.now(), uploadsRemaining: 2 } satisfies PaymentRecord),
    { expirationTtl: 60 * 60 * 24 * 90 }
  );

  if (env.UPLOAD_COUNTER) {
    const id = env.UPLOAD_COUNTER.idFromName(txHash);
    const stub = env.UPLOAD_COUNTER.get(id);
    await stub.fetch(new Request('https://do/init', {
      method: 'POST',
      body: JSON.stringify({ count: 2 }),
    }));
  }

  return { valid: true, from: tx.from };
}

function detectMimeType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png';
  return null;
}

async function readBodyWithLimit(
  request: Request,
  maxSize: number
): Promise<{ body: Uint8Array } | { error: string }> {
  const reader = request.body?.getReader();
  if (!reader) return { error: 'No body' };
  const chunks: Uint8Array[] = [];
  let totalSize = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    totalSize += value.length;
    if (totalSize > maxSize) {
      void reader.cancel();
      return { error: 'Body exceeded limit' };
    }
    chunks.push(value);
  }
  const body = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  return { body };
}

function sanitizeSVG(text: string): string {
  let s = text;
  s = s.replace(/<script[\s>][\s\S]*?<\/script\s*>/gi, '');
  s = s.replace(/<script[^>]*\/\s*>/gi, '');
  s = s.replace(/<foreignObject[\s>][\s\S]*?<\/foreignObject\s*>/gi, '');
  s = s.replace(/<foreignObject[^>]*\/\s*>/gi, '');
  s = s.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  s = s.replace(/\s+(?:xlink:)?href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '');
  s = s.replace(/<use\s[^>]*href\s*=\s*(?:"https?:\/\/[^"]*"|'https?:\/\/[^']*')[^>]*\/?>/gi, '');
  return s;
}

// --- Hono App ---

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', async (c, next) => {
  const origin = c.req.header('Origin') || '';
  const hdrs = corsHeaders(origin, c.env.ALLOWED_ORIGIN);

  if (c.req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: hdrs });
  }

  await next();

  for (const [key, val] of Object.entries(hdrs)) {
    c.header(key, val);
  }
});

app.get('/api/config', (c) => {
  return c.json(
    {
      inkmint: c.env.INKMINT_ADDRESS || null,
      inkpoll: c.env.INKPOLL_ADDRESS || null,
      inkpollV2: c.env.INKPOLL_V2_ADDRESS || null,
      inkpress: c.env.INKPRESS_ADDRESS || null,
    },
    200,
    { 'Cache-Control': 'public, max-age=60' }
  );
});

app.get('/file/*', async (c) => {
  const keyResult = FileKeySchema.safeParse(c.req.path.slice(6));
  if (!keyResult.success) {
    return c.text('Forbidden', 403);
  }
  const key = keyResult.data;

  const object = await c.env.STORAGE.get(key);
  if (!object) return c.text('Not found', 404);

  const ct = object.httpMetadata?.contentType || 'application/octet-stream';
  const isUserContent = ct.startsWith('text/html') || ct.startsWith('application/json');
  const cacheHeader = isUserContent
    ? 'public, max-age=3600, must-revalidate'
    : 'public, max-age=31536000, immutable';

  return new Response(object.body, {
    headers: {
      'Content-Type': ct,
      'Cache-Control': cacheHeader,
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Content-Disposition': 'attachment',
    },
  });
});

app.post('/upload-score', async (c) => {
  try {
    const contentType = c.req.header('Content-Type') || '';
    if (!ScoreContentTypeSchema.safeParse(contentType).success) {
      return c.json({ error: 'Only SVG and JSON allowed for score uploads' }, 400);
    }

    if (!(await checkRateLimit(c.req.raw, c.env, 'score-upload', 5, 86400))) {
      return rateLimitResponse(86400);
    }

    const contentLengthHint = Number(c.req.header('Content-Length') || 0);
    if (contentLengthHint > MAX_SCORE_UPLOAD_SIZE) {
      return c.json({ error: 'Score upload too large (max 50KB)' }, 413);
    }

    const read = await readBodyWithLimit(c.req.raw, MAX_SCORE_UPLOAD_SIZE);
    if ('error' in read) {
      return c.json({ error: read.error }, read.error.includes('exceeded') ? 413 : 400);
    }
    let body: Uint8Array = read.body;

    if (contentType.includes('svg')) {
      const raw = new TextDecoder().decode(body);
      const clean = sanitizeSVG(raw);
      body = new TextEncoder().encode(clean);
    }

    const ext = contentType.includes('svg') ? 'svg' : 'json';
    const key = `score/${generateId()}.${ext}`;
    await c.env.STORAGE.put(key, body, { httpMetadata: { contentType } });

    const fileUrl = `https://api.inksuite.xyz/file/${key}`;
    return c.json({ key, url: fileUrl });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error('Score upload error:', e);
    return c.json({ error: 'Upload failed' }, 500);
  }
});

app.post('/upload', async (c) => {
  try {
    requireKV(c.env);

    if (!(await checkRateLimit(c.req.raw, c.env, 'upload', 20, 60))) {
      return rateLimitResponse(60);
    }

    const txHashResult = TxHashSchema.safeParse(c.req.header('X-Payment-Tx'));
    if (!txHashResult.success) {
      return c.json({ error: 'Valid X-Payment-Tx header required' }, 402);
    }
    const txHash = txHashResult.data;

    let paymentRaw = await c.env.USED_TXS.get(txHash);
    if (!paymentRaw) {
      const verify = await verifyPayment(txHash, c.env);
      if (!verify.valid) {
        return c.json({ error: `Payment invalid: ${verify.reason}` }, 402);
      }
      paymentRaw = await c.env.USED_TXS.get(txHash);
    }

    const payment = JSON.parse(paymentRaw!) as PaymentRecord;

    if (c.env.UPLOAD_COUNTER) {
      const id = c.env.UPLOAD_COUNTER.idFromName(txHash);
      const stub = c.env.UPLOAD_COUNTER.get(id);
      const counterRes = await stub.fetch(new Request('https://do/decrement'));
      if (!counterRes.ok) {
        return c.json({ error: 'Upload limit reached for this payment' }, 402);
      }
    } else {
      if (payment.uploadsRemaining !== undefined && payment.uploadsRemaining <= 0) {
        return c.json({ error: 'Upload limit reached for this payment' }, 402);
      }
      payment.uploadsRemaining = (payment.uploadsRemaining ?? 2) - 1;
      payment.lastUploadAt = Date.now();
      await c.env.USED_TXS.put(txHash, JSON.stringify(payment), { expirationTtl: 60 * 60 * 24 * 90 });
    }

    const contentLengthHint = Number(c.req.header('Content-Length') || 0);
    if (contentLengthHint > MAX_UPLOAD_SIZE) {
      return c.json({ error: 'File too large (max 5MB)' }, 413);
    }

    const contentType = c.req.header('Content-Type') || '';
    if (!UploadContentTypeSchema.safeParse(contentType).success) {
      return c.json({ error: 'Unsupported content type' }, 400);
    }

    const read = await readBodyWithLimit(c.req.raw, MAX_UPLOAD_SIZE);
    if ('error' in read) {
      return c.json({ error: read.error }, read.error.includes('exceeded') ? 413 : 400);
    }
    const body = read.body;

    if (!(await checkUploadByteBudget(c.req.raw, c.env, body.byteLength))) {
      return rateLimitResponse(60);
    }

    const bytes = body.slice(0, 12);
    const detected = detectMimeType(bytes);
    if (detected && !contentType.startsWith(detected)) {
      if (!contentType.includes('json') && !contentType.includes('text')) {
        return c.json({ error: 'Content-Type mismatch' }, 400);
      }
    }

    const ext = contentType.includes('jpeg') || contentType.includes('jpg')
      ? 'jpg'
      : contentType.includes('png')
        ? 'png'
        : contentType.includes('json')
          ? 'json'
          : 'bin';
    const key = `${generateId()}.${ext}`;

    await c.env.STORAGE.put(key, body, { httpMetadata: { contentType } });

    const r2Url = `https://api.inksuite.xyz/file/${key}`;
    const arweaveResult = await uploadToArweave(body, contentType, c.env);
    const fileUrl = arweaveResult ? arweaveResult.url : r2Url;

    return c.json({ key, url: fileUrl, storage: arweaveResult ? 'arweave' : 'r2' });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error('R2 upload error:', e);
    return c.json({ error: 'Upload failed' }, 500);
  }
});

app.post('/generate', async (c) => {
  try {
    requireKV(c.env);

    if (!(await checkRateLimit(c.req.raw, c.env, 'generate', 10, 60))) {
      return rateLimitResponse(60);
    }

    const bodyResult = GenerateBodySchema.safeParse(await c.req.json());
    if (!bodyResult.success) {
      return c.json({ error: bodyResult.error.issues[0]?.message ?? 'Invalid request body' }, 400);
    }
    const { prompt, txHash } = bodyResult.data;

    const payment = await verifyPayment(txHash, c.env);
    if (!payment.valid) {
      return c.json({ error: `Payment invalid: ${payment.reason}` }, 402);
    }

    const formData = new FormData();
    formData.set('prompt', prompt);
    formData.set('output_format', 'jpeg');

    const aiRes = await fetch(STABILITY_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.STABILITY_API_KEY}`,
        'Accept': 'image/*',
      },
      body: formData,
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('Stability API error:', aiRes.status, errText);
      return c.json({ error: `AI generation failed: ${aiRes.status}` }, 502);
    }

    return new Response(await aiRes.arrayBuffer(), {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error('Worker error:', e);
    return c.json({ error: 'Internal error' }, 500);
  }
});

export default app;
