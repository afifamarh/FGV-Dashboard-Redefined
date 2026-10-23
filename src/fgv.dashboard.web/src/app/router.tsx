import { createBrowserRouter, Navigate } from 'react-router';
import AppLayout from './AppLayout';
import { NAV_ITEMS } from './navigation';
import PagePlaceholder from '../shared/ui/PagePlaceholder';
import StatusPage from '../features/about/StatusPage';
import DashboardPage from '../features/dashboard/DashboardPage';

const placeholderRoutes = NAV_ITEMS.filter((item) => item.path !== '/dashboard').map((item) => ({
    path: item.path.slice(1),
    element: <PagePlaceholder title={item.label} />,
}));

export const router = createBrowserRouter([
    {
        path: '/',
        element: <AppLayout />,
        children: [
            { index: true, element: <Navigate to="/dashboard" replace /> },
            { path: 'dashboard', element: <DashboardPage /> },
            ...placeholderRoutes,
            { path: 'status', element: <StatusPage /> },
            { path: '*', element: <PagePlaceholder title="Page not found" /> },
        ],
    },
]);