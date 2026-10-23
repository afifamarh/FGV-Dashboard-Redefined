interface FilterSelectProps {
    label: string;
    value: string;
    options: Array<{ value: string; label: string }>;
    onChange: (value: string) => void;
}

export default function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
    return (
        <select
            className="filter-select"
            aria-label={label}
            value={value}
            onChange={(e) => onChange(e.target.value)}
        >
            <option value="">{label}: all</option>
            {options.map((o) => (
                <option key={o.value} value={o.value}>
                    {o.label}
                </option>
            ))}
        </select>
    );
}