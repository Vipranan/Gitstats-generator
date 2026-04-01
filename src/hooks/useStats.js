import { useState, useEffect, useCallback, useRef } from "react";

export function useStats(fetchFn, ...args) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMock, setIsMock] = useState(false);
  const intervalRef = useRef(null);
  const hasFetched = useRef(false);

  const load = useCallback(async () => {
    try {
      if (!hasFetched.current) setLoading(true);
      setError(null);
      const result = await fetchFn(...args);
      setData(result.data);
      setIsMock(result.isMock);
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

    function handleVisibilityChange() {
      if (document.hidden) {
        clearInterval(intervalRef.current);
      } else {
        load();
        intervalRef.current = setInterval(load, 60_000);
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [load]);

  return { data, loading, error, isMock, refetch: load };
}
