import { Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useApi } from '../../shared/api/useApi';
import FilterSelect from '../../shared/ui/FilterSelect';
import Pagination from '../../shared/ui/Pagination';
import { fetchEndpointPage } from './endpointsApi';
import EndpointsTable from './EndpointsTable';
import {
    DEFENDER_OPTIONS,
    KASPERSKY_OPTIONS,
    OVERALL_OPTIONS,
    PATCH_OPTIONS,
    RISK_OPTIONS,
} from './statusDisplay';

const FILTER_KEYS = ['search', 'overall', 'defender', 'patch', 'kaspersky', 'trendMicro'] as const;
const API_KEYS = [...FILTER_KEYS, 'sortBy', 'descending', 'page', 'pageSize'] as const;

// Only known keys are forwarded; the API validates the values.
function buildApiQuery(params: URLSearchParams): string {
    const query = new URLSearchParams();
    for (const key of API_KEYS) {
        const value = params.get(key);
        if (value) query.set(key, value);
    }
    return query.toString();
}

export default function EndpointsPage() {
    const [params, setParams] = useSearchParams();
    const queryString = buildApiQuery(params);

    const fetcher = useCallback(
        (signal: AbortSignal) => fetchEndpointPage(queryString, signal),
        [queryString],
    );
    const { data, error, loading } = useApi(fetcher);

    const updateParams = useCallback(
        (changes: Record<string, string | null>, resetPage = true) => {
            setParams((previous) => {
                const next = new URLSearchParams(previous);
                for (const [key, value] of Object.entries(changes)) {
                    if (value === null || value === '') next.delete(key);
                    else next.set(key, value);
                }
                if (resetPage) next.delete('page');
                return next;
            });
        },
        [setParams],
    );

    const sortBy = params.get('sortBy') ?? 'hostname';
    const descending = params.get('descending') === 'true';
    const pageSize = Number(params.get('pageSize')) || 25;

    // Debounced search box that stays in sync with the URL.
    const urlSearch = params.get('search') ?? '';
    const [searchText, setSearchText] = useState(urlSearch);

    useEffect(() => {
        setSearchText(urlSearch);
    }, [urlSearch]);

    useEffect(() => {
        if (searchText === urlSearch) return;
        const timer = setTimeout(() => updateParams({ search: searchText || null }), 300);
        return () => clearTimeout(timer);
    }, [searchText, urlSearch, updateParams]);

    const hasFilters = FILTER_KEYS.some((key) => params.get(key));
    const clearFilters = () => setParams(new URLSearchParams());

    const handleSort = (field: string) => {
        const sameField = sortBy === field;
        updateParams({ sortBy: field, descending: sameField && !descending ? 'true' : null });
    };

    const filter = (key: (typeof FILTER_KEYS)[number]) => ({
        value: params.get(key) ?? '',
        onChange: (value: string) => updateParams({ [key]: value || null }),
    });

    return (
        <section>
            <header className="page-head">
                <div>
                    <h1>Endpoint security</h1>
                    <p>
                        Combined endpoint status from Microsoft Defender, SCCM, Kaspersky and Trend Micro
                        Vision One.
                    </p>
                </div>
            </header>

            <div className="table-toolbar" role="search">
                <label className="search-box">
                    <Search size={15} aria-hidden="true" />
                    <span className="sr-only">Search endpoints</span>
                    <input
                        type="search"
                        value={searchText}
                        maxLength={100}
                        placeholder="Search endpoint, OS, IP, location…"
                        onChange={(e) => setSearchText(e.target.value)}
                    />
                </label>
                <FilterSelect label="Endpoint status" options={OVERALL_OPTIONS} {...filter('overall')} />
                <FilterSelect label="Defender" options={DEFENDER_OPTIONS} {...filter('defender')} />
                <FilterSelect label="SCCM" options={PATCH_OPTIONS} {...filter('patch')} />
                <FilterSelect label="Kaspersky" options={KASPERSKY_OPTIONS} {...filter('kaspersky')} />
                <FilterSelect label="Trend Micro" options={RISK_OPTIONS} {...filter('trendMicro')} />
                {hasFilters && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
                        Clear filters
                    </button>
                )}
            </div>

            <div className="result-count" aria-live="polite">
                {data ? `${data.totalCount} endpoint${data.totalCount === 1 ? '' : 's'}` : ''}
            </div>

            {error && (
                <p role="alert" className="error-banner">
                    Could not load endpoints: {error}
                </p>
            )}

            <div className={loading && data ? 'table-card is-loading' : 'table-card'}>
                {loading && !data && <div className="empty-state">Loading…</div>}

                {data && data.items.length > 0 && (
                    <>
                        <div className="table-scroll">
                            <EndpointsTable
                                items={data.items}
                                sortBy={sortBy}
                                descending={descending}
                                onSort={handleSort}
                            />
                        </div>
                        <Pagination
                            page={data.page}
                            pageSize={pageSize}
                            totalCount={data.totalCount}
                            totalPages={data.totalPages}
                            onPageChange={(page) => updateParams({ page: page === 1 ? null : String(page) }, false)}
                            onPageSizeChange={(size) => updateParams({ pageSize: size === 25 ? null : String(size) })}
                        />
                    </>
                )}

                {data && data.items.length === 0 && (
                    <div className="empty-state">
                        No endpoints match the current filters.{' '}
                        <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
                            Clear filters
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}