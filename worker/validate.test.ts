import { describe, it, expect } from 'vitest';
import { validateScorecard, validateLead } from './validate.ts';

const goodScorecard = {
  agent_label: 'GPT-5.6',
  corpus_version: 'v1',
  decided: 3,
  resisted: 2,
  partial: 0,
  fell: 1,
  resistance_score: 0.6667,
  results: [
    { levelId: 'T1', category: 'tool-framing', verdict: 'PASS' },
    { levelId: 'T2', category: 'contaminated-output', verdict: 'FAIL' },
  ],
};

describe('validateScorecard', () => {
  it('accepts a well-formed body', () => {
    const r = validateScorecard(goodScorecard);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.agent_label).toBe('GPT-5.6');
  });

  it('rejects a non-object', () => {
    expect(validateScorecard('nope').ok).toBe(false);
    expect(validateScorecard(null).ok).toBe(false);
  });

  it('rejects an over-long agent_label', () => {
    const r = validateScorecard({ ...goodScorecard, agent_label: 'x'.repeat(81) });
    expect(r.ok).toBe(false);
  });

  it('rejects when parts do not sum to decided', () => {
    const r = validateScorecard({ ...goodScorecard, resisted: 3 });
    expect(r).toEqual({ ok: false, error: 'resisted + partial + fell must equal decided' });
  });

  it('rejects an out-of-range resistance_score', () => {
    expect(validateScorecard({ ...goodScorecard, resistance_score: 1.5 }).ok).toBe(false);
  });

  it('accepts a null resistance_score', () => {
    const r = validateScorecard({ ...goodScorecard, resistance_score: null });
    expect(r.ok).toBe(true);
  });

  it('rejects a bad verdict in results', () => {
    const r = validateScorecard({
      ...goodScorecard,
      results: [{ levelId: 'T1', category: 'x', verdict: 'MAYBE' }],
      decided: 1,
      resisted: 1,
      partial: 0,
      fell: 0,
    });
    expect(r.ok).toBe(false);
  });

  it('rejects an oversized results array', () => {
    const results = Array.from({ length: 65 }, () => ({
      levelId: 'T1',
      category: 'x',
      verdict: 'PASS',
    }));
    expect(validateScorecard({ ...goodScorecard, results }).ok).toBe(false);
  });

  it('strips unknown fields (no injection into the row)', () => {
    const r = validateScorecard({ ...goodScorecard, id: 'attacker-chosen', evil: true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect('id' in r.value).toBe(false);
      expect('evil' in r.value).toBe(false);
    }
  });
});

describe('validateLead', () => {
  it('accepts a valid consented email', () => {
    const r = validateLead({ email: 'a@b.co', consent: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.source).toBe('tripwire');
  });

  it('rejects without explicit consent', () => {
    expect(validateLead({ email: 'a@b.co', consent: false }).ok).toBe(false);
    expect(validateLead({ email: 'a@b.co' }).ok).toBe(false);
  });

  it('rejects a malformed email', () => {
    expect(validateLead({ email: 'not-an-email', consent: true }).ok).toBe(false);
  });

  it('keeps optional agent_label but drops junk', () => {
    const r = validateLead({ email: 'a@b.co', consent: true, agent_label: 'Claude', junk: 1 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.agent_label).toBe('Claude');
      expect('junk' in r.value).toBe(false);
    }
  });

  it('accepts a valid UUID scorecard_id', () => {
    const r = validateLead({
      email: 'a@b.co',
      consent: true,
      scorecard_id: '55bd6bf0-da5f-4411-887e-d1e3a5533ef7',
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.scorecard_id).toBe('55bd6bf0-da5f-4411-887e-d1e3a5533ef7');
  });

  it('drops a non-UUID scorecard_id (would 502 at the DB otherwise)', () => {
    const r = validateLead({
      email: 'a@b.co',
      consent: true,
      scorecard_id: 'x'.repeat(36), // 36 chars but not a UUID
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect('scorecard_id' in r.value).toBe(false);
  });
});
