import { Bug, Check, Gauge, Search, SlidersHorizontal, TriangleAlert } from 'lucide-react';
import { useCallback } from 'react';
import { useApi } from '../../shared/api/useApi';
import { formatDate, percentOf } from '../../shared/format';
import { useListQuery } from '../../shared/hooks/useListQuery';
import FilterSelect from '../../shared/ui/FilterSelect';
import Pagination from '../../shared/ui/Pagination';
import KpiCard from '../dashboard/KpiCard';
import type { KpiCardProps } from '../dashboard/KpiCard';
import { fetchVulnerabilityPage, fetchVulnerabilitySummary } from './vulnerabilitiesApi';
import VulnerabilitiesTable from './VulnerabilitiesTable';
import { SEVERITY_OPTIONS, SOURCE_OPTIONS, STATUS_OPTIONS } from './vulnerabilityDisplay';

const FILTER_KEYS = ['search', 'severity', 'status', 'source', 'week', 'unresolvedOnly'] as const;

interface KpiDefinition extends Omit<KpiCardProps, 'onClick' | 'active'> {
    key: string;
    filters: Record<string, string>;
}

// Which KPI card matches the current filters: a card is "active" only when it is the sole filter.
function activeKpi(params: URLSearchParams): string | null {
    if (params.get('search') || params.get('source') || params.get('week') || params.get('unresolvedOnly')) {
        return null;
    }
    const severity = params.get('severity');
    const status = params.get('status');
    if (!severity && !status) return 'total';
    if (severity && !status) return severity;
    if (!severity && status === 'resolved') return 'resolved';
    return null;
}

export default function VulnerabilitiesPage() {
    const list = useListQuery({
        filterKeys: FILTER_KEYS,
        defaultSort: { field: 'detected', descending: true },
    });
    const { params, queryString, update, replace, sortBy, descending, pageSize } = list;

    const pageFetcher = useCallback(
        (signal: AbortSignal) => fetchVulnerabilityPage(queryString, signal),
        [queryString],
    );
    const { data, error, loading } = useApi(pageFetcher);
    const { data: summary } = useApi(fetchVulnerabilitySummary);

    const active = activeKpi(params);
    const week = params.get('week');
    const unresolvedOnly = params.get('unresolvedOnly');

    const kpis: KpiDefinition[] = summary
        ? [
            { key: 'total', label: 'Total Vulnerabilities', value: summary.total, sub: `${summary.unresolved} unresolved`, tone: 'blue', icon: Bug, filters: {} },
            { key: 'critical', label: 'Critical', value: summary.bySeverity.critical, sub: `${summary.openBySeverity.critical} unresolved`, tone: 'red', icon: TriangleAlert, filters: { severity: 'critical' } },
            { key: 'high', label: 'High', value: summary.bySeverity.high, sub: `${summary.openBySeverity.high} unresolved`, tone: 'amber', icon: TriangleAlert, filters: { severity: 'high' } },
            { key: 'medium', label: 'Medium', value: summary.bySeverity.medium, sub: `${summary.openBySeverity.medium} unresolved`, tone: 'blue', icon: Gauge, filters: { severity: 'medium' } },
            { key: 'low', label: 'Low', value: summary.bySeverity.low, sub: `${summary.openBySeverity.low} unresolved`, tone: 'slate', icon: SlidersHorizontal, filters: { severity: 'low' } },
            { key: 'resolved', label: 'Resolved', value: summary.resolved, sub: `${percentOf(summary.resolved, summary.total)}% of total`, tone: 'green', icon: Check, filters: { status: 'resolved' } },
        ]
        : [];

    return (
        <section>
            <header className="page-head">
                <div>
                    <h1>Vulnerability management</h1>
                    <p>Track and remediate vulnerabilities detected across all four security tools.</p>
                </div>
            </header>

            <div className="kpi-grid">
                {kpis.map(({ key, filters, ...card }) => (
                    <KpiCard key={key} {...card} active={key === active} onClick={() => replace(filters)} />
                ))}
            </div>

            <div className="table-toolbar" role="search">
                <label className="search-box">
                    <Search size={15} aria-hidden="true" />
                    <span className="sr-only">Search vulnerabilities</span>
                    <input
                        type="search"
                        value={list.searchText}
                        maxLength={100}
                        placeholder="Search ID, endpoint or description…"
                        onChange={(e) => list.setSearchText(e.target.value)}
                    />
                </label>
                <FilterSelect label="Severity" options={SEVERITY_OPTIONS} {...list.filterProps('severity')} />
                <FilterSelect label="Status" options={STATUS_OPTIONS} {...list.filterProps('status')} />
                <FilterSelect label="Tool" options={SOURCE_OPTIONS} {...list.filterProps('source')} />
                {list.hasFilters && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={list.clearFilters}>
                        Clear filters
                    </button>
                )}
            </div>

            {(week || unresolvedOnly) && (
                <div className="filter-banner" role="status">
                    {week && <span>Showing vulnerabilities detected in the week of {formatDate(week)}.</span>}
                    {unresolvedOnly && !week && <span>Showing unresolved vulnerabilities only.</span>}{' '}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={list.clearFilters}>
                        Clear
                    </button>
                </div>
            )}

            {error && (
                <p role="alert" className="error-banner">
                    Could not load vulnerabilities: {error}
                </p>
            )}

            <div className={loading && data ? 'table-card is-loading' : 'table-card'}>
                {loading && !data && <div className="empty-state">Loading…</div>}

                {data && data.items.length > 0 && (
                    <>
                        <div className="table-scroll">
                            <VulnerabilitiesTable items={data.items} sortBy={sortBy} descending={descending} onSort={list.setSort} />
                        </div>
                        <Pagination
                            page={data.page}
                            pageSize={pageSize}
                            totalCount={data.totalCount}
                            totalPages={data.totalPages}
                            onPageChange={(page) => update({ page: page === 1 ? null : String(page) }, false)}
                            onPageSizeChange={(size) => update({ pageSize: size === 25 ? null : String(size) })}
                        />
                    </>
                )}

                {data && data.items.length === 0 && (
                    <div className="empty-state">
                        No vulnerabilities match the current filters.{' '}
                        <button type="button" className="btn btn-secondary btn-sm" onClick={list.clearFilters}>
                            Clear filters
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}