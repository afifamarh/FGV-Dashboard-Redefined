import { Line } from 'react-chartjs-2';
import { useNavigate } from 'react-router';
import '../../../shared/charts/chartSetup';
import ChartPanel from '../../../shared/charts/ChartPanel';
import { chartColors, chartFont } from '../../../shared/charts/chartTheme';
import { formatDate, formatShortDate } from '../../../shared/format';
import type { DashboardSummary } from '../dashboardApi';

interface TrendChartProps {
    summary: DashboardSummary;
}

export default function TrendChart({ summary }: TrendChartProps) {
    const navigate = useNavigate();
    const weeks = summary.weeklyTrend;
    const summaryText = weeks.map((w) => `week of ${formatShortDate(w.weekStart)}: ${w.count}`).join('; ');

    return (
        <ChartPanel
            title="Vulnerability trend"
            subtitle="New findings per week (by detected date). Click a point to see that week"
            ariaLabel={`New vulnerabilities per week: ${summaryText}`}
        >
            <Line
                data={{
                    labels: weeks.map((w) => formatShortDate(w.weekStart)),
                    datasets: [
                        {
                            label: 'New vulnerabilities',
                            data: weeks.map((w) => w.count),
                            borderColor: '#2457C5',
                            backgroundColor: 'rgba(36, 87, 197, 0.12)',
                            fill: true,
                            tension: 0.35,
                            pointRadius: 4,
                            pointBackgroundColor: '#2457C5',
                            pointHoverRadius: 7,
                        },
                    ],
                }}
                options={{
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                title: (items) => `Week of ${formatDate(weeks[items[0].dataIndex].weekStart)}`,
                                label: (c) => ` ${c.raw} new vulnerabilit${c.raw === 1 ? 'y' : 'ies'}`,
                            },
                        },
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { precision: 0, color: chartColors.text, font: chartFont },
                            grid: { color: chartColors.grid },
                        },
                        x: { ticks: { color: chartColors.text, font: chartFont }, grid: { display: false } },
                    },
                    onClick: (_event, elements) => {
                        if (elements.length) navigate(`/vulnerabilities?week=${weeks[elements[0].index].weekStart}`);
                    },
                }}
            />
        </ChartPanel>
    );
}