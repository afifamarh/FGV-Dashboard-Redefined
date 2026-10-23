export interface NavItem {
    path: string;
    label: string;
}

export const NAV_ITEMS: NavItem[] = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/endpoints', label: 'Endpoints' },
    { path: '/defender', label: 'Microsoft Defender' },
    { path: '/kaspersky', label: 'Kaspersky XDR' },
    { path: '/sccm', label: 'SCCM' },
    { path: '/trendmicro', label: 'Trend Micro Vision One' },
    { path: '/vulnerabilities', label: 'Vulnerabilities' },
    { path: '/hardening', label: 'Security Hardening' },
    { path: '/history', label: 'Endpoint History' },
    { path: '/reports', label: 'Reports' },
    { path: '/audit', label: 'Audit Trail' },
    { path: '/tools', label: 'Tools' },
    { path: '/settings', label: 'Settings' },
];