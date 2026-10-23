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
    generatedUtc: string;
}

export const fetchDashboardSummary = (signal?: AbortSignal) =>
    getJson<DashboardSummary>('/api/v1/dashboard/summary', signal);