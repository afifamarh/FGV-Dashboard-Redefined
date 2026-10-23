export const formatCount = (n: number) => n.toLocaleString();

// null means "no data", which we show as a dash rather than a misleading 0%.
export const formatPercent = (value: number | null, digits = 2) =>
    value === null ? '—' : `${Number(value.toFixed(digits))}%`;

export const percentOf = (part: number, total: number) =>
    total === 0 ? 0 : Math.round((part / total) * 100);

export const formatDateTime = (iso: string) => new Date(iso).toLocaleString();

const parseDateOnly = (value: string) => new Date(`${value}T00:00:00`);

export const formatShortDate = (value: string) =>
    parseDateOnly(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export const formatDate = (value: string) =>
    parseDateOnly(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });