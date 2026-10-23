export const formatCount = (n: number) => n.toLocaleString();

// null means "no data", which we show as a dash rather than a misleading 0%.
export const formatPercent = (value: number | null, digits = 2) =>
    value === null ? '—' : `${Number(value.toFixed(digits))}%`;

export const percentOf = (part: number, total: number) =>
    total === 0 ? 0 : Math.round((part / total) * 100);

export const formatDateTime = (iso: string) => new Date(iso).toLocaleString();