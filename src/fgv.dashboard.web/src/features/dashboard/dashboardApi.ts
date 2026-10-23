import { getJson } from '../../shared/api/httpClient';

export interface SccmSummary {
    total: number;
    compliant: number;
    nonCompliant: number;
    unknown: number;
    outOfCoverage: number;
    within: number;
    problemToResolve: number;
    compliancePct: number | null;
    targetPct: number;
    meetsTarget: boolean;
}

export interface SeverityCounts {
    critical: number;
    high: number;
    medium: number;
    low: number;
}

export interface ToolSummary {
    key: string;
    name: string;
    healthy: number;
    affected: number;
    openFindings: number;
    statusCounts: Record<string, number>;
}

export interface WeeklyCount {
    weekStart: string;
    count: number;
}

export interface DashboardSummary {
    totalEndpoints: number;
    overall: {
        protected: number;
        attentionRequired: number;
        critical: number;
        offline: number;
        unknown: number;
    };
    vulnerableEndpoints: number;
    openVulnerabilities: number;
    openCriticalVulnerabilities: number;
    nonCompliantEndpoints: number;
    missingUpdates: number;
    sccm: SccmSummary;
    hardeningScore: number;
    openBySeverity: SeverityCounts;
    resolvedBySeverity: SeverityCounts;
    tools: ToolSummary[];
    weeklyTrend: WeeklyCount[];
    generatedUtc: string;
}

export const fetchDashboardSummary = (signal?: AbortSignal) =>
    getJson<DashboardSummary>('/api/v1/dashboard/summary', signal);