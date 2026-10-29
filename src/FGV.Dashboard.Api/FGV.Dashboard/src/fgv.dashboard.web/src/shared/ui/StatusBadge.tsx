interface StatusBadgeProps {
    label: string;
    tone: 'green' | 'amber' | 'red' | 'blue' | 'slate';
}

export default function StatusBadge({ label, tone }: StatusBadgeProps) {
    return <span className={`badge badge-${tone}`}>{label}</span>;
}
