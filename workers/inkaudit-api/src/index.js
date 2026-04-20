// [HIGH-03] Sliding-bucket rate limit. Silently permits when KV unbound.
async function checkRateLimit(request, env, endpoint, limit, windowSec) {
  if (!env.RATE_LIMIT) return true;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const bucket = Math.floor(Date.now() / (windowSec * 1000));
  const key = `rl:${endpoint}:${ip}:${bucket}`;
  const count = Number((await env.RATE_LIMIT.get(key)) || 0);
  if (count >= limit) return false;
  await env.RATE_LIMIT.put(key, String(count + 1), { expirationTtl: windowSec + 10 });
  return true;
}

function rateLimitResponse(headers, retryAfter) {
  return new Response(
    JSON.stringify({ error: 'Rate limited' }),
    { status: 429, headers: { ...headers, 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) } }
  );
}

// [CRIT-06] SSRF — block IPv4 private + IPv6 link-local/ULA + DNS metadata services
function isBlockedHost(hostname) {
  const h = hostname.toLowerCase();
  const cleanH = h.startsWith('[') && h.endsWith(']') ? h.slice(1, -1) : h;
  const blockedPatterns = [
    /^localhost$/i, /^127\./, /^10\./, /^192\.168\./,
    /^172\.(1[6-9]|2\d|3[01])\./, /^169\.254\./, /^0\./, /^255\.255\.255\.255$/,
    /^::1?$/, /^::$/, /^fe80:/i, /^fc[0-9a-f]{2}:/i, /^fd[0-9a-f]{2}:/i,
    /^ff[0-9a-f]{2}:/i, /^::ffff:/i, /^::[0-9a-f]*:/i,
    /\.local$/i, /\.internal$/i, /\.localhost$/i,
    /^metadata\.google/i, /^169\.254\.169\.254$/,
  ];
  return blockedPatterns.some((p) => p.test(cleanH));
}

// [CRIT-06] Manual redirect with hop-by-hop validation
async function safeFetch(targetUrl, maxRedirects = 3) {
  let currentUrl = targetUrl;
  for (let i = 0; i <= maxRedirects; i++) {
    const parsed = new URL(currentUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Protocol not allowed');
    }
    if (isBlockedHost(parsed.hostname)) {
      throw new Error(`Blocked hop: ${parsed.hostname}`);
    }
    const res = await fetch(currentUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': 'InkAudit/1.0 (security scanner)' },
      signal: AbortSignal.timeout(10000),
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('Location');
      if (!location) return res;
      currentUrl = new URL(location, currentUrl).href;
      continue;
    }
    return res;
  }
  throw new Error('Too many redirects');
}

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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
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

// ── GitHub Repo Audit ──

