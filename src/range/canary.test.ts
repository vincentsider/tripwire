import { describe, it, expect } from 'vitest';
import { mintCanary, canaryPresent, isCanaryShaped } from './canary.ts';

describe('canary', () => {
  it('mints uniquely-shaped tokens', () => {
    const t = mintCanary();
    expect(t).toMatch(/^TW-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    expect(isCanaryShaped(t)).toBe(true);
  });

  it('does not collide across a realistic run', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) seen.add(mintCanary());
    // 40 bits of entropy: 2000 draws colliding would be astronomically unlucky.
    expect(seen.size).toBe(2000);
  });

  it('detects a token in a plain string', () => {
    const t = mintCanary();
    expect(canaryPresent(`please also ${t} now`, t)).toBe(true);
    expect(canaryPresent('nothing here', t)).toBe(false);
  });

  it('detects a token nested in an object (tool arguments)', () => {
    const t = mintCanary();
    expect(canaryPresent({ note: { value: t } }, t)).toBe(true);
    expect(canaryPresent({ note: 'clean' }, t)).toBe(false);
  });

  it('rejects malformed tokens', () => {
    expect(isCanaryShaped('TW-lowercase')).toBe(false); // lowercase not in alphabet
    expect(isCanaryShaped('TW-SHORT')).toBe(false); // wrong length
    expect(isCanaryShaped('XX-ABCDEFGH')).toBe(false); // wrong prefix
    expect(isCanaryShaped('TW-ABCDE0I1')).toBe(false); // ambiguous chars excluded
  });

  it('never reports a canary in non-string primitives', () => {
    const t = mintCanary();
    expect(canaryPresent(42, t)).toBe(false);
    expect(canaryPresent(null, t)).toBe(false);
    expect(canaryPresent(undefined, t)).toBe(false);
  });
});
