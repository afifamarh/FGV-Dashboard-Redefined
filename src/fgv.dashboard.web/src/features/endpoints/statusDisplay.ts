import type { OverallStatus, PatchState, ProtectionStatus, RiskLevel } from './endpointsApi';

export type BadgeTone = 'green' | 'amber' | 'red' | 'blue' | 'slate';

interface Display {
    label: string;
    tone: BadgeTone;
}

export const overallDisplay: Record<OverallStatus, Display> = {
    protected: { label: 'Protected', tone: 'green' },
    attentionRequired: { label: 'Attention Required', tone: 'amber' },
    critical: { label: 'Critical', tone: 'red' },
    offline: { label: 'Offline', tone: 'slate' },
    unknown: { label: 'Unknown', tone: 'slate' },
};

export const protectionDisplay: Record<ProtectionStatus, Display> = {
    protected: { label: 'Protected', tone: 'green' },
    atRisk: { label: 'At Risk', tone: 'red' },
    offline: { label: 'Offline', tone: 'slate' },
    unknown: { label: 'Unknown', tone: 'slate' },
};

export const patchDisplay: Record<PatchState, Display> = {
    compliant: { label: 'Compliant', tone: 'green' },
    nonCompliant: { label: 'Non-Compliant', tone: 'red' },
    unknown: { label: 'Unknown', tone: 'slate' },
};

export const riskDisplay: Record<RiskLevel, Display> = {
    low: { label: 'Low Risk', tone: 'green' },
    medium: { label: 'Medium Risk', tone: 'blue' },
    high: { label: 'High Risk', tone: 'amber' },
    critical: { label: 'Critical Risk', tone: 'red' },
    unknown: { label: 'Unknown', tone: 'slate' },
};

export interface Option {
    value: string;
    label: string;
}

const toOptions = (display: Record<string, Display>, keys: string[]): Option[] =>
    keys.map((key) => ({ value: key, label: display[key].label }));

export const OVERALL_OPTIONS = toOptions(overallDisplay, ['protected', 'attentionRequired', 'critical', 'offline', 'unknown']);
export const DEFENDER_OPTIONS = toOptions(protectionDisplay, ['protected', 'atRisk', 'offline']);
export const PATCH_OPTIONS = toOptions(patchDisplay, ['compliant', 'nonCompliant', 'unknown']);
export const KASPERSKY_OPTIONS = toOptions(protectionDisplay, ['protected', 'atRisk']);
export const RISK_OPTIONS = toOptions(riskDisplay, ['low', 'medium', 'high', 'critical']);