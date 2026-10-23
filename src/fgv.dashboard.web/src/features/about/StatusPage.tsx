import { useEffect, useState } from 'react';
import { fetchAppInfo } from './appInfo';
import type { AppInfo } from './appInfo';

export default function StatusPage() {
    const [info, setInfo] = useState<AppInfo | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();

        fetchAppInfo(controller.signal)
            .then(setInfo)
            .catch((e: unknown) => {
                if (controller.signal.aborted) return;
                setError(e instanceof Error ? e.message : 'Unknown error');
            });

        return () => controller.abort();
    }, []);

    return (
        <section>
            <header className="page-head">
                <h1>System status</h1>
                <p>Response from the API.</p>
            </header>
            {error && <p role="alert">Could not reach the API: {error}</p>}
            {!info && !error && <p>Loading…</p>}
            {info && (
                <dl>
                    <dt>API</dt><dd>{info.name}</dd>
                    <dt>Version</dt><dd>{info.version}</dd>
                    <dt>Environment</dt><dd>{info.environment}</dd>
                    <dt>Server time (UTC)</dt><dd>{info.serverTimeUtc}</dd>
                </dl>
            )}
        </section>
    );
}