# Tripwire headless scan service

A tiny HTTP service that opens a URL in a **real headless browser**, reads its
WebMCP tool surface (`document.modelContext.getTools()` / `navigator.modelContext`),
and returns the raw tools as JSON. It exists because a Cloudflare Worker cannot
run a browser, so the Tripwire Worker delegates live enumeration to this service
out-of-band.

It powers two Worker endpoints:

- **`POST /api/scan`** — self-serve external scan of any URL (unsigned preview).
- **`POST /api/audit/from-scan`** — operator path that signs a scanned surface for
  an already-verified origin.

## Trust boundary (important)

This service **only observes**. It is untrusted by the Worker:

- It never executes a tool — it copies the declared descriptors
  (name / description / inputSchema / annotations) only.
- The Worker **re-validates and re-derives** the fingerprint and all findings
  from what this service returns. A compromised or lying scan service cannot
  forge a passing audit or a signature — signing still requires proven origin
  control, which this service has no part in.

## What it can and cannot see

It enumerates tools that the page registers in JavaScript — which covers sites
using the WebMCP **polyfill** (the common case today). Sites that expose WebMCP
**only** through a native host (ChatGPT's browser, flagged Chrome) may return
`host: "none"` here; that is an honest limit of external enumeration, not a
failure. `POST /api/scan` reports `host: "none"` in that case.

## Run it

```bash
cd scan
npm install
npm run install:browser   # one-time: downloads Chromium (skip if using Docker)
npm run build
SCAN_SERVICE_TOKEN=choose-a-long-secret npm start
```

Or with Docker (Chromium already bundled in the base image):

```bash
cd scan
docker build -t tripwire-scan .
docker run -p 8080:8080 -e SCAN_SERVICE_TOKEN=choose-a-long-secret tripwire-scan
```

Health check: `GET /health` → `{ "ok": true, "active": 0, "concurrency": 2 }`.

### Environment

| Var | Default | Meaning |
|-----|---------|---------|
| `PORT` | `8080` | Listen port. |
| `SCAN_SERVICE_TOKEN` | _(unset)_ | If set, requests must send `Authorization: Bearer <token>`. **Set this in any deployment.** |
| `SCAN_CONCURRENCY` | `2` | Max simultaneous scans (bounds memory). |
| `SCAN_WAIT_MS` | `8000` | How long to poll the page for a host to appear. |
| `SCAN_NAV_TIMEOUT_MS` | `15000` | Navigation timeout. |

## API

```
POST /scan
Authorization: Bearer <SCAN_SERVICE_TOKEN>
Content-Type: application/json

{ "url": "https://example.com/agent" }
```

Response:

```json
{ "host": "native" | "polyfill" | "none" | "error",
  "tools": [ { "name": "...", "description": "...", "inputSchema": {...}, "annotations": {...} } ],
  "error": "nav_failed" }
```

## Wire it to the Worker

Point the Tripwire Worker at this service (both are Worker secrets):

```bash
wrangler secret put SCAN_SERVICE_URL     # e.g. https://tripwire-scan.fly.dev
wrangler secret put SCAN_SERVICE_TOKEN   # same secret you set on the service
```

Without `SCAN_SERVICE_URL`, `POST /api/scan` fails closed with `503 scan_unavailable`.

## Test

```bash
npm test   # pure enumeration + normalisation unit tests (no browser needed)
```
