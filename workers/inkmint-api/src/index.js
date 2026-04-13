const STABILITY_API = 'https://api.stability.ai/v2beta/stable-image/generate/core';
const BLOCKSCOUT_API = 'https://explorer.inkonchain.com/api';
const GENERATION_FEE = 0.0002; // ETH
const FEE_RECIPIENT = '0x9E84D77264d94C646dF91A70dbae99C20330eAD0';

function corsHeaders(origin, allowedOrigin) {
  const allowed = origin === allowedOrigin || origin?.includes('.inksuite.xyz') || origin?.startsWith('http://localhost');
  return {
    'Access-Control-Allow-Origin': allowed ? origin : allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// Verify generation fee payment via Blockscout
async function verifyPayment(txHash) {
  try {
    const res = await fetch(`${BLOCKSCOUT_API}?module=transaction&action=gettxinfo&txhash=${txHash}`);
    const data = await res.json();
    if (data.status !== '1' || !data.result) return { valid: false, reason: 'Transaction not found' };
    const tx = data.result;
    if (tx.to?.toLowerCase() !== FEE_RECIPIENT.toLowerCase()) return { valid: false, reason: 'Wrong recipient' };
    const valueEth = Number(tx.value) / 1e18;
    if (valueEth < GENERATION_FEE * 0.95) return { valid: false, reason: `Insufficient payment: ${valueEth} ETH` };
    if (tx.success === false) return { valid: false, reason: 'Transaction failed' };
    return { valid: true, from: tx.from };
  } catch (e) {
    return { valid: false, reason: 'Verification failed: ' + e.message };
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
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
      const key = url.pathname.slice(6); // remove "/file/"
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

    // ── R2 Upload (POST /upload) ──
    if (url.pathname === '/upload') {
      try {
        const body = await request.arrayBuffer();
        const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
        const ext = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg'
          : contentType.includes('png') ? 'png'
          : contentType.includes('json') ? 'json'
          : 'bin';
        const key = `${generateId()}.${ext}`;

        await env.STORAGE.put(key, body, {
          httpMetadata: { contentType },
        });

        const fileUrl = `https://api.inksuite.xyz/file/${key}`;
        return Response.json({ key, url: fileUrl }, {
          status: 200,
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        console.error('R2 upload error:', e);
        return Response.json({ error: e.message }, { status: 500, headers });
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

        // Verify payment
        console.log('Verifying payment tx:', txHash);
        const payment = await verifyPayment(txHash);
        if (!payment.valid) {
          console.error('Payment verification failed:', payment.reason);
          return Response.json({ error: `Payment invalid: ${payment.reason}` }, { status: 402, headers });
        }
        console.log('Payment verified from:', payment.from);

        // Generate image
        console.log('Calling Stability AI with prompt:', prompt.trim());
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

        const imageBuffer = await aiRes.arrayBuffer();

        return new Response(imageBuffer, {
          status: 200,
          headers: {
            ...headers,
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'no-store',
          },
        });
      } catch (e) {
        console.error('Worker error:', e);
        return Response.json({ error: 'Internal error: ' + e.message }, { status: 500, headers });
      }
    }

    return new Response('Not found', { status: 404, headers });
  },
};
