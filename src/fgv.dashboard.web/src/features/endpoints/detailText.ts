import type { ProtectionStatus, RecommendedAction } from './endpointsApi';

export const defenderThreatText = (status: ProtectionStatus) =>
    status === 'protected' ? 'No active threats' : status === 'offline' ? 'Not reporting' : 'Threat indicators present';

export const kasperskyThreatText = (status: ProtectionStatus) =>
    status === 'protected' ? 'Clean' : 'Active detection';

export const recommendedActionText: Record<RecommendedAction, string> = {
    monitorAsUsual: 'None — monitor as usual',
    reviewAndSchedule: 'Review and schedule remediation',
    isolateAndRemediate: 'Isolate and remediate immediately',
    reconnectAndVerify: 'Reconnect device and verify agents',
};