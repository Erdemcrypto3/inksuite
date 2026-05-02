// [CRIT-05] Re-export DO class so wrangler can bind it when [[migrations]] is enabled.
// While the binding is absent (free plan), this export is harmless dead code.
export { UploadCounter } from './counter.js';
import { uploadToArweave } from './arweave.js';

const STABILITY_API = 'https://api.stability.ai/v2beta/stable-image/generate/core';
const FEE_RECIPIENT = '0x9E84D77264d94C646dF91A70dbae99C20330eAD0';
const INK_RPC = 'https://rpc-gel.inkonchain.com';
const INK_RPC_FALLBACK = 'https://rpc-qnd.inkonchain.com';
const MIN_FEE_WEI = 190000000000000n; // 0.00019 ETH (~95% of 0.0002)
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_SCORE_UPLOAD_SIZE = 50 * 1024; // 50KB — score SVG + metadata only
const MIN_CONFIRMATIONS = 3n; // [HIGH-01] reorg protection

function corsHeaders(origin, allowedOrigin) {
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

function generateId() {
  return crypto.randomUUID().replace(/-/g, '');
}

// [CRIT-02] Fail-closed guard — KV must be bound or service is misconfigured
function requireKV(env) {
  if (!env.USED_TXS) {
    throw new Response(
      JSON.stringify({ error: 'Service misconfigured: KV not bound' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// [PAI-0040] Sliding-bucket rate limit, fail-CLOSED when the KV binding is
// missing in production. The previous behaviour returned `true` (allow) on a
// missing binding, which silently disabled the rate limit any time the
// wrangler config drifted.
//
// [PAI-0036] Dev bypass requires BOTH env.ENVIRONMENT === 'development' AND
// env.RATE_LIMIT_DEV === 'true'. A single-flag bypass would let one typo in
// production wrangler config disable rate-limiting entirely; the double-gate
// makes accidental copy/paste in prod harmless.
async function checkRateLimit(request, env, endpoint, limit, windowSec) {
  if (!env.RATE_LIMIT) {
    const isDevBypass = env.ENVIRONMENT === 'development' && env.RATE_LIMIT_DEV === 'true';
    if (isDevBypass) {
      console.warn('[RATE_LIMIT] DEV BYPASS ACTIVE — KV unbound, ENVIRONMENT=development + RATE_LIMIT_DEV=true');
      return true;
    }
    // [PAI-0040] startup-style alert: log loudly so missing bindings are
    // obvious in Cloudflare logs even if the resulting 503s look generic.
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

// [PAI-0041] Per-IP byte-budget rate limit on /upload. The endpoint already
// has a per-IP request-count bucket via checkRateLimit('upload', ...); this
// adds an orthogonal axis (bytes per minute per IP) so an attacker can't
// burn the R2 quota by uploading many small-but-legitimately-shaped payloads
// under the request-count threshold.
const UPLOAD_BYTES_PER_MIN = 10 * 1024 * 1024; // 10 MB / IP / minute
async function checkUploadByteBudget(request, env, byteCount) {
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

function rateLimitResponse(headers, retryAfter) {
  return new Response(
    JSON.stringify({ error: 'Rate limited' }),
    { status: 429, headers: { ...headers, 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) } }
  );
}

async function rpcCall(method, params) {
  const rpcs = [INK_RPC, INK_RPC_FALLBACK];
  for (const rpc of rpcs) {
    try {
      const res = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      return data.result;
    } catch (e) {
      if (rpc === rpcs[rpcs.length - 1]) throw e;
    }
  }
}

async function verifyPayment(txHash, env) {
  requireKV(env); // [CRIT-02] fail-closed

  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return { valid: false, reason: 'Invalid tx hash format' };
  }

  const existing = await env.USED_TXS.get(txHash);
  if (existing) {
    return { valid: false, reason: 'Transaction already used' };
  }

  let receipt, tx;
  try {
    [receipt, tx] = await Promise.all([
      rpcCall('eth_getTransactionReceipt', [txHash]),
      rpcCall('eth_getTransactionByHash', [txHash]),
    ]);
  } catch (e) {
    return { valid: false, reason: 'RPC error: ' + e.message };
  }

  if (!receipt || !tx) return { valid: false, reason: 'Tx not found' };
  if (receipt.status !== '0x1') return { valid: false, reason: 'Tx failed' };

  // [HIGH-01] Confirmation count — reorg protection
  try {
    const currentBlockHex = await rpcCall('eth_blockNumber', []);
    const currentBlock = BigInt(currentBlockHex);
    const txBlock = BigInt(receipt.blockNumber);
    if (currentBlock < txBlock) return { valid: false, reason: 'Block in future' };
    if (currentBlock - txBlock < MIN_CONFIRMATIONS) {
      return { valid: false, reason: `Need ${MIN_CONFIRMATIONS} confirmations, have ${currentBlock - txBlock}` };
    }
  } catch (e) {
    return { valid: false, reason: 'Confirmation check failed: ' + e.message };
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
    JSON.stringify({ from: tx.from, value: tx.value, usedAt: Date.now(), uploadsRemaining: 2 }),
    { expirationTtl: 60 * 60 * 24 * 90 }
  );

  // [CRIT-05] If Durable Object counter is bound, init it to 2 for atomic decrement later.
  if (env.UPLOAD_COUNTER) {
    const id = env.UPLOAD_COUNTER.idFromName(txHash);
    const stub = env.UPLOAD_COUNTER.get(id);
    await stub.fetch(new Request('https://do/init', {
      method: 'POST', body: JSON.stringify({ count: 2 }),
    }));
  }

  return { valid: true, from: tx.from };
}

function detectMimeType(bytes) {
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png';
  return null;
}

// [HIGH-02] Streaming reader that enforces size during read (Content-Length untrusted)
async function readBodyWithLimit(request, maxSize) {
  const reader = request.body?.getReader();
  if (!reader) return { error: 'No body' };
  const chunks = [];
  let totalSize = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalSize += value.length;
    if (totalSize > maxSize) {
      reader.cancel();
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
  return { body: body.buffer };
}

// [P012-PAI-0050] Regex-based SVG sanitizer for Cloudflare Workers (no DOM).
// Strips dangerous elements and attributes that enable stored XSS via SVG:
// - <script> tags and their contents
// - on* event handler attributes (onclick, onload, onerror, etc.)
// - <foreignObject> tags and their contents (can embed arbitrary HTML)
// - xlink:href / href pointing to javascript: URIs
// - <use> tags with external references (href="http://...")
function sanitizeSVG(text) {
  let s = text;
  // Strip <script>...</script> (including nested/multiline)
  s = s.replace(/<script[\s>][\s\S]*?<\/script\s*>/gi, '');
  // Strip self-closing <script ... />
  s = s.replace(/<script[^>]*\/\s*>/gi, '');
  // Strip <foreignObject>...</foreignObject>
  s = s.replace(/<foreignObject[\s>][\s\S]*?<\/foreignObject\s*>/gi, '');
  // Strip self-closing <foreignObject ... />
  s = s.replace(/<foreignObject[^>]*\/\s*>/gi, '');
  // Strip on* event attributes (onload, onclick, onerror, etc.)
  s = s.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // Strip xlink:href="javascript:..." and href="javascript:..."
  s = s.replace(/\s+(?:xlink:)?href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '');
  // Strip <use> with external href (http:// or https://)
  s = s.replace(/<use\s[^>]*href\s*=\s*(?:"https?:\/\/[^"]*"|'https?:\/\/[^']*')[^>]*\/?>/gi, '');
  return s;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = corsHeaders(origin, env.ALLOWED_ORIGIN);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    const url = new URL(request.url);

    // ── Runtime config (GET /api/config) ──
    // [PAI-0043] Frontend can fetch contract addresses at boot rather than
    // depending on NEXT_PUBLIC_* build-time inlining. Lets us rotate
    // INKPOLL_V2_ADDRESS without a Cloudflare Pages rebuild + cache flush.
    // Values are sourced from Worker env vars (set via `wrangler secret put`
    // for prod, [vars] for dev). Frontend should fall back to its build-time
    // constant if this endpoint is unreachable.
    if (request.method === 'GET' && url.pathname === '/api/config') {
      const config = {
        inkmint: env.INKMINT_ADDRESS || null,
        inkpoll: env.INKPOLL_ADDRESS || null,
        inkpollV2: env.INKPOLL_V2_ADDRESS || null,
        inkpress: env.INKPRESS_ADDRESS || null,
      };
      return new Response(JSON.stringify(config), {
        status: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60', // hot-rotatable, short cache
        },
      });
    }

    // ── R2 File Read (GET /file/:key) ──
    if (request.method === 'GET' && url.pathname.startsWith('/file/')) {
      const key = url.pathname.slice(6);
      if (!key) return new Response('Key required', { status: 400, headers });

      // P012-PAI-0054: restrict /file/* to known R2 key prefixes
      const allowedPrefixes = ['score/', 'covers/', 'articles/', 'metadata/'];
      if (!allowedPrefixes.some(p => key.startsWith(p))) {
        return new Response('Forbidden', { status: 403, headers: corsHeaders(origin, env.ALLOWED_ORIGIN) });
      }

      const object = await env.STORAGE.get(key);
      if (!object) return new Response('Not found', { status: 404, headers });

      // [HIGH-04] User-generated content (HTML/JSON) must be re-validated; binary assets can be immutable
      const ct = object.httpMetadata?.contentType || 'application/octet-stream';
      const isUserContent = ct.startsWith('text/html') || ct.startsWith('application/json');
      const cacheHeader = isUserContent
        ? 'public, max-age=3600, must-revalidate'
        : 'public, max-age=31536000, immutable';

      // [P012-PAI-0050] Defense-in-depth: CSP sandbox + forced download prevent
      // stored XSS in user-uploaded SVG (or any active content) served from R2.
      return new Response(object.body, {
        headers: {
          ...headers,
          'Content-Type': ct,
          'Cache-Control': cacheHeader,
          'Content-Security-Policy': "default-src 'none'; sandbox",
          'Content-Disposition': 'attachment',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Not found', { status: 404, headers });
    }

    // ── Score Upload (POST /upload-score) — no payment, strict limits ──
    if (url.pathname === '/upload-score') {
      try {
        const scoreTypes = ['image/svg+xml', 'application/json'];
        const contentType = request.headers.get('Content-Type') || '';
        if (!scoreTypes.some((t) => contentType.startsWith(t))) {
          return Response.json({ error: 'Only SVG and JSON allowed for score uploads' }, { status: 400, headers });
        }

        // [P012-PAI-0050] Tightened from 5/hour to 5/day — free endpoint,
        // no payment gate, abuse surface reduced by 24x.
        if (!(await checkRateLimit(request, env, 'score-upload', 5, 86400))) {
          return rateLimitResponse(headers, 86400);
        }

        const contentLengthHint = Number(request.headers.get('Content-Length') || 0);
        if (contentLengthHint > MAX_SCORE_UPLOAD_SIZE) {
          return Response.json({ error: 'Score upload too large (max 50KB)' }, { status: 413, headers });
        }

        const read = await readBodyWithLimit(request, MAX_SCORE_UPLOAD_SIZE);
        if (read.error) {
          const status = read.error.includes('exceeded') ? 413 : 400;
          return Response.json({ error: read.error }, { status, headers });
        }
        let body = read.body;

        // [P012-PAI-0050] Sanitize SVG server-side before storing — strip
        // <script>, on* handlers, <foreignObject>, javascript: hrefs, and
        // external <use> references to prevent stored XSS via score uploads.
        if (contentType.includes('svg')) {
          const raw = new TextDecoder().decode(body);
          const clean = sanitizeSVG(raw);
          body = new TextEncoder().encode(clean).buffer;
        }

        const ext = contentType.includes('svg') ? 'svg' : 'json';
        const key = `score/${generateId()}.${ext}`;
        await env.STORAGE.put(key, body, { httpMetadata: { contentType } });

        const fileUrl = `https://api.inksuite.xyz/file/${key}`;
        return Response.json({ key, url: fileUrl }, {
          status: 200,
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        if (e instanceof Response) return e;
        console.error('Score upload error:', e);
        return Response.json({ error: 'Upload failed' }, { status: 500, headers });
      }
    }

    // ── R2 Upload (POST /upload) ──
    if (url.pathname === '/upload') {
      try {
        requireKV(env); // [CRIT-02] fail-closed

        // [HIGH-03] 20 uploads per minute per IP
        if (!(await checkRateLimit(request, env, 'upload', 20, 60))) {
          return rateLimitResponse(headers, 60);
        }

        const txHash = request.headers.get('X-Payment-Tx');
        if (!txHash) {
          return Response.json({ error: 'X-Payment-Tx header required' }, { status: 402, headers });
        }

        // [CRIT-01] Inline verifyPayment for /upload-only flows (games/quiz/inkpress never call /generate)
        let paymentRaw = await env.USED_TXS.get(txHash);
        if (!paymentRaw) {
          const verify = await verifyPayment(txHash, env);
          if (!verify.valid) {
            return Response.json({ error: `Payment invalid: ${verify.reason}` }, { status: 402, headers });
          }
          paymentRaw = await env.USED_TXS.get(txHash);
        }

        const payment = JSON.parse(paymentRaw);

        // [CRIT-05] Prefer Durable Object atomic decrement when bound; fall back to KV.
        if (env.UPLOAD_COUNTER) {
          const id = env.UPLOAD_COUNTER.idFromName(txHash);
          const stub = env.UPLOAD_COUNTER.get(id);
          const counterRes = await stub.fetch(new Request('https://do/decrement'));
          if (!counterRes.ok) {
            return Response.json({ error: 'Upload limit reached for this payment' }, { status: 402, headers });
          }
        } else {
          if (payment.uploadsRemaining !== undefined && payment.uploadsRemaining <= 0) {
            return Response.json({ error: 'Upload limit reached for this payment' }, { status: 402, headers });
          }
          payment.uploadsRemaining = (payment.uploadsRemaining ?? 2) - 1;
          payment.lastUploadAt = Date.now();
          await env.USED_TXS.put(txHash, JSON.stringify(payment), { expirationTtl: 60 * 60 * 24 * 90 });
        }

        // [HIGH-02] Quick reject via Content-Length hint then enforce during streaming read
        const contentLengthHint = Number(request.headers.get('Content-Length') || 0);
        if (contentLengthHint > MAX_UPLOAD_SIZE) {
          return Response.json({ error: 'File too large (max 5MB)' }, { status: 413, headers });
        }

        const contentType = request.headers.get('Content-Type') || '';
        // P012-PAI-0055: removed text/html and image/svg+xml — active content types not accepted without sanitization
        const allowedTypes = ['image/jpeg', 'image/png', 'application/json', 'text/plain'];
        if (!allowedTypes.some((t) => contentType.startsWith(t))) {
          return Response.json({ error: 'Unsupported content type' }, { status: 400, headers });
        }

        const read = await readBodyWithLimit(request, MAX_UPLOAD_SIZE);
        if (read.error) {
          const status = read.error.includes('exceeded') ? 413 : 400;
          return Response.json({ error: read.error }, { status, headers });
        }
        const body = read.body;

        // [PAI-0041] Per-IP byte-budget gate after the body is read so we
        // measure actual stream length, not the (untrusted) Content-Length.
        if (!(await checkUploadByteBudget(request, env, body.byteLength))) {
          return rateLimitResponse(headers, 60);
        }

        // Magic-bytes spoofing check for binary types
        const bytes = new Uint8Array(body.slice(0, 12));
        const detected = detectMimeType(bytes);
        if (detected && !contentType.startsWith(detected)) {
          if (!contentType.includes('json') && !contentType.includes('text')) {
            return Response.json({ error: 'Content-Type mismatch' }, { status: 400, headers });
          }
        }

        const ext = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg'
          : contentType.includes('png') ? 'png'
          : contentType.includes('json') ? 'json'
          : 'bin';
        const key = `${generateId()}.${ext}`;

        await env.STORAGE.put(key, body, { httpMetadata: { contentType } });

        const r2Url = `https://api.inksuite.xyz/file/${key}`;

        // [DEC-0007] Try Arweave for permanent storage; R2 serves as backup/CDN
        const arweaveResult = await uploadToArweave(body, contentType, env);
        const fileUrl = arweaveResult ? arweaveResult.url : r2Url;

        return Response.json({ key, url: fileUrl, storage: arweaveResult ? 'arweave' : 'r2' }, {
          status: 200,
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        if (e instanceof Response) return e; // requireKV throws Response
        console.error('R2 upload error:', e);
        return Response.json({ error: 'Upload failed' }, { status: 500, headers });
      }
    }

    // ── Stability AI Image Generation (POST /generate) ──
    if (url.pathname === '/generate') {
      try {
        requireKV(env); // [CRIT-02]

        // [HIGH-03] 10 generate calls per minute per IP (Stability API is costly)
        if (!(await checkRateLimit(request, env, 'generate', 10, 60))) {
          return rateLimitResponse(headers, 60);
        }

        const { prompt, txHash } = await request.json();
        if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
          return Response.json({ error: 'Prompt must be at least 3 characters' }, { status: 400, headers });
        }
        if (!txHash || typeof txHash !== 'string') {
          return Response.json({ error: 'Payment transaction hash required' }, { status: 400, headers });
        }

        const payment = await verifyPayment(txHash, env);
        if (!payment.valid) {
          return Response.json({ error: `Payment invalid: ${payment.reason}` }, { status: 402, headers });
        }

        const formData = new FormData();
        formData.set('prompt', prompt.trim());
        formData.set('output_format', 'jpeg');

        const aiRes = await fetch(STABILITY_API, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.STABILITY_API_KEY}`,
            'Accept': 'image/*',
          },
          body: formData,
        });

        if (!aiRes.ok) {
          const errText = await aiRes.text();
          console.error('Stability API error:', aiRes.status, errText);
          return Response.json({ error: `AI generation failed: ${aiRes.status}` }, { status: 502, headers });
        }

        return new Response(await aiRes.arrayBuffer(), {
          status: 200,
          headers: { ...headers, 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' },
        });
      } catch (e) {
        if (e instanceof Response) return e;
        console.error('Worker error:', e);
        return Response.json({ error: 'Internal error' }, { status: 500, headers });
      }
    }

    return new Response('Not found', { status: 404, headers });
  },
};
