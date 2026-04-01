import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useStats } from './useStats.js';

describe('useStats', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes isMock from fetch result', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: [1, 2, 3], isMock: true });
    const { result } = renderHook(() => useStats(fetchFn));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([1, 2, 3]);
    expect(result.current.isMock).toBe(true);
  });

  it('exposes isMock: false on real data', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: ['a'], isMock: false });
    const { result } = renderHook(() => useStats(fetchFn));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isMock).toBe(false);
  });

  it('pauses polling when tab becomes hidden', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: [], isMock: false });
    renderHook(() => useStats(fetchFn));
    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));

    // Simulate tab hidden
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    act(() => document.dispatchEvent(new Event('visibilitychange')));

    // Advance 2 minutes — should NOT trigger more fetches
    act(() => vi.advanceTimersByTime(120_000));
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // Restore
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });
});
