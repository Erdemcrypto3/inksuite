const STABILITY_API = 'https://api.stability.ai/v2beta/stable-image/generate/core';
const WALRUS_PUBLISHER = 'https://walrus-mainnet-publisher-1.staketab.org';
const BLOCKSCOUT_API = 'https://explorer.inkonchain.com/api';
const GENERATION_FEE = 0.0002; // ETH
const FEE_RECIPIENT = '0x9E84D77264d94C646dF91A70dbae99C20330eAD0';

function corsHeaders(origin, allowedOrigin) {
  const allowed = origin === allowedOrigin || origin?.includes('.inksuite.xyz') || origin?.startsWith('http://localhost');
  return {
    'Access-Control-Allow-Origin': allowed ? origin : allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// Verify that a tx is a valid generation fee payment
async function verifyPayment(txHash) {
  try {
    const res = await fetch(`${BLOCKSCOUT_API}?module=transaction&action=gettxinfo&txhash=${txHash}`);
    const data = await res.json();
    if (data.status !== '1' || !data.result) return { valid: false, reason: 'Transaction not found' };

    const tx = data.result;
    // Check recipient
    if (tx.to?.toLowerCase() !== FEE_RECIPIENT.toLowerCase()) {
      return { valid: false, reason: 'Wrong recipient' };
    }
    // Check value (allow small tolerance for gas fluctuation)
    const valueEth = Number(tx.value) / 1e18;
    if (valueEth < GENERATION_FEE * 0.95) {
      return { valid: false, reason: `Insufficient payment: ${valueEth} ETH (need ${GENERATION_FEE})` };
    }
    // Check success
    if (tx.success === false) {
      return { valid: false, reason: 'Transaction failed' };
    }
    return { valid: true, from: tx.from };
  } catch (e) {
    return { valid: false, reason: 'Verification failed: ' + e.message };
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = corsHeaders(origin, env.ALLOWED_ORIGIN);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    const url = new URL(request.url);

    if (request.method !== 'POST') {
      return new Response('Not found', { status: 404, headers });
    }

    // ── Walrus Upload Proxy ──
    if (url.pathname === '/walrus-upload') {
      try {
        const body = await request.arrayBuffer();
        const contentType = request.headers.get('Content-Type') || 'application/octet-stream';

        const walrusRes = await fetch(`${WALRUS_PUBLISHER}/v1/blobs`, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: body,
        });

        if (!walrusRes.ok) {
          const errText = await walrusRes.text();
          console.error('Walrus error:', walrusRes.status, errText);
          return Response.json(
            { error: `Walrus upload failed: ${walrusRes.status}` },
            { status: 502, headers }
          );
        }

        const data = await walrusRes.json();
        return Response.json(data, {
          status: 200,
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        console.error('Walrus proxy error:', e);
        return Response.json({ error: e.message }, { status: 500, headers });
      }
    }

    // ── Stability AI Image Generation (requires payment proof) ──
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
        formData.set('output_format', 'png');

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
            'Content-Type': 'image/png',
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
