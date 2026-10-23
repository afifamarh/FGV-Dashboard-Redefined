import { createBrowserRouter, Navigate } from 'react-router';
import AppLayout from './AppLayout';
import { NAV_ITEMS } from './navigation';
import PagePlaceholder from '../shared/ui/PagePlaceholder';
import StatusPage from '../features/about/StatusPage';
import DashboardPage from '../features/dashboard/DashboardPage';
import EndpointsPage from '../features/endpoints/EndpointsPage';

const MIGRATED = new Set(['/dashboard', '/endpoints']);

const placeholderRoutes = NAV_ITEMS.filter((item) => !MIGRATED.has(item.path)).map((item) => ({
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
            { path: 'endpoints', element: <EndpointsPage /> },
            ...placeholderRoutes,
            { path: 'status', element: <StatusPage /> },
            { path: '*', element: <PagePlaceholder title="Page not found" /> },
        ],
    },
]);