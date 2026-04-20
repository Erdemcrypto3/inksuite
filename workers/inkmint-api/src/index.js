const STABILITY_API = 'https://api.stability.ai/v2beta/stable-image/generate/core';
const FEE_RECIPIENT = '0x9E84D77264d94C646dF91A70dbae99C20330eAD0';
const INK_RPC = 'https://rpc-gel.inkonchain.com';
const INK_RPC_FALLBACK = 'https://rpc-qnd.inkonchain.com';
const MIN_FEE_WEI = 190000000000000n; // 0.00019 ETH (~95% of 0.0002)
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5MB
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

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = corsHeaders(origin, env.ALLOWED_ORIGIN);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    const url = new URL(request.url);

    // ── R2 File Read (GET /file/:key) ──
    if (request.method === 'GET' && url.pathname.startsWith('/file/')) {
      const key = url.pathname.slice(6);
      if (!key) return new Response('Key required', { status: 400, headers });

      const object = await env.STORAGE.get(key);
      if (!object) return new Response('Not found', { status: 404, headers });

      // [HIGH-04] User-generated content (HTML/JSON) must be re-validated; binary assets can be immutable
      const ct = object.httpMetadata?.contentType || 'application/octet-stream';
      const isUserContent = ct.startsWith('text/html') || ct.startsWith('application/json');
      const cacheHeader = isUserContent
        ? 'public, max-age=3600, must-revalidate'
        : 'public, max-age=31536000, immutable';

      return new Response(object.body, {
        headers: {
          ...headers,
          'Content-Type': ct,
          'Cache-Control': cacheHeader,
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Not found', { status: 404, headers });
    }

    // ── R2 Upload (POST /upload) ──
    if (url.pathname === '/upload') {
      try {
        requireKV(env); // [CRIT-02] fail-closed

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
        if (payment.uploadsRemaining !== undefined && payment.uploadsRemaining <= 0) {
          return Response.json({ error: 'Upload limit reached for this payment' }, { status: 402, headers });
        }

        // Decrement counter (KV; subject to known race per CRIT-05 — Durable Object upgrade pending Workers Paid)
        payment.uploadsRemaining = (payment.uploadsRemaining ?? 2) - 1;
        payment.lastUploadAt = Date.now();
        await env.USED_TXS.put(txHash, JSON.stringify(payment), { expirationTtl: 60 * 60 * 24 * 90 });

        // [HIGH-02] Quick reject via Content-Length hint then enforce during streaming read
        const contentLengthHint = Number(request.headers.get('Content-Length') || 0);
        if (contentLengthHint > MAX_UPLOAD_SIZE) {
          return Response.json({ error: 'File too large (max 5MB)' }, { status: 413, headers });
        }

        const contentType = request.headers.get('Content-Type') || '';
        const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'application/json', 'text/html', 'text/plain'];
        if (!allowedTypes.some((t) => contentType.startsWith(t))) {
          return Response.json({ error: 'Unsupported content type' }, { status: 400, headers });
        }

        const read = await readBodyWithLimit(request, MAX_UPLOAD_SIZE);
        if (read.error) {
          const status = read.error.includes('exceeded') ? 413 : 400;
          return Response.json({ error: read.error }, { status, headers });
        }
        const body = read.body;

        // Magic-bytes spoofing check for binary types
        const bytes = new Uint8Array(body.slice(0, 12));
        const detected = detectMimeType(bytes);
        if (detected && !contentType.startsWith(detected)) {
          if (!contentType.includes('json') && !contentType.includes('text') && !contentType.includes('svg')) {
            return Response.json({ error: 'Content-Type mismatch' }, { status: 400, headers });
          }
        }

        const ext = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg'
          : contentType.includes('png') ? 'png'
          : contentType.includes('svg') ? 'svg'
          : contentType.includes('json') ? 'json'
          : contentType.includes('html') ? 'html'
          : 'bin';
        const key = `${generateId()}.${ext}`;

        await env.STORAGE.put(key, body, { httpMetadata: { contentType } });

        const fileUrl = `https://api.inksuite.xyz/file/${key}`;
        return Response.json({ key, url: fileUrl }, {
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
