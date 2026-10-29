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

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type SecurityTool = 'defender' | 'sccm' | 'kaspersky' | 'trendMicro';
export type RecommendedAction =
    | 'monitorAsUsual'
    | 'reviewAndSchedule'
    | 'isolateAndRemediate'
    | 'reconnectAndVerify';

export interface ControlResult {
    key: string;
    name: string;
    source: string;
    passed: boolean;
}

export interface OpenFinding {
    id: string;
    severity: Severity;
    source: SecurityTool;
    detectedUtc: string;
}

export interface EndpointDetail {
    summary: EndpointListItem;
    patchApplicable: number;
    patchInstalled: number;
    hardeningScore: number;
    passedControls: number;
    recommendedAction: RecommendedAction;
    controls: ControlResult[];
    openFindings: OpenFinding[];
}

export const fetchEndpointDetail = (id: string, signal?: AbortSignal) =>
    getJson<EndpointDetail>(`/api/v1/endpoints/${encodeURIComponent(id)}`, signal);