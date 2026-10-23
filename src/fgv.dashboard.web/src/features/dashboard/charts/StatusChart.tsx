import { Doughnut } from 'react-chartjs-2';
import { useNavigate } from 'react-router';
import '../../../shared/charts/chartSetup';
import ChartPanel from '../../../shared/charts/ChartPanel';
import { legendOptions } from '../../../shared/charts/chartTheme';
import { formatCount, percentOf } from '../../../shared/format';
import type { DashboardSummary } from '../dashboardApi';

const SEGMENTS = [
    { key: 'protected', label: 'Protected', color: '#1B7A4C' },
    { key: 'attentionRequired', label: 'Attention Required', color: '#C97A12' },
    { key: 'critical', label: 'Critical', color: '#B4222E' },
    { key: 'offline', label: 'Offline', color: '#8B95A7' },
    { key: 'unknown', label: 'Unknown', color: '#C9D0DC' },
] as const;

interface StatusChartProps {
    summary: DashboardSummary;
}

export default function StatusChart({ summary }: StatusChartProps) {
    const navigate = useNavigate();
    const total = summary.totalEndpoints;
    const segments = SEGMENTS.filter((s) => s.key !== 'unknown' || summary.overall.unknown > 0);
    const summaryText = segments.map((s) => `${s.label} ${summary.overall[s.key]}`).join(', ');

    return (
        <ChartPanel
            title="Endpoint security status"
            subtitle="Click a segment to filter endpoints"
            ariaLabel={`Endpoint security status of ${total} endpoints: ${summaryText}`}
        >
            <Doughnut
                data={{
                    labels: segments.map((s) => s.label),
                    datasets: [
                        {
                            data: segments.map((s) => summary.overall[s.key]),
                            backgroundColor: segments.map((s) => s.color),
                            borderWidth: 0,
                            hoverOffset: 6,
                        },
                    ],
                }}
                options={{
                    cutout: '66%',
                    layout: { padding: 6 },
                    plugins: {
                        legend: legendOptions,
                        tooltip: {
                            callbacks: {
                                label: (c) =>
                                    ` ${c.label}: ${c.raw} of ${total} (${percentOf(Number(c.raw), total)}%)`,
                            },
                        },
                    },
                    onClick: (_event, elements) => {
                        if (elements.length) navigate(`/endpoints?overall=${segments[elements[0].index].key}`);
                    },
                }}
            />
            <div className="doughnut-center" aria-hidden="true">
                <div className="val">{formatCount(total)}</div>
                <div className="lbl">endpoints</div>
            </div>
        </ChartPanel>
    );
}