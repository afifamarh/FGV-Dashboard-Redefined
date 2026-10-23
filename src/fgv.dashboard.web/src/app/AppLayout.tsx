import { NavLink, Outlet } from 'react-router';
import { NAV_ITEMS } from './navigation';

export default function AppLayout() {
    return (
        <div className="app">
            <aside className="sidebar">
                <div className="sidebar-brand">FGV Prodata Security Dashboard</div>
                <nav aria-label="Main">
                    {NAV_ITEMS.map((item) => (
                        <NavLink key={item.path} to={item.path} className="nav-link">
                            {item.label}
                        </NavLink>
                    ))}
                    <NavLink to="/status" className="nav-link">
                        System status
                    </NavLink>
                </nav>
                <div className="sidebar-footer">Sample data only</div>
            </aside>
            <main className="content">
                <Outlet />
            </main>
        </div>
    );
}