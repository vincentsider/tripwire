// scan/src/enumerate.ts
//
// Two pure, testable pieces of the headless scan:
//
//   enumerateInPage  — runs INSIDE the target page (serialized by Playwright).
//                      Finds a WebMCP host and reads its raw tool descriptors.
//   normalizeSurface — runs in Node on the raw result: coerces + caps every
//                      field so a hostile page cannot return something huge or
//                      weird. The Tripwire Worker still re-validates strictly.
//
// Neither piece trusts the page: the page's descriptors are DATA. We copy only
// the declared fields (name/description/inputSchema/annotations), never execute
// a tool, and never keep a function reference.

export const MAX_TOOLS = 300;
export const MAX_NAME = 128;
export const MAX_DESC = 8000;
export const MAX_SCHEMA_CHARS = 8000;

export type ScanHost = 'native' | 'polyfill' | 'none';

export interface RawScan {
  host: ScanHost;
  tools: unknown[];
}

export interface NormalTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: Record<string, unknown>;
}

/**
 * Executed in the page context. Polls for a WebMCP host for up to `waitMs`,
 * then returns the raw tool list. Must be self-contained (no closure over
 * module scope) because Playwright serializes it to a string.
 */
export async function enumerateInPage(waitMs: number): Promise<RawScan> {
  const deadline = Date.now() + waitMs;
  type Host = { getTools?: (o?: unknown) => unknown };
  const find = (): { host: Host; kind: 'native' | 'polyfill' } | null => {
    const w = window as unknown as {
      __webmcpPolyfill?: unknown;
      navigator: { modelContext?: Host };
      document: { modelContext?: Host };
    };
    const doc = w.document?.modelContext;
    const nav = w.navigator?.modelContext;
    const host = (doc && typeof doc.getTools === 'function' && doc) || (nav && typeof nav.getTools === 'function' && nav) || null;
    if (!host) return null;
    // Heuristic only; the Worker treats native and polyfill identically.
    const kind = w.__webmcpPolyfill ? 'polyfill' : 'native';
    return { host, kind };
  };

  for (;;) {
    const f = find();
    if (f) {
      let tools: unknown;
      try {
        tools = await Promise.resolve(f.host.getTools!());
      } catch {
        tools = [];
      }
      return { host: f.kind, tools: Array.isArray(tools) ? tools : [] };
    }
    if (Date.now() >= deadline) return { host: 'none', tools: [] };
    await new Promise((r) => setTimeout(r, 150));
  }
}

function plainObject(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}

/** Keep only boolean/string/number annotation values (drops nested junk). */
function safeAnnotations(v: unknown): Record<string, unknown> | undefined {
  const o = plainObject(v);
  if (!o) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(o)) {
    if (k.length > 64) continue;
    if (typeof val === 'boolean' || typeof val === 'number') out[k] = val;
    else if (typeof val === 'string') out[k] = val.slice(0, 256);
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Coerce and cap a raw scan into a clean surface. Faithful (no silent tool
 * dropping) but bounded: an entry that is not an object, or has no usable name,
 * is skipped rather than allowed to corrupt the whole surface.
 */
export function normalizeSurface(raw: RawScan): { host: ScanHost; tools: NormalTool[] } {
  if (raw.host === 'none') return { host: 'none', tools: [] };
  const tools: NormalTool[] = [];
  for (const item of raw.tools.slice(0, MAX_TOOLS)) {
    const o = plainObject(item);
    if (!o) continue;
    const name = typeof o.name === 'string' ? o.name.slice(0, MAX_NAME) : '';
    if (!name) continue;
    const description = typeof o.description === 'string' ? o.description.slice(0, MAX_DESC) : '';
    const tool: NormalTool = { name, description };
    const schema = plainObject(o.inputSchema);
    if (schema) {
      try {
        if (JSON.stringify(schema).length <= MAX_SCHEMA_CHARS) tool.inputSchema = schema;
      } catch {
        /* unserialisable — drop it */
      }
    }
    const ann = safeAnnotations(o.annotations);
    if (ann) tool.annotations = ann;
    tools.push(tool);
  }
  return { host: raw.host, tools };
}
