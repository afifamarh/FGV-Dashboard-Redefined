import type { LucideIcon } from 'lucide-react';

export type KpiTone = 'blue' | 'green' | 'amber' | 'red' | 'slate';

export interface KpiCardProps {
    label: string;
    value: string | number;
    sub?: string;
    tone: KpiTone;
    icon: LucideIcon;
    active?: boolean;
    onClick?: () => void;
}

export default function KpiCard({ label, value, sub, tone, icon: Icon, active, onClick }: KpiCardProps) {
    return (
        <button
            type="button"
            className={active ? 'kpi-card active' : 'kpi-card'}
            aria-pressed={active}
            onClick={onClick}
        >
            <span className="kpi-top">
                <span className="kpi-label">{label}</span>
                <span className={`kpi-icon tone-${tone}`}>
                    <Icon size={15} aria-hidden="true" />
                </span>
            </span>
            <span className="kpi-value">{value}</span>
            {sub && <span className="kpi-sub">{sub}</span>}
        </button>
    );
}