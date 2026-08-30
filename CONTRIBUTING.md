# Contributing

Thanks for your interest in improving this project.

## Before your first pull request: agree to the CLA

All contributions require agreement to the **[Contributor License Agreement](./CLA.md)**.
In short: you keep ownership of your work, and you grant DeepBlocker broad rights
to use and re-license it (this preserves the project's ability to offer
commercial editions later). See [CLA.md](./CLA.md) for the full text and how to
sign — until a CLA bot is enabled, add a `Signed-off-by:` line to your commits
(`git commit -s`) and confirm agreement on your first PR.

## Trademarks

The code is Apache-2.0, but the project name and the "verified" badge are
DeepBlocker trademarks and are **not** covered by the code license. Please read
**[TRADEMARK.md](./TRADEMARK.md)** before using the name or badge anywhere.

## What is in scope

This repository is the **open-source reference implementation and client**. The
hosted issuing authority (the badge-signing key), the detection model, and the
operated verification service are **not** part of this repo (see the README
section "What's open source vs commercial"). Contributions to the open engine,
the attack corpus, the scanner, the badge embed, and the docs are all welcome.

## Development

```bash
npm install
npm test          # unit tests: engine, shim, worker, corpus, fingerprint, ...
npm run dev       # local dev server
npm run typecheck # tsc --noEmit
```

Requirements: **all tests green and `tsc` clean** before a PR is merged.

## Adding an attack level

A level is a `LevelDefinition` in `src/range/levels.ts` (metadata + an `arm()`
that registers its tools with the run's canary + an `evaluate()` that scores from
tool-call observations). Add it to `CORPUS` and add a test that runs a compliant
and a careful agent through it. **Detection must be tool-call observable** — a
level never inspects the agent's words, only what it *called*. See
[SECURITY.md](./SECURITY.md): every payload must be an inert marker, never a real
exploit, credential, or exfiltration.

## Reporting security issues

See [SECURITY.md](./SECURITY.md). Please do not open public issues for
vulnerabilities.
