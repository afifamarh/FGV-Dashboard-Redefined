import type { LucideIcon } from 'lucide-react';

export type KpiTone = 'blue' | 'green' | 'amber' | 'red' | 'slate';

export interface KpiCardProps {
    label: string;
    value: string | number;
    sub?: string;
    tone: KpiTone;
    icon: LucideIcon;
    onClick?: () => void;
}

export default function KpiCard({ label, value, sub, tone, icon: Icon, onClick }: KpiCardProps) {
    return (
        <button type="button" className="kpi-card" onClick={onClick}>
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