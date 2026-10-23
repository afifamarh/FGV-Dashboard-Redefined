import type { ReactNode } from 'react';

interface ChartPanelProps {
    title: string;
    subtitle: string;
    ariaLabel: string;
    children: ReactNode;
}

export default function ChartPanel({ title, subtitle, ariaLabel, children }: ChartPanelProps) {
    return (
        <section className="panel chart-panel">
            <div className="panel-head">
                <div>
                    <h3>{title}</h3>
                    <div className="panel-sub">{subtitle}</div>
                </div>
            </div>
            <div className="chart-wrap" role="img" aria-label={ariaLabel}>
                {children}
            </div>
        </section>
    );
}