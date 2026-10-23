import { Bug, RefreshCw, Shield, SlidersHorizontal, TriangleAlert } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useApi } from '../../shared/api/useApi';
import { formatCount, formatDateTime, formatPercent, percentOf } from '../../shared/format';
import { fetchDashboardSummary } from './dashboardApi';
import ExecutiveKpiBar from './ExecutiveKpiBar';
import KpiCard from './KpiCard';
import type { KpiCardProps } from './KpiCard';
import PostureHero from './PostureHero';
import './dashboard.css';

export default function DashboardPage() {
    const navigate = useNavigate();
    const { data, error, loading, reload } = useApi(fetchDashboardSummary);

    const kpis = data
        ? ([
            {
                label: 'Protected Endpoints',
                value: formatCount(data.overall.protected),
                sub: `${percentOf(data.overall.protected, data.totalEndpoints)}% of fleet`,
                tone: 'green',
                icon: Shield,
                to: '/endpoints',
            },
            {
                label: 'Vulnerable Endpoints',
                value: formatCount(data.vulnerableEndpoints),
                sub: 'With unresolved findings',
                tone: 'red',
                icon: Bug,
                to: '/endpoints',
            },
            {
                label: 'Non-Compliant Endpoints',
                value: formatCount(data.nonCompliantEndpoints),
                sub: 'Flagged by SCCM',
                tone: 'amber',
                icon: TriangleAlert,
                to: '/endpoints',
            },
            {
                label: 'Patch Compliance',
                value: formatPercent(data.sccm.compliancePct),
                sub: `${formatCount(data.missingUpdates)} missing updates`,
                tone: 'blue',
                icon: RefreshCw,
                to: '/sccm',
            },
            {
                label: 'Hardening Score',
                value: data.hardeningScore,
                sub: 'Out of 100, fleet',
                tone: 'slate',
                icon: SlidersHorizontal,
                to: '/hardening',
            },
        ] satisfies Array<Omit<KpiCardProps, 'onClick'> & { to: string }>)
        : [];

    return (
        <section>
            <header className="page-head">
                <div>
                    <h1>Security overview</h1>
                    <p>
                        Consolidated endpoint security posture across Microsoft Defender, SCCM, Kaspersky and
                        Trend Micro Vision One.
                    </p>
                    {data && (
                        <div className="data-asof">
                            Sample data generated <b>{formatDateTime(data.generatedUtc)}</b>.
                        </div>
                    )}
                </div>
                <div className="page-actions">
                    <button type="button" className="btn btn-secondary" onClick={reload} disabled={loading}>
                        <RefreshCw size={14} aria-hidden="true" /> Refresh
                    </button>
                </div>
            </header>

            {error && (
                <p role="alert" className="error-banner">
                    Could not load the dashboard: {error}
                </p>
            )}
            {loading && !data && <p>Loading…</p>}

            {data && (
                <>
                    <ExecutiveKpiBar summary={data} />
                    <PostureHero summary={data} />
                    <div className="kpi-grid">
                        {kpis.map(({ to, ...card }) => (
                            <KpiCard key={card.label} {...card} onClick={() => navigate(to)} />
                        ))}
                    </div>
                </>
            )}
        </section>
    );
}