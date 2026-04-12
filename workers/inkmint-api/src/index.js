const STABILITY_API = 'https://api.stability.ai/v2beta/stable-image/generate/sd3';

function corsHeaders(origin, allowedOrigin) {
  // Allow localhost for dev + production domain
  const allowed = origin === allowedOrigin || origin?.startsWith('http://localhost');
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

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    // Only accept POST /generate
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/generate') {
      return new Response('Not found', { status: 404, headers });
    }

    try {
      const { prompt } = await request.json();
      if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
        return new Response('Prompt must be at least 3 characters', { status: 400, headers });
      }

      // Call Stability AI
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
  },
};
