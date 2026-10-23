export interface PostureStatus {
    label: string;
    color: string;
}

export function getPostureStatus(score: number): PostureStatus {
    if (score >= 85) return { label: 'Strong', color: '#4FD1A5' };
    if (score >= 65) return { label: 'Needs attention', color: '#F2B84B' };
    return { label: 'At risk', color: '#F17E8A' };
}