import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { usePagination } from './usePagination.js';

const data = Array.from({ length: 25 }, (_, i) => ({ id: i }));

describe('usePagination', () => {
  it('returns first 10 items on page 1', () => {
    const { result } = renderHook(() => usePagination(data, 10));
    expect(result.current.paginatedData).toHaveLength(10);
    expect(result.current.paginatedData[0].id).toBe(0);
    expect(result.current.totalPages).toBe(3);
  });

  it('returns correct items on page 2', () => {
    const { result } = renderHook(() => usePagination(data, 10));
    act(() => result.current.setPage(2));
    expect(result.current.paginatedData[0].id).toBe(10);
    expect(result.current.paginatedData).toHaveLength(10);
  });

  it('returns remaining items on last page', () => {
    const { result } = renderHook(() => usePagination(data, 10));
    act(() => result.current.setPage(3));
    expect(result.current.paginatedData).toHaveLength(5);
    expect(result.current.paginatedData[0].id).toBe(20);
  });

  it('returns empty array for null data', () => {
    const { result } = renderHook(() => usePagination(null, 10));
    expect(result.current.paginatedData).toEqual([]);
    expect(result.current.totalPages).toBe(1);
  });
});
