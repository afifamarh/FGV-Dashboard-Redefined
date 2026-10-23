import { useNavigate } from 'react-router';
import { formatCount, formatPercent } from '../../shared/format';
import type { DashboardSummary } from './dashboardApi';

interface ExecutiveKpiBarProps {
    summary: DashboardSummary;
}

export default function ExecutiveKpiBar({ summary }: ExecutiveKpiBarProps) {
    const navigate = useNavigate();

    const items = [
        {
            label: 'Total Monitored Assets',
            value: formatCount(summary.totalEndpoints),
            sub: 'Sample endpoints in this prototype',
            to: '/endpoints',
        },
        {
            label: 'Global Patching Rate',
            value: formatPercent(summary.sccm.compliancePct),
            sub: `Target ${summary.sccm.targetPct}% · SCCM Compliant ÷ (Total − Out of Coverage)`,
            to: '/sccm',
        },
        {
            label: 'Open Critical Vulnerabilities',
            value: formatCount(summary.openCriticalVulnerabilities),
            sub: 'Unresolved, Critical severity',
            to: '/vulnerabilities',
        },
    ];

    return (
        <div className="exec-kpi-bar">
            {items.map((item) => (
                <button key={item.label} type="button" className="exec-kpi-item" onClick={() => navigate(item.to)}>
                    <span className="exec-kpi-label">{item.label}</span>
                    <span className="exec-kpi-value">{item.value}</span>
                    <span className="exec-kpi-sub">{item.sub}</span>
                </button>
            ))}
        </div>
    );
}