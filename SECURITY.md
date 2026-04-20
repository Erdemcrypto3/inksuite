# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Ink Suite, please email
**security@inksuite.xyz**. Do NOT open a public GitHub issue.

We aim to acknowledge reports within 48 hours.

## Scope

**Smart contracts (Ink mainnet):**
- InkPoll: `0x5ce45f8A28FffFf7A94390DE048610ff4146ff3c`
- InkMint: `0x964bf77C2cF0901F0acFaC277601816d2dbEACEe`
- InkPress: `0x7A0bB0C37a934b3858436E61838719a5a7F63720`

**Web apps:** `*.inksuite.xyz`

**Cloudflare Workers:**
- `api.inksuite.xyz` (inkmint-api — payments, uploads, AI generation)
- `audit-api.inksuite.xyz` (inkaudit-api — security header scanner)

## Out of Scope

- Rate limits on read-only endpoints
- CSP unsafe-inline in style-src (required for Next.js runtime)
- Self-XSS requiring victim to paste attacker payload into dev console
- Issues in third-party dependencies without a clear exploit path

## Bounty

No formal bounty program at this time. Responsible disclosures will be
credited in release notes.
