const STABILITY_API = 'https://api.stability.ai/v2beta/stable-image/generate/sd3';
const WALRUS_PUBLISHER = 'https://walrus-mainnet-publisher-1.staketab.org';

function corsHeaders(origin, allowedOrigin) {
  const allowed = origin === allowedOrigin || origin?.includes('.inksuite.xyz') || origin?.startsWith('http://localhost');
  return {
    'Access-Control-Allow-Origin': allowed ? origin : allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
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

    // ── Stability AI Image Generation ──
    if (url.pathname === '/generate') {
      try {
        const { prompt } = await request.json();
        if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
          return new Response('Prompt must be at least 3 characters', { status: 400, headers });
        }

        const formData = new FormData();
        formData.append('prompt', prompt.trim());
        formData.append('output_format', 'png');
        formData.append('aspect_ratio', '1:1');

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
          return new Response(`AI generation failed: ${aiRes.status}`, { status: 502, headers });
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
        return new Response('Internal error', { status: 500, headers });
      }
    }

    return new Response('Not found', { status: 404, headers });
  },
};
