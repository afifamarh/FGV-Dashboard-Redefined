import { getJson } from '../../shared/api/httpClient';
import type { PagedResult } from '../../shared/api/types';
import type { SeverityCounts } from '../dashboard/dashboardApi';
import type { SecurityTool, Severity } from '../endpoints/endpointsApi';

export type VulnerabilityStatus = 'open' | 'inProgress' | 'resolved';

export interface VulnerabilityListItem {
    id: string;
    endpointId: string;
    severity: Severity;
    source: SecurityTool;
    status: VulnerabilityStatus;
    detectedUtc: string;
    description: string;
}

export interface VulnerabilitySummary {
    total: number;
    unresolved: number;
    resolved: number;
    bySeverity: SeverityCounts;
    openBySeverity: SeverityCounts;
}

export const fetchVulnerabilityPage = (queryString: string, signal?: AbortSignal) =>
    getJson<PagedResult<VulnerabilityListItem>>(
        `/api/v1/vulnerabilities${queryString ? `?${queryString}` : ''}`,
        signal,
    );

export const fetchVulnerabilitySummary = (signal?: AbortSignal) =>
    getJson<VulnerabilitySummary>('/api/v1/vulnerabilities/summary', signal);