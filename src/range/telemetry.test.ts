import { describe, it, expect } from 'vitest';
import { TelemetryBus } from './telemetry.ts';

// A deterministic clock so `t` values are stable and assertable.
function fakeClock() {
  let n = 0;
  return () => n++;
}

describe('TelemetryBus', () => {
  it('emits ordered events with monotonic seq', () => {
    const bus = new TelemetryBus({ now: fakeClock() });
    bus.emit({ kind: 'level_started', label: 'T1' });
    bus.emit({ kind: 'tool_called', label: 'search_docs' });
    const snap = bus.snapshot();
    expect(snap.map((e) => e.kind)).toEqual(['level_started', 'tool_called']);
    expect(snap[0]!.seq).toBe(0);
    expect(snap[1]!.seq).toBe(1);
  });

  it('bounds memory with a ring buffer and evicts oldest', () => {
    const bus = new TelemetryBus({ capacity: 3, now: fakeClock() });
    for (let i = 0; i < 10; i++) bus.emit({ kind: 'note', label: `n${i}` });
    expect(bus.size).toBe(3);
    const snap = bus.snapshot();
    // Only the last three survive, in order.
    expect(snap.map((e) => e.label)).toEqual(['n7', 'n8', 'n9']);
    // seq keeps counting past evictions.
    expect(snap.map((e) => e.seq)).toEqual([7, 8, 9]);
  });

  it('truncates oversized detail to bound memory', () => {
    const bus = new TelemetryBus({ maxDetailLen: 16, now: fakeClock() });
    const ev = bus.emit({ kind: 'note', detail: 'x'.repeat(100) });
    expect(ev.detail!.length).toBe(17); // 16 + ellipsis
    expect(ev.detail!.endsWith('…')).toBe(true);
  });

  it('delivers to subscribers and stops after unsubscribe', () => {
    const bus = new TelemetryBus({ now: fakeClock() });
    const seen: string[] = [];
    const off = bus.subscribe((e) => seen.push(e.kind));
    bus.emit({ kind: 'note' });
    off();
    bus.emit({ kind: 'note' });
    expect(seen).toEqual(['note']);
  });

  it('survives a subscriber that unsubscribes during dispatch', () => {
    const bus = new TelemetryBus({ now: fakeClock() });
    const order: string[] = [];
    const offA = bus.subscribe(() => {
      order.push('A');
      offA(); // remove self mid-dispatch
    });
    bus.subscribe(() => order.push('B'));
    bus.emit({ kind: 'note' });
    expect(order).toEqual(['A', 'B']); // B still received despite A removing itself
  });

  it('isolates a throwing subscriber', () => {
    const bus = new TelemetryBus({ now: fakeClock() });
    bus.subscribe(() => {
      throw new Error('boom');
    });
    const seen: string[] = [];
    bus.subscribe((e) => seen.push(e.kind));
    expect(() => bus.emit({ kind: 'note' })).not.toThrow();
    expect(seen).toEqual(['note']);
  });

  it('clear() releases events and listeners', () => {
    const bus = new TelemetryBus({ now: fakeClock() });
    let count = 0;
    bus.subscribe(() => count++);
    bus.emit({ kind: 'note' });
    bus.clear();
    bus.emit({ kind: 'note' });
    expect(bus.size).toBe(1); // only the post-clear event
    expect(count).toBe(1); // listener was released, saw only the first
  });
});
