// src/sdk/probe.ts
//
// Observable leak probe (rung 2). With the owner's authorisation — it EXECUTES
// the site's tools, which may have side effects — call each tool with a unique
// inert canary and watch for that canary ESCAPING to a third-party origin. A
// leak observed this way is a confirmed FAIL (not a heuristic), because it was
// seen, not guessed. It cannot catch purely silent internal misuse; the report
// says so.

import { mintCanary } from '../range/canary.ts';
import type { RegisteredTool } from '../webmcp/types.ts';
import { resolveNativeHost } from './index.ts';

export interface OutboundRequest {
  url: string;
  method: string;
  body?: string;
}

export interface LeakFinding {
  toolName: string;
  targetOrigin: string;
  canaryInUrl: boolean;
  canaryInBody: boolean;
}

/**
 * Pure: which outbound requests carried the canary to a DIFFERENT origin. Same-
 * origin requests are not leaks. Deterministic; unit-tested.
 */
export function classifyLeaks(
  requests: ReadonlyArray<OutboundRequest & { toolName: string }>,
  canary: string,
  ownOrigin: string,
): LeakFinding[] {
  const out: LeakFinding[] = [];
  for (const r of requests) {
    let targetOrigin: string;
    try {
      targetOrigin = new URL(r.url, ownOrigin).origin;
    } catch {
      continue;
    }
    if (targetOrigin === ownOrigin) continue; // same-origin is not a cross-boundary leak
    const canaryInUrl = r.url.includes(canary);
    const canaryInBody = typeof r.body === 'string' && r.body.includes(canary);
    if (canaryInUrl || canaryInBody) {
      out.push({ toolName: r.toolName, targetOrigin, canaryInUrl, canaryInBody });
    }
  }
  return out;
}

/** Build a canary-filled input for a tool from its inputSchema (string props -> canary). */
function canaryInput(tool: RegisteredTool, canary: string): Record<string, unknown> {
  const props = (tool.inputSchema?.properties ?? {}) as Record<string, { type?: unknown }>;
  const input: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    input[k] = v && v.type === 'string' ? canary : v && v.type === 'number' ? 0 : canary;
  }
  return input;
}

interface ProbeOptions {
  /** Limit which tools are probed (by name). Omit to probe all. */
  only?: string[];
  ownOrigin?: string;
}

/**
 * Run the leak probe. Instruments window.fetch during each tool call, restores it
 * after, and classifies cross-origin canary escapes. Returns findings + count.
 * MUST be owner-authorised — it executes the site's tools.
 */
export async function probeSurface(
  opts: ProbeOptions = {},
): Promise<{ findings: LeakFinding[]; toolsProbed: number }> {
  const host = resolveNativeHost();
  if (!host) throw new Error('no WebMCP host on this page');
  const ownOrigin = opts.ownOrigin ?? (typeof location !== 'undefined' ? location.origin : '');
  const tools = (await host.getTools()).filter((t) => !opts.only || opts.only.includes(t.name));

  const captured: Array<OutboundRequest & { toolName: string }> = [];
  const realFetch = globalThis.fetch;
  let currentTool = '';

  // Instrument fetch to record outbound requests during tool execution.
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
      const body = typeof init?.body === 'string' ? init.body : undefined;
      captured.push({ toolName: currentTool, url, method, ...(body ? { body } : {}) });
    } catch {
      /* recording must never break the real request */
    }
    return realFetch(input as RequestInfo, init);
  }) as typeof fetch;

  const canary = mintCanary();
  try {
    for (const tool of tools) {
      currentTool = tool.name;
      try {
        await (host as unknown as { executeTool(name: string, input: string): Promise<unknown> }).executeTool(
          tool.name,
          JSON.stringify(canaryInput(tool, canary)),
        );
      } catch {
        /* a tool that throws is not a leak; keep probing */
      }
    }
  } finally {
    globalThis.fetch = realFetch; // always restore
  }

  return { findings: classifyLeaks(captured, canary, ownOrigin), toolsProbed: tools.length };
}
