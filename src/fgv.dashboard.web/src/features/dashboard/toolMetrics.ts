import { formatPercent } from '../../shared/format';
import type { DashboardSummary, ToolSummary } from './dashboardApi';

export interface MetricRow {
    label: string;
    value: string | number;
}

export function getToolMetrics(tool: ToolSummary, summary: DashboardSummary): MetricRow[] {
    const total = summary.totalEndpoints;
    const c = tool.statusCounts;

    switch (tool.key) {
        case 'defender':
            return [
                { label: 'Protected endpoints', value: `${c.protected}/${total}` },
                { label: 'At-risk endpoints', value: c.atRisk },
                { label: 'Offline endpoints', value: c.offline },
            ];
        case 'sccm':
            return [
                { label: 'Managed endpoints', value: total },
                { label: 'Compliant endpoints', value: `${c.compliant}/${total}` },
                { label: 'Patch compliance', value: formatPercent(summary.sccm.compliancePct) },
            ];
        case 'kaspersky':
            return [
                { label: 'Protected endpoints', value: `${c.protected}/${total}` },
                { label: 'At-risk endpoints', value: c.atRisk },
            ];
        case 'trendmicro':
            return [
                { label: 'Monitored endpoints', value: total },
                { label: 'Low / medium risk', value: c.lowOrMediumRisk },
                { label: 'High / critical risk', value: c.highOrCriticalRisk },
            ];
        default:
            return [];
    }
}