// src/webmcp/types.ts
//
// Types for the WebMCP surface, grounded on Chrome's shipped imperative API
// (developer.chrome.com/docs/ai/webmcp/imperative-api, verified 2026-08-26):
//
//   document.modelContext.registerTool(tool, options) -> Promise
//   document.modelContext.getTools(options)          -> Promise<RegisteredTool[]>
//   document.modelContext.executeTool(tool, jsonStr) -> Promise<string | null>
//   document.modelContext.addEventListener('toolchange', handler)
//
// Load-bearing facts the design depends on:
//   - execute() resolves to a PLAIN STRING (not content blocks).
//   - Tool output is capped at ~1500 characters. Keep returns terse.
//   - Unregistration is via an AbortController passed in options.signal.
//   - Cross-origin exposure is explicit via options.exposedTo.
//
// The concrete host object (document.modelContext vs navigator.modelContext)
// is resolved at runtime by shim.ts; nothing else in the codebase reaches for
// it directly.

/** JSON Schema fragment for a tool's input. Kept intentionally loose. */
export interface JsonSchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  [k: string]: unknown;
}

/** Advisory hints an agent may use. `readOnlyHint` is advisory ONLY and can be lied about — Tripwire exploits exactly that. */
export interface ToolAnnotations {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
}

/** Second argument the host passes to execute(): cancellation + metadata. */
export interface ExecuteContext {
  signal?: AbortSignal;
}

/** A tool as declared to the model context. Mirrors ModelContextTool. */
export interface ModelContextTool {
  /** 1-128 chars, [A-Za-z0-9_.-]. */
  name: string;
  description: string;
  title?: string;
  inputSchema?: JsonSchema;
  annotations?: ToolAnnotations;
  /** Must resolve to a string <= ~1500 chars. */
  execute: (input: Record<string, unknown>, ctx: ExecuteContext) => Promise<string>;
}

/** Options accepted by registerTool. */
export interface RegisterToolOptions {
  /** Abort to unregister the tool. */
  signal?: AbortSignal;
  /** Origins allowed to see/execute this tool (cross-origin exposure). */
  exposedTo?: string[];
}

/** Shape of a tool as reported back by getTools(). */
export interface RegisteredTool {
  name: string;
  description: string;
  inputSchema?: JsonSchema;
  annotations?: ToolAnnotations;
}

/** The host object we operate against (document.modelContext or a polyfill). */
export interface ModelContextHost {
  registerTool(tool: ModelContextTool, options?: RegisterToolOptions): Promise<unknown>;
  getTools(options?: { fromOrigins?: string[] }): Promise<RegisteredTool[]>;
  executeTool(
    tool: RegisteredTool | string,
    input: string,
    options?: { signal?: AbortSignal },
  ): Promise<string | null>;
  addEventListener?: (type: 'toolchange', handler: () => void) => void;
  removeEventListener?: (type: 'toolchange', handler: () => void) => void;
}

/** Where the live host was found, for diagnostics and the day-0 spike. */
export type HostSource = 'document' | 'navigator' | 'polyfill' | 'none';
