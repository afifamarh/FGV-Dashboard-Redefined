import { Bar } from 'react-chartjs-2';
import { useNavigate } from 'react-router';
import '../../../shared/charts/chartSetup';
import ChartPanel from '../../../shared/charts/ChartPanel';
import { chartColors, chartFont, severityColors, withAlpha } from '../../../shared/charts/chartTheme';
import type { DashboardSummary } from '../dashboardApi';

const LABELS = ['Critical', 'High', 'Medium', 'Low'] as const;
const KEYS = ['critical', 'high', 'medium', 'low'] as const;

interface SeverityChartProps {
    summary: DashboardSummary;
}

export default function SeverityChart({ summary }: SeverityChartProps) {
    const navigate = useNavigate();
    const open = KEYS.map((k) => summary.openBySeverity[k]);
    const resolved = KEYS.map((k) => summary.resolvedBySeverity[k]);
    const summaryText = LABELS.map((l, i) => `${l} ${open[i]} open, ${resolved[i]} resolved`).join('; ');

    return (
        <ChartPanel
            title="Vulnerabilities by severity"
            subtitle="Solid bars are unresolved, faded bars are resolved. Click a bar to filter"
            ariaLabel={`Vulnerabilities by severity: ${summaryText}`}
        >
            <Bar
                data={{
                    labels: [...LABELS],
                    datasets: [
                        {
                            label: 'Unresolved',
                            data: open,
                            backgroundColor: LABELS.map((l) => severityColors[l]),
                            borderRadius: 6,
                            maxBarThickness: 56,
                            stack: 's',
                        },
                        {
                            label: 'Resolved',
                            data: resolved,
                            backgroundColor: LABELS.map((l) => withAlpha(severityColors[l], 0.25)),
                            borderRadius: 6,
                            maxBarThickness: 56,
                            stack: 's',
                        },
                    ],
                }}
                options={{
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            callbacks: {
                                footer: (items) => `Total: ${items.reduce((sum, i) => sum + Number(i.raw), 0)}`,
                            },
                        },
                    },
                    scales: {
                        x: { stacked: true, ticks: { color: chartColors.text, font: chartFont }, grid: { display: false } },
                        y: {
                            stacked: true,
                            beginAtZero: true,
                            ticks: { precision: 0, color: chartColors.text, font: chartFont },
                            grid: { color: chartColors.grid },
                        },
                    },
                    onClick: (_event, elements) => {
                        if (elements.length) navigate(`/vulnerabilities?severity=${LABELS[elements[0].index]}`);
                    },
                }}
            />
        </ChartPanel>
    );
}