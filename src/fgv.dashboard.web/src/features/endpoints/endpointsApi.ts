import { getJson } from '../../shared/api/httpClient';
import type { PagedResult } from '../../shared/api/types';

export type OverallStatus = 'unknown' | 'protected' | 'attentionRequired' | 'critical' | 'offline';
export type ProtectionStatus = 'unknown' | 'protected' | 'atRisk' | 'offline';
export type PatchState = 'unknown' | 'compliant' | 'nonCompliant';
export type RiskLevel = 'unknown' | 'low' | 'medium' | 'high' | 'critical';

export interface EndpointListItem {
    id: string;
    hostname: string;
    ipAddress: string | null;
    operatingSystem: string | null;
    location: string | null;
    overall: OverallStatus;
    defender: ProtectionStatus;
    patch: PatchState;
    kaspersky: ProtectionStatus;
    trendMicro: RiskLevel;
    patchCompliancePct: number | null;
    missingUpdates: number;
}

export const fetchEndpointPage = (queryString: string, signal?: AbortSignal) =>
    getJson<PagedResult<EndpointListItem>>(
        `/api/v1/endpoints${queryString ? `?${queryString}` : ''}`,
        signal,
    );