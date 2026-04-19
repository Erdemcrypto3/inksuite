const STABILITY_API = 'https://api.stability.ai/v2beta/stable-image/generate/core';
const FEE_RECIPIENT = '0x9E84D77264d94C646dF91A70dbae99C20330eAD0';
const INK_RPC = 'https://rpc-gel.inkonchain.com';
const INK_RPC_FALLBACK = 'https://rpc-qnd.inkonchain.com';
const MIN_FEE_WEI = 190000000000000n; // 0.00019 ETH (~95% of 0.0002)
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5MB

// [H-04 fix] Secure CORS — no wildcard bypass
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

// [L-03 fix] Cryptographically secure ID generation
function generateId() {
  return crypto.randomUUID().replace(/-/g, '');
}

// [C-02 fix] RPC-based payment verification with replay protection
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
  // 1. Format check
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return { valid: false, reason: 'Invalid tx hash format' };
  }

  // 2. [C-02] Replay protection — check if already used
  if (env.USED_TXS) {
    const existing = await env.USED_TXS.get(txHash);
    if (existing) {
      return { valid: false, reason: 'Transaction already used' };
    }
  }

  // 3. On-chain verification via RPC
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

  // 4. Recipient check
  if (tx.to?.toLowerCase() !== FEE_RECIPIENT.toLowerCase()) {
    return { valid: false, reason: 'Wrong recipient' };
  }

  // 5. Amount check
  const value = BigInt(tx.value);
  if (value < MIN_FEE_WEI) {
    return { valid: false, reason: `Insufficient: ${value} wei` };
  }

  // 6. [C-02] Mark as used (90 day TTL)
  if (env.USED_TXS) {
    await env.USED_TXS.put(
      txHash,
      JSON.stringify({ from: tx.from, value: tx.value, usedAt: Date.now(), uploadsRemaining: 2 }),
      { expirationTtl: 60 * 60 * 24 * 90 }
    );
  }

  return { valid: true, from: tx.from };
}

// Magic bytes detection for content-type spoofing prevention
function detectMimeType(bytes) {
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png';
  return null;
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

      return new Response(object.body, {
        headers: {
          ...headers,
          'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Not found', { status: 404, headers });
    }

    // ── [C-03 fix] R2 Upload with auth (POST /upload) ──
    if (url.pathname === '/upload') {
      try {
        // 1. Payment header required
        const txHash = request.headers.get('X-Payment-Tx');
        if (!txHash) {
          return Response.json({ error: 'X-Payment-Tx header required' }, { status: 402, headers });
        }

        // 2. Verify payment exists and has remaining uploads
        if (env.USED_TXS) {
          const paymentRaw = await env.USED_TXS.get(txHash);
          if (!paymentRaw) {
            return Response.json({ error: 'No valid payment for this tx' }, { status: 402, headers });
          }
          const payment = JSON.parse(paymentRaw);
          if (payment.uploadsRemaining !== undefined && payment.uploadsRemaining <= 0) {
            return Response.json({ error: 'Upload limit reached for this payment' }, { status: 402, headers });
          }

          // Decrement upload counter
          payment.uploadsRemaining = (payment.uploadsRemaining || 2) - 1;
          payment.lastUploadAt = Date.now();
          await env.USED_TXS.put(txHash, JSON.stringify(payment), { expirationTtl: 60 * 60 * 24 * 90 });
        }

        // 3. Size limit
        const contentLength = Number(request.headers.get('Content-Length') || 0);
        if (contentLength > MAX_UPLOAD_SIZE) {
          return Response.json({ error: 'File too large (max 5MB)' }, { status: 413, headers });
        }

        // 4. Content-Type whitelist
        const contentType = request.headers.get('Content-Type') || '';
        const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'application/json', 'text/html', 'text/plain'];
        if (!allowedTypes.some((t) => contentType.startsWith(t))) {
          return Response.json({ error: 'Unsupported content type' }, { status: 400, headers });
        }

        // 5. Read body
        const body = await request.arrayBuffer();
        if (body.byteLength > MAX_UPLOAD_SIZE) {
          return Response.json({ error: 'Too large' }, { status: 413, headers });
        }

        // 6. Magic bytes check (content-type spoofing prevention)
        const bytes = new Uint8Array(body.slice(0, 12));
        const detected = detectMimeType(bytes);
        if (detected && !contentType.startsWith(detected)) {
          if (!contentType.includes('json') && !contentType.includes('text') && !contentType.includes('svg')) {
            return Response.json({ error: `Content-Type mismatch` }, { status: 400, headers });
          }
        }

        // 7. Upload to R2
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
        console.error('R2 upload error:', e);
        return Response.json({ error: 'Upload failed' }, { status: 500, headers });
      }
    }

    // ── Stability AI Image Generation (POST /generate) ──
    if (url.pathname === '/generate') {
      try {
        const { prompt, txHash } = await request.json();
        if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
          return Response.json({ error: 'Prompt must be at least 3 characters' }, { status: 400, headers });
        }
        if (!txHash || typeof txHash !== 'string') {
          return Response.json({ error: 'Payment transaction hash required' }, { status: 400, headers });
        }

        // [C-02] Verify payment with replay protection
        const payment = await verifyPayment(txHash, env);
        if (!payment.valid) {
          return Response.json({ error: `Payment invalid: ${payment.reason}` }, { status: 402, headers });
        }

        // Generate image
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
        console.error('Worker error:', e);
        return Response.json({ error: 'Internal error' }, { status: 500, headers });
      }
    }

    return new Response('Not found', { status: 404, headers });
  },
};
