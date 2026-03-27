import { useState, useEffect, useCallback, useRef } from "react";

export function useStats(fetchFn, ...args) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchFn(...args);
      setData(result);
    } catch (err) {
      setError(err.message ?? "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [fetchFn, ...args]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 60_000);
    return () => clearInterval(intervalRef.current);
  }, [load]);

  return { data, loading, error, refetch: load };
}
