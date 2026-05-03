import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';

const VALID_ORIGIN = 'https://mint.inksuite.xyz';
const INVALID_ORIGIN = 'https://evil.com';
const VALID_TX = '0x' + 'ab'.repeat(32);

describe('GET /api/config', () => {
  it('returns contract addresses', async () => {
    const res = await SELF.fetch('https://api.inksuite.xyz/api/config');
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data.inkmint).toBe('0x964bf77C2cF0901F0acFaC277601816d2dbEACEe');
    expect(data.inkpoll).toBe('0x5ce45f8A28FffFf7A94390DE048610ff4146ff3c');
    expect(data.inkpollV2).toBe('0x4ec2F88AA8E5a1054450909D2b86cE2E285b1b72');
    expect(data.inkpress).toBe('0x7A0bB0C37a934b3858436E61838719a5a7F63720');
  });

  it('includes Cache-Control header', async () => {
    const res = await SELF.fetch('https://api.inksuite.xyz/api/config');
    expect(res.headers.get('Cache-Control')).toContain('max-age=60');
  });
});

describe('CORS', () => {
  it('reflects allowed origin', async () => {
    const res = await SELF.fetch('https://api.inksuite.xyz/api/config', {
      headers: { Origin: VALID_ORIGIN },
    });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(VALID_ORIGIN);
  });

  it('allows inksuite.xyz subdomains', async () => {
    const res = await SELF.fetch('https://api.inksuite.xyz/api/config', {
      headers: { Origin: 'https://poll.inksuite.xyz' },
    });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://poll.inksuite.xyz');
  });

  it('allows localhost in dev', async () => {
    const res = await SELF.fetch('https://api.inksuite.xyz/api/config', {
      headers: { Origin: 'http://localhost:3000' },
    });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
  });

  it('rejects invalid origin', async () => {
    const res = await SELF.fetch('https://api.inksuite.xyz/api/config', {
      headers: { Origin: INVALID_ORIGIN },
    });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(VALID_ORIGIN);
  });

  it('handles OPTIONS preflight', async () => {
    const res = await SELF.fetch('https://api.inksuite.xyz/api/config', {
      method: 'OPTIONS',
      headers: { Origin: VALID_ORIGIN },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });
});

describe('GET /file/*', () => {
  beforeEach(async () => {
    await env.STORAGE.put('score/test.svg', '<svg></svg>', {
      httpMetadata: { contentType: 'image/svg+xml' },
    });
    await env.STORAGE.put('covers/img.jpg', new Uint8Array([0xFF, 0xD8, 0xFF]), {
      httpMetadata: { contentType: 'image/jpeg' },
    });
  });

  it('serves files from allowed prefix', async () => {
    const res = await SELF.fetch('https://api.inksuite.xyz/file/score/test.svg');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('<svg></svg>');
  });

  it('returns CSP sandbox header', async () => {
    const res = await SELF.fetch('https://api.inksuite.xyz/file/score/test.svg');
    expect(res.headers.get('Content-Security-Policy')).toBe("default-src 'none'; sandbox");
  });

  it('returns Content-Disposition: attachment', async () => {
    const res = await SELF.fetch('https://api.inksuite.xyz/file/score/test.svg');
    expect(res.headers.get('Content-Disposition')).toBe('attachment');
  });

  it('rejects disallowed prefix', async () => {
    const res = await SELF.fetch('https://api.inksuite.xyz/file/secret/data.json');
    expect(res.status).toBe(403);
  });

  it('returns 404 for missing file', async () => {
    const res = await SELF.fetch('https://api.inksuite.xyz/file/score/nonexistent.svg');
    expect(res.status).toBe(404);
  });

  it('sets immutable cache for images', async () => {
    const res = await SELF.fetch('https://api.inksuite.xyz/file/covers/img.jpg');
    expect(res.headers.get('Cache-Control')).toContain('immutable');
  });
});

describe('POST /upload-score', () => {
  it('accepts SVG uploads', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
    const res = await SELF.fetch('https://api.inksuite.xyz/upload-score', {
      method: 'POST',
      headers: { 'Content-Type': 'image/svg+xml', Origin: VALID_ORIGIN },
      body: svg,
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { key: string; url: string };
    expect(data.key).toMatch(/^score\/[a-f0-9]+\.svg$/);
    expect(data.url).toContain('api.inksuite.xyz/file/');
  });

  it('accepts JSON uploads', async () => {
    const json = JSON.stringify({ score: 100 });
    const res = await SELF.fetch('https://api.inksuite.xyz/upload-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: VALID_ORIGIN },
      body: json,
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { key: string };
    expect(data.key).toMatch(/\.json$/);
  });

  it('rejects disallowed content types', async () => {
    const res = await SELF.fetch('https://api.inksuite.xyz/upload-score', {
      method: 'POST',
      headers: { 'Content-Type': 'text/html', Origin: VALID_ORIGIN },
      body: '<h1>hack</h1>',
    });
    expect(res.status).toBe(400);
  });

  it('sanitizes SVG script tags', async () => {
    const malicious = '<svg><script>alert(1)</script><rect/></svg>';
    const res = await SELF.fetch('https://api.inksuite.xyz/upload-score', {
      method: 'POST',
      headers: { 'Content-Type': 'image/svg+xml', Origin: VALID_ORIGIN },
      body: malicious,
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { key: string };
    const stored = await env.STORAGE.get(data.key);
    const text = await stored!.text();
    expect(text).not.toContain('<script');
  });

  it('sanitizes SVG event handlers', async () => {
    const malicious = '<svg><rect onload="alert(1)"/></svg>';
    const res = await SELF.fetch('https://api.inksuite.xyz/upload-score', {
      method: 'POST',
      headers: { 'Content-Type': 'image/svg+xml', Origin: VALID_ORIGIN },
      body: malicious,
    });
    const data = await res.json() as { key: string };
    const stored = await env.STORAGE.get(data.key);
    const text = await stored!.text();
    expect(text).not.toContain('onload');
  });

  it('rejects oversized uploads', async () => {
    const big = 'x'.repeat(51 * 1024);
    const res = await SELF.fetch('https://api.inksuite.xyz/upload-score', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(big.length),
        Origin: VALID_ORIGIN,
      },
      body: big,
    });
    expect(res.status).toBe(413);
  });
});

describe('POST /upload', () => {
  it('requires X-Payment-Tx header', async () => {
    const res = await SELF.fetch('https://api.inksuite.xyz/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'image/png', Origin: VALID_ORIGIN },
      body: new Uint8Array([0x89, 0x50, 0x4E, 0x47]),
    });
    expect(res.status).toBe(402);
  });

  it('rejects invalid tx hash format', async () => {
    const res = await SELF.fetch('https://api.inksuite.xyz/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'image/png',
        'X-Payment-Tx': 'not-a-hash',
        Origin: VALID_ORIGIN,
      },
      body: new Uint8Array([0x89, 0x50, 0x4E, 0x47]),
    });
    expect(res.status).toBe(402);
    const data = await res.json() as { error: string };
    expect(data.error).toContain('Valid X-Payment-Tx');
  });

  it('rejects disallowed content types', async () => {
    const res = await SELF.fetch('https://api.inksuite.xyz/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/html',
        'X-Payment-Tx': VALID_TX,
        Origin: VALID_ORIGIN,
      },
      body: '<h1>hack</h1>',
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('POST /generate', () => {
  it('rejects missing body', async () => {
    const res = await SELF.fetch('https://api.inksuite.xyz/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: VALID_ORIGIN },
      body: '{}',
    });
    expect(res.status).toBe(400);
  });

  it('rejects short prompt', async () => {
    const res = await SELF.fetch('https://api.inksuite.xyz/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: VALID_ORIGIN },
      body: JSON.stringify({ prompt: 'ab', txHash: VALID_TX }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects missing txHash', async () => {
    const res = await SELF.fetch('https://api.inksuite.xyz/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: VALID_ORIGIN },
      body: JSON.stringify({ prompt: 'a cool cat in space' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects invalid txHash format', async () => {
    const res = await SELF.fetch('https://api.inksuite.xyz/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: VALID_ORIGIN },
      body: JSON.stringify({ prompt: 'a cool cat in space', txHash: 'bad' }),
    });
    expect(res.status).toBe(400);
  });

  it('trims prompt whitespace', async () => {
    const res = await SELF.fetch('https://api.inksuite.xyz/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: VALID_ORIGIN },
      body: JSON.stringify({ prompt: '  ab  ', txHash: VALID_TX }),
    });
    expect(res.status).toBe(400);
  });
});
