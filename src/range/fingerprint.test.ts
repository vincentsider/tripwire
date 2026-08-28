import { describe, it, expect } from 'vitest';
import { fingerprintSurface, canonicalSurface, stableStringify } from './fingerprint.ts';
import type { RegisteredTool } from '../webmcp/types.ts';

const surface: RegisteredTool[] = [
  {
    name: 'search_docs',
    description: 'Search the docs.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'add_payee',
    description: 'Add a payee.',
    annotations: { readOnlyHint: false },
  },
];

describe('surface fingerprint', () => {
  it('is stable across repeated calls', async () => {
    const a = await fingerprintSurface(surface);
    const b = await fingerprintSurface(surface);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('does not depend on tool order', async () => {
    const reversed = [...surface].reverse();
    expect(await fingerprintSurface(reversed)).toBe(await fingerprintSurface(surface));
  });

  it('does not depend on object key order within a schema', async () => {
    const reordered: RegisteredTool[] = [
      { ...surface[1]! },
      {
        name: 'search_docs',
        // same schema, keys inserted in a different order
        inputSchema: { required: ['query'], properties: { query: { type: 'string' } }, type: 'object' },
        description: 'Search the docs.',
        annotations: { readOnlyHint: true },
      },
    ];
    expect(await fingerprintSurface(reordered)).toBe(await fingerprintSurface(surface));
  });

  it('ignores cosmetic whitespace in descriptions', async () => {
    const spaced: RegisteredTool[] = [
      surface[0]!,
      { ...surface[1]!, description: '  Add   a   payee.  ' },
    ];
    expect(await fingerprintSurface(spaced)).toBe(await fingerprintSurface(surface));
  });

  it('changes when a description changes', async () => {
    const changed: RegisteredTool[] = [surface[0]!, { ...surface[1]!, description: 'Add a payee silently.' }];
    expect(await fingerprintSurface(changed)).not.toBe(await fingerprintSurface(surface));
  });

  it('changes when an annotation changes (readOnly flipped)', async () => {
    const changed: RegisteredTool[] = [surface[0]!, { ...surface[1]!, annotations: { readOnlyHint: true } }];
    expect(await fingerprintSurface(changed)).not.toBe(await fingerprintSurface(surface));
  });

  it('changes when a tool is added or removed', async () => {
    const base = await fingerprintSurface(surface);
    const added = await fingerprintSurface([...surface, { name: 'z_new', description: 'new' }]);
    expect(added).not.toBe(base);
    expect(await fingerprintSurface([surface[0]!])).not.toBe(base);
  });

  it('distinguishes cross-origin exposure (origin field)', async () => {
    const withOrigin: RegisteredTool[] = [surface[0]!, { ...surface[1]!, origin: 'https://partner.example' }];
    expect(await fingerprintSurface(withOrigin)).not.toBe(await fingerprintSurface(surface));
  });

  it('an empty surface has a stable fingerprint', async () => {
    expect(await fingerprintSurface([])).toBe(await fingerprintSurface([]));
  });

  it('canonicalSurface is deterministic and sorts by name', () => {
    const c = canonicalSurface(surface);
    expect(c.indexOf('add_payee')).toBeLessThan(c.indexOf('search_docs'));
    expect(canonicalSurface([...surface].reverse())).toBe(c);
  });

  it('stableStringify sorts object keys', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(stableStringify([3, { y: 1, x: 2 }])).toBe('[3,{"x":2,"y":1}]');
  });
});
