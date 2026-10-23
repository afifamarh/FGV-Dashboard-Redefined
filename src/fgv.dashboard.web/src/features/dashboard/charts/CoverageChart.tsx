import { Bar } from 'react-chartjs-2';
import { useNavigate } from 'react-router';
import '../../../shared/charts/chartSetup';
import ChartPanel from '../../../shared/charts/ChartPanel';
import { chartColors, chartFont, legendOptions } from '../../../shared/charts/chartTheme';
import type { DashboardSummary } from '../dashboardApi';

interface CoverageChartProps {
    summary: DashboardSummary;
}

export default function CoverageChart({ summary }: CoverageChartProps) {
    const navigate = useNavigate();
    const { tools, totalEndpoints } = summary;
    const summaryText = tools.map((t) => `${t.name} ${t.healthy} healthy, ${t.affected} affected`).join('; ');

    return (
        <ChartPanel
            title="Security tool coverage"
            subtitle="Healthy vs affected endpoints per tool. Click a bar for details"
            ariaLabel={`Security tool coverage out of ${totalEndpoints} endpoints: ${summaryText}`}
        >
            <Bar
                data={{
                    labels: tools.map((t) => t.name),
                    datasets: [
                        {
                            label: 'Healthy',
                            data: tools.map((t) => t.healthy),
                            backgroundColor: '#2457C5',
                            borderRadius: 4,
                            maxBarThickness: 30,
                            stack: 'c',
                        },
                        {
                            label: 'Affected',
                            data: tools.map((t) => t.affected),
                            backgroundColor: 'rgba(180, 34, 46, 0.35)',
                            borderRadius: 4,
                            maxBarThickness: 30,
                            stack: 'c',
                        },
                    ],
                }}
                options={{
                    indexAxis: 'y',
                    layout: { padding: { right: 12 } },
                    plugins: {
                        legend: legendOptions,
                        tooltip: {
                            callbacks: {
                                label: (c) => ` ${c.dataset.label}: ${c.raw} of ${totalEndpoints} endpoints`,
                            },
                        },
                    },
                    scales: {
                        x: {
                            stacked: true,
                            beginAtZero: true,
                            max: totalEndpoints || 1,
                            ticks: { precision: 0, color: chartColors.text, font: chartFont },
                            grid: { color: chartColors.grid },
                        },
                        y: { stacked: true, ticks: { color: chartColors.text, font: chartFont }, grid: { display: false } },
                    },
                    onClick: (_event, elements) => {
                        if (elements.length) navigate(`/${tools[elements[0].index].key}`);
                    },
                }}
            />
        </ChartPanel>
    );
}