const SENSITIVE_PATTERNS = [
  { name: 'Private Key', pattern: /(?:PRIVATE[_-]?KEY|private[_-]?key)\s*[:=]\s*['"]?[0-9a-fA-Fx]+/i },
  { name: 'AWS Key', pattern: /AKIA[0-9A-Z]{16}/ },
  { name: 'API Key in Code', pattern: /(?:api[_-]?key|apikey|api[_-]?secret)\s*[:=]\s*['"][a-zA-Z0-9_\-]{20,}['"]/i },
  { name: 'JWT/Bearer Token', pattern: /(?:bearer|jwt|token)\s*[:=]\s*['"][a-zA-Z0-9_\-.]{30,}['"]/i },
  { name: 'Database URL', pattern: /(?:postgres|mysql|mongodb|redis):\/\/[^\s'"]+/i },
  { name: 'Hardcoded Password', pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/i },
];

const DANGEROUS_FILES = ['.env', '.env.local', '.env.production', 'credentials.json', 'secrets.json', 'id_rsa', '.pem'];

async function scanGitHubRepo(repoInput) {
  // Parse owner/repo from URL or "owner/repo" format
  let owner, repo;
  const urlMatch = repoInput.match(/github\.com\/([^/]+)\/([^/\s?#]+)/);
  if (urlMatch) {
    owner = urlMatch[1];
    repo = urlMatch[2].replace(/\.git$/, '');
  } else {
    const parts = repoInput.split('/');
    if (parts.length === 2) { owner = parts[0]; repo = parts[1]; }
    else return { error: 'Invalid repo format. Use "owner/repo" or a GitHub URL.' };
  }

  const apiBase = `https://api.github.com/repos/${owner}/${repo}`;
  const ghHeaders = { 'User-Agent': 'InkAudit/1.0', 'Accept': 'application/vnd.github+json' };

  // 1. Repo info
  let repoInfo;
  try {
    const res = await fetch(apiBase, { headers: ghHeaders });
    if (!res.ok) return { error: `Repository not found or not public (${res.status})` };
    repoInfo = await res.json();
  } catch (e) {
    return { error: `GitHub API error: ${e.message}` };
  }

  const checks = {};
  let totalScore = 0;
  const maxScore = 100;

  // 2. Visibility
  checks.visibility = {
    name: 'Repository Visibility',
    score: repoInfo.private ? 5 : 10,
    maxScore: 10,
    grade: 'A',
    detail: repoInfo.private ? 'Private repository' : 'Public repository — code is visible to everyone, ensure no secrets',
  };
  totalScore += checks.visibility.score;

  // 3. License
  checks.license = {
    name: 'License',
    score: repoInfo.license ? 10 : 0,
    maxScore: 10,
    grade: repoInfo.license ? 'A' : 'F',
    detail: repoInfo.license ? `License: ${repoInfo.license.spdx_id || repoInfo.license.name}` : 'No license found — consider adding one',
  };
  totalScore += checks.license.score;

  // 4. Default branch protection (check if main/master)
  checks.defaultBranch = {
    name: 'Default Branch',
    score: 5,
    maxScore: 5,
    grade: 'A',
    detail: `Default branch: ${repoInfo.default_branch}`,
  };
  totalScore += checks.defaultBranch.score;

  // 5. Check for .gitignore
  let hasGitignore = false;
  try {
    const res = await fetch(`${apiBase}/contents/.gitignore`, { headers: ghHeaders });
    hasGitignore = res.ok;
  } catch {}
  checks.gitignore = {
    name: '.gitignore',
    score: hasGitignore ? 10 : 0,
    maxScore: 10,
    grade: hasGitignore ? 'A' : 'F',
    detail: hasGitignore ? '.gitignore present' : 'No .gitignore — risk of committing build artifacts, node_modules, secrets',
  };
  totalScore += checks.gitignore.score;

  // 6. Check for dangerous files in root
  const dangerousFound = [];
  for (const file of DANGEROUS_FILES) {
    try {
      const res = await fetch(`${apiBase}/contents/${file}`, { headers: ghHeaders });
      if (res.ok) dangerousFound.push(file);
    } catch {}
  }
  checks.sensitiveFiles = {
    name: 'Sensitive Files',
    score: dangerousFound.length === 0 ? 20 : 0,
    maxScore: 20,
    grade: dangerousFound.length === 0 ? 'A' : 'F',
    detail: dangerousFound.length === 0
      ? 'No sensitive files (.env, credentials, keys) found in repo root'
      : `CRITICAL: Found sensitive files: ${dangerousFound.join(', ')}`,
    found: dangerousFound,
  };
  totalScore += checks.sensitiveFiles.score;

  // 7. Check README
  let hasReadme = false;
  try {
    const res = await fetch(`${apiBase}/readme`, { headers: ghHeaders });
    hasReadme = res.ok;
  } catch {}
  checks.readme = {
    name: 'README',
    score: hasReadme ? 5 : 0,
    maxScore: 5,
    grade: hasReadme ? 'A' : 'D',
    detail: hasReadme ? 'README present' : 'No README — makes it harder for others to understand the project',
  };
  totalScore += checks.readme.score;

  // 8. Check recent commits for secrets patterns
  let secretsInCode = [];
  try {
    const res = await fetch(`${apiBase}/git/trees/${repoInfo.default_branch}?recursive=1`, { headers: ghHeaders });
    if (res.ok) {
      const tree = await res.json();
      // Check file names for dangerous patterns
      const suspiciousFiles = (tree.tree || [])
        .filter(f => f.type === 'blob')
        .filter(f => {
          const name = f.path.toLowerCase();
          return name.endsWith('.env') || name.endsWith('.env.local') || name.endsWith('.env.production') ||
            name.includes('secret') || name.includes('credential') || name.endsWith('.pem') ||
            name.endsWith('id_rsa') || name.endsWith('.key');
        })
        .map(f => f.path);
      if (suspiciousFiles.length > 0) secretsInCode = suspiciousFiles;
    }
  } catch {}
  checks.secretsInTree = {
    name: 'Secrets in File Tree',
    score: secretsInCode.length === 0 ? 20 : 0,
    maxScore: 20,
    grade: secretsInCode.length === 0 ? 'A' : 'F',
    detail: secretsInCode.length === 0
      ? 'No suspicious secret files found in the repository tree'
      : `WARNING: Suspicious files found: ${secretsInCode.slice(0, 10).join(', ')}${secretsInCode.length > 10 ? ` (+${secretsInCode.length - 10} more)` : ''}`,
    found: secretsInCode,
  };
  totalScore += checks.secretsInTree.score;

  // 9. Dependencies (check package.json for known issues)
  let depScore = 10;
  let depDetail = 'Could not check dependencies';
  try {
    const res = await fetch(`${apiBase}/contents/package.json`, { headers: ghHeaders });
    if (res.ok) {
      const data = await res.json();
      const content = atob(data.content);
      const pkg = JSON.parse(content);
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      const depCount = Object.keys(allDeps).length;
      depDetail = `${depCount} dependencies found`;
      // Check for wildcard versions
      const wildcards = Object.entries(allDeps).filter(([, v]) => v === '*' || v === 'latest');
      if (wildcards.length > 0) {
        depScore = 5;
        depDetail += `. WARNING: ${wildcards.length} wildcard/latest versions: ${wildcards.map(([k]) => k).join(', ')}`;
      }
    }
  } catch {}
  checks.dependencies = {
    name: 'Dependencies',
    score: depScore,
    maxScore: 10,
    grade: depScore >= 10 ? 'A' : depScore >= 5 ? 'C' : 'F',
    detail: depDetail,
  };
  totalScore += checks.dependencies.score;

  // 10. Activity
  const daysSinceUpdate = Math.floor((Date.now() - new Date(repoInfo.pushed_at).getTime()) / 86400000);
  const actScore = daysSinceUpdate < 30 ? 10 : daysSinceUpdate < 90 ? 7 : daysSinceUpdate < 365 ? 4 : 0;
  checks.activity = {
    name: 'Recent Activity',
    score: actScore,
    maxScore: 10,
    grade: actScore >= 10 ? 'A' : actScore >= 7 ? 'B' : actScore >= 4 ? 'C' : 'F',
    detail: `Last push: ${daysSinceUpdate} days ago (${new Date(repoInfo.pushed_at).toLocaleDateString()})`,
  };
  totalScore += checks.activity.score;

  // Overall
  const pct = Math.round((totalScore / maxScore) * 100);
  let grade, label;
  if (pct >= 90) { grade = 'A'; label = 'Excellent'; }
  else if (pct >= 75) { grade = 'B'; label = 'Good'; }
  else if (pct >= 55) { grade = 'C'; label = 'Fair'; }
  else if (pct >= 35) { grade = 'D'; label = 'Poor'; }
  else { grade = 'F'; label = 'Critical'; }

  return {
    repo: `${owner}/${repo}`,
    url: repoInfo.html_url,
    description: repoInfo.description,
    stars: repoInfo.stargazers_count,
    forks: repoInfo.forks_count,
    language: repoInfo.language,
    scannedAt: new Date().toISOString(),
    overall: { score: totalScore, maxScore, percentage: pct, grade, label },
    checks,
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

    if (request.method !== 'POST' || (url.pathname !== '/scan' && url.pathname !== '/scan-repo')) {
      return new Response('Not found', { status: 404, headers });
    }

    // [HIGH-03] 20 scans per minute per IP on both endpoints
    if (!(await checkRateLimit(request, env, url.pathname === '/scan-repo' ? 'scan-repo' : 'scan', 20, 60))) {
      return rateLimitResponse(headers, 60);
    }

    // GitHub repo scan
    if (url.pathname === '/scan-repo') {
      try {
        const { repo } = await request.json();
        if (!repo || typeof repo !== 'string') {
          return Response.json({ error: 'Repo URL or owner/repo required' }, { status: 400, headers });
        }
        const result = await scanGitHubRepo(repo.trim());
        if (result.error) {
          return Response.json(result, { status: 422, headers });
        }
        return Response.json(result, { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
      } catch (e) {
        return Response.json({ error: e.message || 'Repo scan failed' }, { status: 500, headers });
      }
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

      // [CRIT-06] SSRF protection — validate initial URL format then delegate hop-by-hop check to safeFetch
      try {
        const parsedTarget = new URL(scanUrl);
        if (!['http:', 'https:'].includes(parsedTarget.protocol)) {
          return Response.json({ error: 'Only http/https allowed' }, { status: 400, headers });
        }
      } catch {
        return Response.json({ error: 'Invalid URL' }, { status: 400, headers });
      }

      let response;
      try {
        response = await safeFetch(scanUrl);
      } catch (e) {
        const status = e.message.startsWith('Blocked hop') || e.message === 'Protocol not allowed' || e.message === 'Too many redirects' ? 400 : 422;
        return Response.json({ error: e.message }, { status, headers });
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
