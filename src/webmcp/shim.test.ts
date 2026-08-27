import { describe, it, expect, afterEach } from 'vitest';
import { installPolyfill, uninstallPolyfill } from './polyfill.ts';
import { resolveHost, isWebMcpAvailable, registerTool, registerAll } from './shim.ts';
import type { ModelContextTool } from './types.ts';

const tool = (name: string, result = 'ok'): ModelContextTool => ({
  name,
  description: `tool ${name}`,
  execute: async () => result,
});

afterEach(() => uninstallPolyfill());

describe('shim + polyfill', () => {
  it('reports no host until a polyfill is installed', () => {
    expect(isWebMcpAvailable()).toBe(false);
    installPolyfill();
    expect(isWebMcpAvailable()).toBe(true);
    expect(resolveHost().source).toBe('polyfill');
  });

  it('registers a tool that a scripted agent can enumerate and execute', async () => {
    const host = installPolyfill();
    await registerTool(tool('greet', 'hello'));
    const tools = await host.getTools();
    expect(tools.map((t) => t.name)).toContain('greet');
    const result = await host.executeTool('greet', '{}');
    expect(result).toBe('hello');
  });

  it('disposing a registration unregisters the tool', async () => {
    const host = installPolyfill();
    const dispose = await registerTool(tool('temp'));
    expect((await host.getTools()).length).toBe(1);
    dispose();
    expect((await host.getTools()).length).toBe(0);
    // Idempotent: a second dispose is a no-op.
    expect(() => dispose()).not.toThrow();
  });

  it('registerAll returns one disposer that tears down every tool', async () => {
    const host = installPolyfill();
    const dispose = await registerAll([tool('a'), tool('b'), tool('c')]);
    expect((await host.getTools()).length).toBe(3);
    dispose();
    expect((await host.getTools()).length).toBe(0);
  });

  it('registering with no host is a harmless no-op', async () => {
    // No polyfill installed.
    const dispose = await registerTool(tool('ghost'));
    expect(isWebMcpAvailable()).toBe(false);
    expect(() => dispose()).not.toThrow();
  });

  it('a caller-supplied signal also unregisters (single teardown path)', async () => {
    const host = installPolyfill();
    const controller = new AbortController();
    await registerTool(tool('sig'), { signal: controller.signal });
    expect((await host.getTools()).length).toBe(1);
    controller.abort();
    expect((await host.getTools()).length).toBe(0);
  });

  it('emits toolchange on register and unregister', async () => {
    const host = installPolyfill();
    let changes = 0;
    host.addEventListener('toolchange', () => changes++);
    const dispose = await registerTool(tool('watched'));
    dispose();
    expect(changes).toBeGreaterThanOrEqual(2);
  });
});
