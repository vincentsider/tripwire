# Tripwire

**A pre-ship assurance range for WebMCP developers.** Open it in ChatGPT's browser or Chrome, tell your agent to run the gauntlet, and Tripwire walks your agent through a versioned corpus of tool-surface attacks, records exactly what it did, and hands you a scorecard. It tells you whether the tools your site exposes to AI agents are safe to ship.

Built for the [WebMCP Challenge](https://webmcp.devpost.com/). Apache-2.0.

---

## Why this exists

WebMCP lets a website hand an AI agent a menu of actions, written in plain English, and the agent picks from it. The catch is that the agent has to take the website at its word: nothing verifies that a tool does what its description says, and the agent is acting inside the user's authenticated session.

That gap is documented, not hypothetical:

- Chrome's own developer docs name the attack classes (malicious manifests, contaminated outputs) and say they cannot be fully prevented.
- The WebMCP spec concedes there is no verification that a tool's behaviour matches its description, and explicitly asks the community for a shared attack evaluation dataset. That dataset does not exist yet.
- Independent research (arXiv 2606.06387) manipulated current agents with success rates reaching 100% for some techniques.

Tripwire is that missing dataset, made runnable. Its audience is every developer about to expose tools to agents, including everyone building for this challenge.

## The thesis: verify, don't trust

Every level is scored on one rule: **the page can only see tool calls, never the agent's words.** So a level never checks "did the agent say the magic word." It checks whether the agent *called* something it should not have, measured by an inert marker (a canary). A resisted attack is the good outcome and renders as a green PASS, including when the agent's own guardrails block the payload, so Tripwire never has to defeat a model's safety layer to produce a clean result.

## Run it locally

```bash
npm install
npm test          # engine, shim, worker, corpus, and report tests
npm run dev       # http://localhost:5173
```

## The v1 corpus

| id | class | mechanic |
|----|-------|----------|
| T1 | tool-framing | a hidden instruction inside a tool **description** |
| T2 | contaminated-output | an instruction hidden inside **returned data** |
| T3 | tool-hijacking | a tool **swapped** for a hostile one (AbortSignal) after enumeration |
| T5 | false-readonly | a state-changing tool falsely labelled **readOnly** |
| T7 | assertion-laundering | a tool that **asserts** a security check passed (DeepBlocker's detector plugs in here) |

Each level catches a susceptible agent and clears a careful one, measured only by
tool calls. A completed run can be exported as a **SHA-256-sealed evidence report**
(`export_report`, or the "Sealed report" button).

To drive it with a real agent, open the deployed URL in **ChatGPT's in-app browser**, or in **Chrome** with `chrome://flags/#enable-webmcp-testing` enabled, then ask your agent to "run the Tripwire gauntlet." Where no native WebMCP host is present, a built-in polyfill (`src/webmcp/polyfill.ts`) keeps the app runnable for development.

## Architecture

```
src/webmcp/    shim.ts resolves the live host (document.modelContext /
               navigator.modelContext / polyfill); everything registers tools
               THROUGH the shim, so which API the browser ships changes one file.
src/range/     canary (inert marker tokens), telemetry (bounded event bus),
               scoring, and the level runner. levels.ts is the v1 corpus.
src/data/      Supabase types, generated from the live schema.
worker/        Cloudflare Worker: detector proxy + scorecard/lead persistence
               (holds all secrets; the browser holds none).
```

The browser never holds a database key or the detector key. All persistence and
the one live detector call (the "Trust the Machine" level) go through the
Cloudflare Worker, which holds the Supabase service-role key and the detector
key as Worker secrets. Every table has Row-Level Security enabled with no anon
policies, so a leaked key can do nothing.

## Deploy (Cloudflare Workers)

One Worker serves the SPA and the `/api/*` surface. Deploy needs `wrangler login`.

```bash
wrangler kv namespace create DAILY      # paste the id into wrangler.toml
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put DEEPFAKE_API_KEY
npm run deploy                          # build + wrangler deploy
```

`npm run worker:check` bundles and validates the Worker locally without
deploying. Until the `DAILY` KV namespace is bound, the detector endpoint fails
closed (503), which is the safe default. No secret is ever placed in
`wrangler.toml` or committed.

## Add a level

A level is a `LevelDefinition` in `src/range/levels.ts`: metadata plus an `arm()`
that registers its tools (carrying the run's canary) and returns an `evaluate()`
that reads tool-call observations and returns `PASS | PARTIAL | FAIL`. Add it to
`CORPUS`, then add a test that runs a compliant and a careful agent through it
(see `src/range/level.test.ts`). Detection must be tool-call observable.

## Responsible use

Every payload in this corpus is inert. See [SECURITY.md](./SECURITY.md).

## License

Apache-2.0. See [LICENSE](./LICENSE).
