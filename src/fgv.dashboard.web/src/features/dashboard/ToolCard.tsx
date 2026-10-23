import { Eye, Monitor, Radar, Shield, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import type { DashboardSummary, ToolSummary } from './dashboardApi';
import type { KpiTone } from './KpiCard';
import { getToolMetrics } from './toolMetrics';

const PRESENTATION: Record<string, { icon: LucideIcon; tone: KpiTone }> = {
    defender: { icon: Shield, tone: 'blue' },
    sccm: { icon: Monitor, tone: 'slate' },
    kaspersky: { icon: ShieldCheck, tone: 'green' },
    trendmicro: { icon: Radar, tone: 'amber' },
};

interface ToolCardProps {
    tool: ToolSummary;
    summary: DashboardSummary;
}

export default function ToolCard({ tool, summary }: ToolCardProps) {
    const { icon: Icon, tone } = PRESENTATION[tool.key] ?? { icon: Shield, tone: 'slate' as KpiTone };
    const metrics = getToolMetrics(tool, summary);

    return (
        <article className="tool-card">
            <div className="tool-card-head">
                <div className={`tool-mark tone-${tone}`}>
                    <Icon size={18} aria-hidden="true" />
                </div>
                <div className="tool-name">{tool.name}</div>
                <span className="badge badge-amber">Sample data</span>
            </div>
            {metrics.map((m) => (
                <div key={m.label} className="tool-metric-row">
                    <span className="k">{m.label}</span>
                    <span className="v">{m.value}</span>
                </div>
            ))}
            <div className="tool-metric-row">
                <span className="k">Open findings</span>
                <span className="v">{tool.openFindings}</span>
            </div>
            <Link to={`/${tool.key}`} className="btn btn-secondary btn-sm tool-card-link">
                <Eye size={14} aria-hidden="true" /> View details
            </Link>
        </article>
    );
}