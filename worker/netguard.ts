// worker/netguard.ts
//
// SSRF guard for every server-initiated fetch/scan that targets a
// caller-supplied URL: the browser scan (/api/scan, /api/audit/*) and the
// ownership proof probe (/api/verify-origin/confirm + the re-check cron).
//
// Two layers, because input validation alone is bypassable by redirects and
// DNS:
//   1. isBlockedHostname(host) — SYNC. Rejects localhost, single-label names,
//      *.internal / *.local, and any literal private/loopback/link-local IP
//      (v4 + v6, including the cloud-metadata address 169.254.169.254 and
//      IPv4-mapped IPv6). Cheap; used at input time AND on every browser
//      sub-request so a 30x redirect to a literal internal IP is aborted.
//   2. hostIsPublic(host) — ASYNC. For a DNS NAME, resolves A/AAAA over DoH and
//      blocks if it currently maps to a private IP (an internal hostname, or a
//      naive rebinding record). Fail-open only when public DNS cannot resolve
//      the name at all — the managed browser uses public DNS too, so a name
//      Cloudflare cannot resolve is a name the scan cannot reach internally.
//
// Residual: active DNS rebinding (public at check, private at fetch) is not
// fully closable without IP-pinned egress, which Browser Rendering does not
// expose. Both layers together close every direct and literal-redirect vector.

const DOH_TIMEOUT_MS = 3000;

/** True if `s` is a dotted-quad IPv4 literal. */
export function isIpv4(s: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return false;
  return m.slice(1).every((o) => {
    const n = Number(o);
    return n >= 0 && n <= 255 && String(n) === o; // no leading zeros / out of range
  });
}

/** Private / loopback / link-local / reserved IPv4 (as a security blocklist). */
export function isPrivateIpv4(ip: string): boolean {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true; // malformed → block
  const [a, b] = p as [number, number, number, number];
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // 10/8 private
  if (a === 127) return true; // 127/8 loopback
  if (a === 169 && b === 254) return true; // 169.254/16 link-local (incl. metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12 private
  if (a === 192 && b === 168) return true; // 192.168/16 private
  if (a === 192 && b === 0) return true; // 192.0.0/24 IETF protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18/15 benchmarking
  if (a >= 224) return true; // 224/4 multicast + 240/4 reserved + 255.255.255.255
  return false;
}

/** Private / loopback / link-local / ULA / mapped IPv6 (security blocklist). */
export function isPrivateIpv6(input: string): boolean {
  let ip = input.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
  // Zone id (fe80::1%eth0) — strip for classification.
  const pct = ip.indexOf('%');
  if (pct !== -1) ip = ip.slice(0, pct);
  if (ip === '::1' || ip === '::') return true; // loopback / unspecified
  // IPv4-mapped / -translated (::ffff:a.b.c.d, ::ffff:0:a.b.c.d, 64:ff9b::a.b.c.d)
  const mapped = /(?:::ffff:(?:0:)?|64:ff9b::)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(ip);
  if (mapped && mapped[1]) return isPrivateIpv4(mapped[1]);
  const head = ip.split(':')[0] ?? '';
  if (head.startsWith('fc') || head.startsWith('fd')) return true; // fc00::/7 ULA
  if (head.startsWith('fe8') || head.startsWith('fe9') || head.startsWith('fea') || head.startsWith('feb'))
    return true; // fe80::/10 link-local
  if (head.startsWith('ff')) return true; // ff00::/8 multicast
  return false;
}

/** True for any IP literal (v4 or v6). */
export function isIpLiteral(host: string): boolean {
  const h = host.replace(/^\[/, '').replace(/\]$/, '');
  return isIpv4(h) || h.includes(':');
}

/** SYNC reject: literal private IPs, localhost, single-label + *.internal/*.local. */
export function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[/, '').replace(/\]$/, '').replace(/\.$/, '');
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h.endsWith('.internal') || h.endsWith('.local')) return true; // cloud/mDNS internal
  if (isIpv4(h)) return isPrivateIpv4(h);
  if (h.includes(':')) return isPrivateIpv6(h); // v6 literal
  // A bare single-label name ('metadata', 'db', 'router') is never a public host.
  if (!h.includes('.')) return true;
  return false;
}

interface DohAnswer {
  Answer?: Array<{ type?: number; data?: string }>;
}

/** Resolve A (1) + AAAA (28) for a name via Cloudflare DoH. Empty on failure. */
async function dohResolve(host: string): Promise<string[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DOH_TIMEOUT_MS);
  try {
    const q = async (type: 'A' | 'AAAA') => {
      const resp = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`,
        { headers: { accept: 'application/dns-json' }, signal: ctrl.signal },
      );
      if (!resp.ok) return [] as string[];
      const j = (await resp.json()) as DohAnswer;
      // type 1 = A, 28 = AAAA; ignore CNAME/other records.
      return (j.Answer ?? [])
        .filter((a) => a.type === 1 || a.type === 28)
        .map((a) => String(a.data ?? ''))
        .filter(Boolean);
    };
    const [v4, v6] = await Promise.all([q('A'), q('AAAA')]);
    return [...v4, ...v6];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * ASYNC public-host gate. False for a blocked hostname or a DNS name that
 * currently resolves to any private IP. True for a public literal IP, or a name
 * whose every resolved address is public. Fail-OPEN (true) only when the name
 * does not resolve at all — such a name is unreachable to the browser too.
 */
export async function hostIsPublic(host: string): Promise<boolean> {
  if (isBlockedHostname(host)) return false;
  if (isIpLiteral(host)) return true; // a private literal was already blocked above
  const ips = await dohResolve(host);
  if (ips.length === 0) return true; // unresolvable publicly ⇒ unreachable internally
  return ips.every((ip) => !(isIpv4(ip) ? isPrivateIpv4(ip) : isPrivateIpv6(ip)));
}
