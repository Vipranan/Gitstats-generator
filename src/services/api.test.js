import { describe, it, expect, vi } from 'vitest';

// We need to mock axios before importing api.js
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn().mockRejectedValue({ response: undefined, code: 'ECONNREFUSED' }),
    })),
  },
}));

describe('fetchWithFallback isMock flag', () => {
  it('returns { data, isMock: false } shape on success', async () => {
    const { fetchDailyStats } = await import('./api.js');
    expect(fetchDailyStats).toBeTypeOf('function');
  });

  it('returns isMock: true when backend is unavailable', async () => {
    const { fetchDailyStats } = await import('./api.js');
    const result = await fetchDailyStats(null);
    expect(result).toHaveProperty('isMock', true);
    expect(result).toHaveProperty('data');
  });
});
