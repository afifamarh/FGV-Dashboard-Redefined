export const chartColors = { grid: '#EEF1F6', text: '#5B6472', strong: '#182233' } as const;

export const severityColors = {
    Critical: '#B4222E',
    High: '#C97A12',
    Medium: '#2457C5',
    Low: '#8B95A7',
} as const;

export const chartFont = { family: "'Inter', sans-serif", size: 11.5 };

export const legendOptions = {
    position: 'bottom' as const,
    align: 'center' as const,
    labels: {
        color: chartColors.text,
        font: chartFont,
        padding: 14,
        usePointStyle: true,
        pointStyle: 'circle' as const,
    },
};

export function withAlpha(hex: string, alpha: number): string {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}