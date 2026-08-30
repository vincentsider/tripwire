// src/webmcp/polyfill.ts
//
// A minimal, spec-shaped WebMCP host for two jobs:
//   1. Local dev / non-native browsers — installed on globalThis.__webmcpPolyfill
//      so shim.ts resolves it when neither document.modelContext nor
//      navigator.modelContext is present.
//   2. Deterministic tests — a scripted "agent" can enumerate and invoke tools
//      exactly as a real agent would, so level logic is testable without a model.
//
// It intentionally reproduces the load-bearing real-host behaviours Trustwright
// depends on: string-only results, the ~1500-char output cap, AbortSignal
// unregistration, name-collision replacement (the mechanism behind the
// registration-race and rug-pull levels), and toolchange events.
//
// Memory-safety: tools live in a Map, listeners in a Set. Aborting a
// registration deletes the tool and detaches its abort handler; dispose()
// releases everything.

import type {
  ModelContextHost,
  ModelContextTool,
  RegisterToolOptions,
  RegisteredTool,
  ToolAnnotations,
  JsonSchema,
} from './types.ts';

/** Real hosts cap tool output; mirror it so tests catch oversized returns. */
export const MAX_TOOL_OUTPUT = 1500;

interface StoredTool {
  tool: ModelContextTool;
  exposedTo?: string[];
  onAbort?: () => void;
  signal?: AbortSignal;
}

function toRegistered(tool: ModelContextTool): RegisteredTool {
  const out: RegisteredTool = { name: tool.name, description: tool.description };
  if (tool.inputSchema) out.inputSchema = tool.inputSchema as JsonSchema;
  if (tool.annotations) out.annotations = tool.annotations as ToolAnnotations;
  return out;
}

export class WebMcpPolyfill implements ModelContextHost {
  private tools = new Map<string, StoredTool>();
  private listeners = new Set<() => void>();

  registerTool(tool: ModelContextTool, options: RegisterToolOptions = {}): Promise<void> {
    // Name-collision replacement is deliberate: it is the exact primitive the
    // rug-pull (T3) and registration-race (T4) levels exercise.
    const prev = this.tools.get(tool.name);
    if (prev?.onAbort && prev.signal) prev.signal.removeEventListener('abort', prev.onAbort);

    const stored: StoredTool = { tool };
    if (options.exposedTo) stored.exposedTo = options.exposedTo;

    if (options.signal) {
      const signal = options.signal;
      if (signal.aborted) {
        // Never register an already-aborted tool.
        this.emitToolChange();
        return Promise.resolve();
      }
      const onAbort = () => {
        // Only remove if this exact registration is still current.
        if (this.tools.get(tool.name) === stored) {
          this.tools.delete(tool.name);
          this.emitToolChange();
        }
        signal.removeEventListener('abort', onAbort);
      };
      stored.onAbort = onAbort;
      stored.signal = signal;
      signal.addEventListener('abort', onAbort, { once: true });
    }

    this.tools.set(tool.name, stored);
    this.emitToolChange();
    return Promise.resolve();
  }

  getTools(options: { fromOrigins?: string[] } = {}): Promise<RegisteredTool[]> {
    // Single-origin polyfill: fromOrigins is accepted for API parity. Tools
    // registered with an exposedTo list are still visible locally (the real
    // cross-origin boundary is enforced by the browser, not reproducible here).
    void options.fromOrigins;
    return Promise.resolve([...this.tools.values()].map((s) => toRegistered(s.tool)));
  }

  async executeTool(
    tool: RegisteredTool | string,
    input: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<string | null> {
    const name = typeof tool === 'string' ? tool : tool.name;
    const stored = this.tools.get(name);
    if (!stored) return null;

    let parsed: Record<string, unknown> = {};
    if (input && input.trim()) {
      try {
        const j = JSON.parse(input);
        if (j && typeof j === 'object' && !Array.isArray(j)) parsed = j as Record<string, unknown>;
      } catch {
        // Malformed input is passed as empty args, matching a lenient host.
      }
    }

    const ctx = options.signal ? { signal: options.signal } : {};
    const result = await stored.tool.execute(parsed, ctx);
    const str = typeof result === 'string' ? result : String(result);
    return str.length > MAX_TOOL_OUTPUT ? str.slice(0, MAX_TOOL_OUTPUT) : str;
  }

  addEventListener(type: 'toolchange', handler: () => void): void {
    if (type === 'toolchange') this.listeners.add(handler);
  }

  removeEventListener(type: 'toolchange', handler: () => void): void {
    if (type === 'toolchange') this.listeners.delete(handler);
  }

  private emitToolChange(): void {
    for (const l of [...this.listeners]) {
      try {
        l();
      } catch {
        /* a broken listener must not break registration */
      }
    }
  }

  /** Release every tool, abort handler and listener. */
  dispose(): void {
    for (const s of this.tools.values()) {
      if (s.onAbort && s.signal) s.signal.removeEventListener('abort', s.onAbort);
    }
    this.tools.clear();
    this.listeners.clear();
  }
}

/**
 * Install a polyfill on globalThis so shim.resolveHost() finds it. Idempotent:
 * returns the existing instance if already installed. Used by main.tsx when no
 * native host is present, and by tests.
 */
export function installPolyfill(): WebMcpPolyfill {
  const g = globalThis as { __webmcpPolyfill?: WebMcpPolyfill };
  if (g.__webmcpPolyfill) return g.__webmcpPolyfill;
  const p = new WebMcpPolyfill();
  g.__webmcpPolyfill = p;
  return p;
}

/** Remove the global polyfill (tests / teardown). */
export function uninstallPolyfill(): void {
  const g = globalThis as { __webmcpPolyfill?: WebMcpPolyfill };
  g.__webmcpPolyfill?.dispose();
  delete g.__webmcpPolyfill;
}
