import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

interface ListQueryConfig {
    filterKeys: readonly string[];
    defaultSort: { field: string; descending: boolean };
    defaultPageSize?: number;
}

// Keeps a list page's search, filters, sort and paging in the URL and builds the API query string.
export function useListQuery({ filterKeys, defaultSort, defaultPageSize = 25 }: ListQueryConfig) {
    const [params, setParams] = useSearchParams();

    // Only known keys are forwarded; the API validates the values.
    const query = new URLSearchParams();
    for (const key of [...filterKeys, 'sortBy', 'descending', 'page', 'pageSize']) {
        const value = params.get(key);
        if (value) query.set(key, value);
    }
    const queryString = query.toString();

    const update = useCallback(
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

    const replace = useCallback(
        (values: Record<string, string>) => setParams(new URLSearchParams(values)),
        [setParams],
    );

    const sortBy = params.get('sortBy') ?? defaultSort.field;
    const descendingParam = params.get('descending');
    const descending = descendingParam === null ? defaultSort.descending : descendingParam === 'true';
    const pageSize = Number(params.get('pageSize')) || defaultPageSize;

    const setSort = (field: string) => {
        const sameField = sortBy === field;
        const nextDescending = sameField ? !descending : field === defaultSort.field && defaultSort.descending;
        update({ sortBy: field, descending: String(nextDescending) });
    };

    // Debounced search box that stays in sync with the URL.
    const urlSearch = params.get('search') ?? '';
    const [searchText, setSearchText] = useState(urlSearch);

    useEffect(() => {
        setSearchText(urlSearch);
    }, [urlSearch]);

    useEffect(() => {
        if (searchText === urlSearch) return;
        const timer = setTimeout(() => update({ search: searchText || null }), 300);
        return () => clearTimeout(timer);
    }, [searchText, urlSearch, update]);

    const hasFilters = filterKeys.some((key) => params.get(key));
    const clearFilters = useCallback(() => setParams(new URLSearchParams()), [setParams]);

    const filterProps = (key: string) => ({
        value: params.get(key) ?? '',
        onChange: (value: string) => update({ [key]: value || null }),
    });

    return {
        params, queryString, update, replace, sortBy, descending, pageSize,
        searchText, setSearchText, hasFilters, clearFilters, setSort, filterProps,
    };
}