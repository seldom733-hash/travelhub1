---
name: navitravel-security
description: Navitravel security review — payments, PII, supplier credentials, signed webhooks, permissions, and secret handling. Use for finance flows, integrations, auth/RBAC, uploads, and any client/server trust boundary.
---

# Navitravel Security

Review the trust boundary, not just the happy path.

## Always check

- Client-submitted prices, amounts, statuses, and passenger data are untrusted; the server must re-derive or validate them.
- Permission decorators match the operation; do not rely on UI hiding alone.
- Webhooks and provider callbacks are authenticated and replay-safe.
- Supplier credentials, tokens, cookies, and connection strings never reach logs, errors, or the browser.
- Uploads are type/size constrained and served safely.
- PII is minimized in logs, analytics, and error payloads.
- SQL/Prisma queries use parameters or Prisma APIs; no string-built SQL with user input.
- Redirects and external URLs are allowlisted or validated.

## Finance-specific

- Never trust `body.price`; re-search or re-check before creating an obligation.
- Preserve the distinction between supplier price, public price, markup, commission, paid, refunded, and debt.
- Historical/as-of calculations must state precision limits instead of presenting approximations as fact.
- State transitions must be server-owned and idempotent where retries are possible.

## Secrets

- Use environment variables; never commit `.env`, tokens, passwords, or private keys.
- Redact secrets in logs and diagnostics.
- Do not paste production credentials into test fixtures or chat.

## Review output

Classify each finding:

```text
critical — exploitable or money/data loss
high     — privilege, PII, or payment integrity
medium   — defense-in-depth gap
low      — hygiene
```

For each: file/line, impact, concrete fix, and whether it is a blocker.
