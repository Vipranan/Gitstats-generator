import { useState, useEffect, useCallback, useRef } from "react";

export function useStats(fetchFn, ...args) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  const hasFetched = useRef(false);

  const load = useCallback(async () => {
    try {
      // Only show loading spinner on initial fetch, not on background re-polls
      if (!hasFetched.current) setLoading(true);
      setError(null);
      const result = await fetchFn(...args);
      setData(result);
      hasFetched.current = true;
    } catch (err) {
      setError(err.message ?? "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [fetchFn, ...args]);

  useEffect(() => {
    hasFetched.current = false;
    load();
    intervalRef.current = setInterval(load, 60_000);
    return () => clearInterval(intervalRef.current);
  }, [load]);

  return { data, loading, error, refetch: load };
}
