import { Link } from 'react-router';
import StatusBadge from '../../shared/ui/StatusBadge';
import type { EndpointListItem } from './endpointsApi';
import { overallDisplay, patchDisplay, protectionDisplay, riskDisplay } from './statusDisplay';

const COLUMNS: Array<{ key: string; label: string; sortField?: string }> = [
    { key: 'hostname', label: 'Endpoint', sortField: 'hostname' },
    { key: 'ip', label: 'IP address' },
    { key: 'os', label: 'OS' },
    { key: 'location', label: 'Location' },
    { key: 'overall', label: 'Status', sortField: 'overall' },
    { key: 'defender', label: 'Defender', sortField: 'defender' },
    { key: 'patch', label: 'SCCM', sortField: 'patch' },
    { key: 'kaspersky', label: 'Kaspersky', sortField: 'kaspersky' },
    { key: 'trend', label: 'Trend Micro', sortField: 'trendMicro' },
    { key: 'compliance', label: 'Patch %', sortField: 'patchCompliance' },
    { key: 'missing', label: 'Missing', sortField: 'missingUpdates' },
];

interface EndpointsTableProps {
    items: EndpointListItem[];
    sortBy: string;
    descending: boolean;
    onSort: (field: string) => void;
}

export default function EndpointsTable({ items, sortBy, descending, onSort }: EndpointsTableProps) {
    return (
        <table className="data-table">
            <caption className="sr-only">Endpoints and their security status</caption>
            <thead>
                <tr>
                    {COLUMNS.map((c) => {
                        const active = c.sortField !== undefined && c.sortField === sortBy;
                        return (
                            <th
                                key={c.key}
                                scope="col"
                                aria-sort={active ? (descending ? 'descending' : 'ascending') : undefined}
                            >
                                {c.sortField ? (
                                    <button type="button" className="sort-btn" onClick={() => onSort(c.sortField!)}>
                                        {c.label}
                                        <span aria-hidden="true">{active ? (descending ? '▼' : '▲') : ''}</span>
                                    </button>
                                ) : (
                                    c.label
                                )}
                            </th>
                        );
                    })}
                </tr>
            </thead>
            <tbody>
                {items.map((e) => (
                    <tr key={e.id}>
                        <td>
                            <Link to={`/endpoints/${encodeURIComponent(e.id)}`}>
                                <b>{e.hostname}</b>
                            </Link>
                            <span className="cell-sub">{e.id}</span>
                        </td>
                        <td>{e.ipAddress ?? '—'}</td>
                        <td>{e.operatingSystem ?? '—'}</td>
                        <td>{e.location ?? '—'}</td>
                        <td><StatusBadge {...overallDisplay[e.overall]} /></td>
                        <td><StatusBadge {...protectionDisplay[e.defender]} /></td>
                        <td><StatusBadge {...patchDisplay[e.patch]} /></td>
                        <td><StatusBadge {...protectionDisplay[e.kaspersky]} /></td>
                        <td><StatusBadge {...riskDisplay[e.trendMicro]} /></td>
                        <td>{e.patchCompliancePct === null ? '—' : `${e.patchCompliancePct}%`}</td>
                        <td>{e.missingUpdates}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}