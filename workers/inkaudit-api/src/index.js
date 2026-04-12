function corsHeaders(origin, allowedOrigin) {
  const allowed = origin === allowedOrigin || origin?.startsWith('http://localhost');
  return {
    'Access-Control-Allow-Origin': allowed ? origin : allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function checkCSP(value) {
  if (!value) return { present: false, score: 0, grade: 'F', detail: 'Missing Content-Security-Policy header' };
  const directives = value.split(';').map(d => d.trim().toLowerCase());
  let score = 40; // Base for having CSP
  const issues = [];

  if (directives.some(d => d.includes("'unsafe-inline'") && d.startsWith('script-src'))) {
    issues.push("script-src allows 'unsafe-inline' — XSS risk");
    score -= 10;
  }
  if (directives.some(d => d.includes("'unsafe-eval'") && d.startsWith('script-src'))) {
    issues.push("script-src allows 'unsafe-eval' — code injection risk");
    score -= 10;
  }
  if (!directives.some(d => d.startsWith('default-src'))) {
    issues.push('No default-src directive');
    score -= 5;
  }
  if (directives.some(d => d.includes('*') && !d.includes('*.walletconnect'))) {
    issues.push('Wildcard (*) source detected — overly permissive');
    score -= 10;
  }
  if (!directives.some(d => d.startsWith('frame-ancestors'))) {
    issues.push("No frame-ancestors directive — consider adding frame-ancestors 'none'");
    score -= 5;
  }

  const grade = score >= 35 ? 'A' : score >= 25 ? 'B' : score >= 15 ? 'C' : 'D';
  return { present: true, score: Math.max(0, score), grade, detail: issues.length ? issues.join('; ') : 'Well configured', raw: value };
}

function checkHSTS(value) {
  if (!value) return { present: false, score: 0, grade: 'F', detail: 'Missing Strict-Transport-Security header' };
  let score = 30;
  const issues = [];

  const maxAge = value.match(/max-age=(\d+)/);
  if (maxAge) {
    const age = parseInt(maxAge[1], 10);
    if (age < 31536000) { issues.push(`max-age=${age} is less than 1 year (31536000 recommended)`); score -= 5; }
  } else { issues.push('No max-age directive'); score -= 10; }

  if (!value.toLowerCase().includes('includesubdomains')) { issues.push('Missing includeSubDomains'); score -= 5; }
  if (!value.toLowerCase().includes('preload')) { issues.push('Missing preload directive'); score -= 5; }

  const grade = score >= 25 ? 'A' : score >= 15 ? 'B' : 'C';
  return { present: true, score: Math.max(0, score), grade, detail: issues.length ? issues.join('; ') : 'Well configured', raw: value };
}

function checkHeader(name, value, maxScore, recommended) {
  if (!value) return { present: false, score: 0, grade: 'F', detail: `Missing ${name} header. Recommended: ${recommended}` };
  const isGood = value.toLowerCase() === recommended.toLowerCase();
  return {
    present: true,
    score: isGood ? maxScore : Math.floor(maxScore * 0.7),
    grade: isGood ? 'A' : 'B',
    detail: isGood ? 'Correctly set' : `Set to "${value}" — recommended: "${recommended}"`,
    raw: value,
  };
}

function checkHTTPS(url) {
  const isHttps = url.startsWith('https://');
  return {
    present: isHttps,
    score: isHttps ? 10 : 0,
    grade: isHttps ? 'A' : 'F',
    detail: isHttps ? 'Site uses HTTPS' : 'Site does not use HTTPS — critical security issue',
  };
}

function checkServer(value) {
  if (!value) return { present: false, score: 5, grade: 'A', detail: 'Server header not exposed — good' };
  return {
    present: true,
    score: 2,
    grade: 'C',
    detail: `Server header exposes: "${value}" — consider removing to reduce attack surface`,
    raw: value,
  };
}

function computeOverall(checks) {
  const totalScore = Object.values(checks).reduce((sum, c) => sum + c.score, 0);
  const maxPossible = 100;
  const pct = Math.round((totalScore / maxPossible) * 100);
  let grade, label;
  if (pct >= 90) { grade = 'A'; label = 'Excellent'; }
  else if (pct >= 75) { grade = 'B'; label = 'Good'; }
  else if (pct >= 55) { grade = 'C'; label = 'Fair'; }
  else if (pct >= 35) { grade = 'D'; label = 'Poor'; }
  else { grade = 'F'; label = 'Critical'; }
  return { score: totalScore, maxScore: maxPossible, percentage: pct, grade, label };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = corsHeaders(origin, env.ALLOWED_ORIGIN);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/scan') {
      return new Response('Not found', { status: 404, headers });
    }

    try {
      const { url: targetUrl } = await request.json();
      if (!targetUrl || typeof targetUrl !== 'string') {
        return Response.json({ error: 'URL required' }, { status: 400, headers });
      }

      // Normalize URL
      let scanUrl = targetUrl.trim();
      if (!scanUrl.startsWith('http://') && !scanUrl.startsWith('https://')) {
        scanUrl = 'https://' + scanUrl;
      }

      // Fetch the target
      let response;
      try {
        response = await fetch(scanUrl, {
          method: 'GET',
          redirect: 'follow',
          headers: { 'User-Agent': 'InkAudit/1.0 (security scanner)' },
        });
      } catch (e) {
        return Response.json({ error: `Could not reach ${scanUrl}: ${e.message}` }, { status: 422, headers });
      }

      const h = response.headers;

      // Run checks
      const checks = {
        https: checkHTTPS(response.url || scanUrl),
        csp: checkCSP(h.get('content-security-policy')),
        hsts: checkHSTS(h.get('strict-transport-security')),
        xFrameOptions: checkHeader('X-Frame-Options', h.get('x-frame-options'), 10, 'DENY'),
        xContentType: checkHeader('X-Content-Type-Options', h.get('x-content-type-options'), 10, 'nosniff'),
        referrerPolicy: checkHeader('Referrer-Policy', h.get('referrer-policy'), 5, 'strict-origin-when-cross-origin'),
        permissionsPolicy: checkHeader('Permissions-Policy', h.get('permissions-policy'), 5, 'camera=(), microphone=(), geolocation=()'),
        server: checkServer(h.get('server')),
      };

      const overall = computeOverall(checks);

      const result = {
        url: response.url || scanUrl,
        statusCode: response.status,
        scannedAt: new Date().toISOString(),
        overall,
        checks,
      };

      return Response.json(result, { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
    } catch (e) {
      return Response.json({ error: e.message || 'Scan failed' }, { status: 500, headers });
    }
  },
};
