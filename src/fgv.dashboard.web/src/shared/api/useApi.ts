import { useCallback, useEffect, useState } from 'react';

interface ApiState<T> {
    data: T | null;
    error: string | null;
    loading: boolean;
    reload: () => void;
}

// `fetcher` must be a stable reference (a module-level function), not an inline arrow.
export function useApi<T>(fetcher: (signal: AbortSignal) => Promise<T>): ApiState<T> {
    const [data, setData] = useState<T | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [version, setVersion] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError(null);

        fetcher(controller.signal)
            .then(setData)
            .catch((e: unknown) => {
                if (!controller.signal.aborted) {
                    setError(e instanceof Error ? e.message : 'Unknown error');
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });

        return () => controller.abort();
    }, [fetcher, version]);

    const reload = useCallback(() => setVersion((v) => v + 1), []);

    return { data, error, loading, reload };
}