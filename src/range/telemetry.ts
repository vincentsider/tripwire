// src/range/telemetry.ts
//
// The append-only event stream behind the live Trace view — the "what the site
// declared vs what the agent actually did" panel that is the centerpiece of the
// demo. Every tool registration, tool call, toolchange and canary fire lands
// here.
//
// Memory-safety is a first-class concern: a long session (or a hostile page
// spamming toolchange) must never grow this without bound. Events are held in a
// fixed-capacity ring buffer; the oldest are dropped once full. Subscribers get
// a disposer and are stored in a Set so they can be fully released. Nothing here
// retains DOM nodes or closures beyond an explicit unsubscribe/clear.

export type TelemetryKind =
  | 'tool_registered'
  | 'tool_unregistered'
  | 'tool_called'
  | 'tool_result'
  | 'toolchange'
  | 'canary_fired'
  | 'level_started'
  | 'level_scored'
  | 'note';

export interface TelemetryEvent {
  /** Monotonic per-bus sequence number; stable ordering even at equal times. */
  seq: number;
  /** Milliseconds since bus creation (not wall-clock — deterministic in tests). */
  t: number;
  kind: TelemetryKind;
  /** Attack origin / tool origin when relevant (top document vs quarantine iframe). */
  origin?: string;
  /** Tool name, level id, or other short label. */
  label?: string;
  /** Small, already-truncated detail string. Never store raw unbounded blobs. */
  detail?: string;
  /** True when this event represents an attack succeeding (renders red). */
  hostile?: boolean;
}

type Listener = (event: TelemetryEvent) => void;

export interface TelemetryBusOptions {
  /** Max events retained. Older events drop off the front. */
  capacity?: number;
  /** Injectable clock for deterministic tests. Defaults to a monotonic timer. */
  now?: () => number;
  /** Max length of a `detail` string before truncation, to bound memory. */
  maxDetailLen?: number;
}

const DEFAULT_CAPACITY = 500;
const DEFAULT_MAX_DETAIL = 500;

export class TelemetryBus {
  private readonly capacity: number;
  private readonly maxDetailLen: number;
  private readonly now: () => number;
  private readonly origin: number;
  private buffer: TelemetryEvent[] = [];
  private head = 0; // index of oldest element within buffer once full
  private seqCounter = 0;
  private listeners = new Set<Listener>();

  constructor(options: TelemetryBusOptions = {}) {
    this.capacity = Math.max(1, options.capacity ?? DEFAULT_CAPACITY);
    this.maxDetailLen = Math.max(16, options.maxDetailLen ?? DEFAULT_MAX_DETAIL);
    // Monotonic base so `t` is relative and never leaks wall-clock into tests.
    const perf = (globalThis as { performance?: { now(): number } }).performance;
    this.now = options.now ?? (perf ? () => perf.now() : () => 0);
    this.origin = this.now();
  }

  /** Append an event. Truncates detail and evicts the oldest when at capacity. */
  emit(event: Omit<TelemetryEvent, 'seq' | 't'>): TelemetryEvent {
    const full: TelemetryEvent = {
      ...event,
      seq: this.seqCounter++,
      t: Math.max(0, Math.round(this.now() - this.origin)),
    };
    if (full.detail && full.detail.length > this.maxDetailLen) {
      full.detail = full.detail.slice(0, this.maxDetailLen) + '…';
    }

    if (this.buffer.length < this.capacity) {
      this.buffer.push(full);
    } else {
      // Overwrite oldest in place — O(1), no array churn.
      this.buffer[this.head] = full;
      this.head = (this.head + 1) % this.capacity;
    }

    // Copy listeners first so a handler that unsubscribes mid-dispatch is safe.
    for (const listener of [...this.listeners]) {
      try {
        listener(full);
      } catch {
        // A broken subscriber must never take down the bus.
      }
    }
    return full;
  }

  /** Subscribe. Returns a disposer that fully removes the listener. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Ordered snapshot (oldest → newest). Allocates a new array; callers own it. */
  snapshot(): TelemetryEvent[] {
    if (this.buffer.length < this.capacity) return this.buffer.slice();
    return [...this.buffer.slice(this.head), ...this.buffer.slice(0, this.head)];
  }

  /** Current retained count. */
  get size(): number {
    return this.buffer.length;
  }

  /** Release all events and listeners. Call on teardown to prevent retention. */
  clear(): void {
    this.buffer = [];
    this.head = 0;
    this.listeners.clear();
  }
}
