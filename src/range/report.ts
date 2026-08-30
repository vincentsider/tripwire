// src/range/report.ts
//
// A sealed evidence report for a completed run — the same hash-sealed evidence
// idea DeepBlocker ships for calls, applied to an agent assessment. The report
// is canonicalised (stable key order) and sealed with SHA-256 so it can be
// shown to have not changed since it was produced.

import type { Scorecard } from './scoring.ts';

export interface EvidenceReport {
  tool: 'trustwright';
  corpusVersion: string;
  agentLabel: string;
  generatedAt: string; // ISO 8601
  resistanceScore: number | null;
  decided: number;
  resisted: number;
  partial: number;
  fell: number;
  results: Array<{ levelId: string; category: string; verdict: string }>;
}

export interface SealedReport {
  report: EvidenceReport;
  canonical: string;
  sha256: string;
}

/** Build the report object from a scorecard. */
export function buildReport(
  scorecard: Scorecard,
  agentLabel: string,
  corpusVersion: string,
  generatedAtIso: string,
): EvidenceReport {
  return {
    tool: 'trustwright',
    corpusVersion,
    agentLabel,
    generatedAt: generatedAtIso,
    resistanceScore: scorecard.resistanceScore,
    decided: scorecard.decided,
    resisted: scorecard.resisted,
    partial: scorecard.partial,
    fell: scorecard.fell,
    results: scorecard.results.map((r) => ({
      levelId: r.levelId,
      category: r.category,
      verdict: r.verdict,
    })),
  };
}

/**
 * Canonical JSON: keys in a fixed order so the same report always serialises to
 * the same bytes (and therefore the same hash). Deliberately does not rely on
 * JSON.stringify key ordering of the input object.
 */
export function canonicalJson(report: EvidenceReport): string {
  const ordered = {
    tool: report.tool,
    corpusVersion: report.corpusVersion,
    agentLabel: report.agentLabel,
    generatedAt: report.generatedAt,
    resistanceScore: report.resistanceScore,
    decided: report.decided,
    resisted: report.resisted,
    partial: report.partial,
    fell: report.fell,
    results: report.results.map((r) => ({
      levelId: r.levelId,
      category: r.category,
      verdict: r.verdict,
    })),
  };
  return JSON.stringify(ordered);
}

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

/** Seal a report with SHA-256 over its canonical form. */
export async function sealReport(report: EvidenceReport): Promise<SealedReport> {
  const canonical = canonicalJson(report);
  const subtle = (globalThis.crypto && globalThis.crypto.subtle) || undefined;
  if (!subtle) {
    // No Web Crypto (very old runtime): return an explicit non-hash marker
    // rather than a fake digest, so a viewer is never misled.
    return { report, canonical, sha256: 'unavailable' };
  }
  const data = new TextEncoder().encode(canonical);
  const digest = await subtle.digest('SHA-256', data);
  return { report, canonical, sha256: toHex(digest) };
}
