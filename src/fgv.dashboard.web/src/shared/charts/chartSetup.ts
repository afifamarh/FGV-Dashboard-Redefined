import {
    ArcElement, BarElement, CategoryScale, Chart, Filler, Legend,
    LinearScale, LineElement, PointElement, Tooltip,
} from 'chart.js';

Chart.register(
    ArcElement, BarElement, CategoryScale, Filler, Legend,
    LinearScale, LineElement, PointElement, Tooltip,
);

Chart.defaults.maintainAspectRatio = false;
Chart.defaults.responsive = true;
Chart.defaults.font.family = "'Inter', sans-serif";