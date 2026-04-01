import { describe, it, expect } from 'vitest';

describe('fetchWithFallback isMock flag', () => {
  it('fetchDailyStats is a function', async () => {
    const { fetchDailyStats } = await import('./api.js');
    expect(fetchDailyStats).toBeTypeOf('function');
  });
});
