import { describe, it, expect } from 'vitest';
import { shouldSaveRun } from './persist.ts';

describe('shouldSaveRun', () => {
  it('saves a finished run once', () => {
    expect(shouldSaveRun('done', 'run-1', null, false)).toBe(true);
  });

  it('does not save the same run twice', () => {
    expect(shouldSaveRun('done', 'run-1', 'run-1', false)).toBe(false);
  });

  it('saves a new run even after a previous one saved', () => {
    expect(shouldSaveRun('done', 'run-2', 'run-1', false)).toBe(true);
  });

  it('does not save while a save is already in flight', () => {
    expect(shouldSaveRun('done', 'run-1', null, true)).toBe(false);
  });

  it('does not save a run that is not done', () => {
    expect(shouldSaveRun('running', 'run-1', null, false)).toBe(false);
    expect(shouldSaveRun('idle', 'run-1', null, false)).toBe(false);
  });
});
