import { describe, it, expect } from 'vitest';
import { normalizeOrigin } from './originVerify.ts';

describe('normalizeOrigin', () => {
  it('normalizes a valid public origin (drops path/query/hash)', () => {
    expect(normalizeOrigin('https://example.com/foo?x=1#y')).toBe('https://example.com');
    expect(normalizeOrigin('https://sub.example.com:8443/')).toBe('https://sub.example.com:8443');
  });

  it('rejects non-http(s) schemes and junk', () => {
    expect(normalizeOrigin('file:///etc/passwd')).toBeNull();
    expect(normalizeOrigin('ftp://example.com')).toBeNull();
    expect(normalizeOrigin('not a url')).toBeNull();
    expect(normalizeOrigin(123)).toBeNull();
    expect(normalizeOrigin('x'.repeat(3000))).toBeNull();
  });

  it('refuses internal/loopback/link-local origins (SSRF guard)', () => {
    for (const o of [
      'http://localhost',
      'http://127.0.0.1',
      'http://169.254.169.254',
      'http://10.0.0.1',
      'http://192.168.1.1:8080',
      'http://[::1]',
      'http://metadata.google.internal',
      'http://router', // single label
    ]) {
      expect(normalizeOrigin(o)).toBeNull();
    }
  });
});
