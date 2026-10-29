import { Link } from 'react-router';
import StatusBadge from '../../shared/ui/StatusBadge';
import { formatDateTime } from '../../shared/format';
import { severityDisplay, toolName } from '../endpoints/statusDisplay';
import type { VulnerabilityListItem } from './vulnerabilitiesApi';
import { vulnStatusDisplay } from './vulnerabilityDisplay';

const COLUMNS: Array<{ key: string; label: string; sortField?: string }> = [
    { key: 'id', label: 'Vulnerability ID', sortField: 'id' },
    { key: 'severity', label: 'Severity', sortField: 'severity' },
    { key: 'endpoint', label: 'Endpoint', sortField: 'endpoint' },
    { key: 'description', label: 'Description' },
    { key: 'source', label: 'Source', sortField: 'source' },
    { key: 'detected', label: 'Detected', sortField: 'detected' },
    { key: 'status', label: 'Status', sortField: 'status' },
];

interface VulnerabilitiesTableProps {
    items: VulnerabilityListItem[];
    sortBy: string;
    descending: boolean;
    onSort: (field: string) => void;
}

export default function VulnerabilitiesTable({ items, sortBy, descending, onSort }: VulnerabilitiesTableProps) {
    return (
        <table className="data-table">
            <caption className="sr-only">Vulnerabilities across all security tools</caption>
            <thead>
                <tr>
                    {COLUMNS.map((c) => {
                        const active = c.sortField !== undefined && c.sortField === sortBy;
                        return (
                            <th key={c.key} scope="col" aria-sort={active ? (descending ? 'descending' : 'ascending') : undefined}>
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
                {items.map((v) => (
                    <tr key={v.id}>
                        <td><b>{v.id}</b></td>
                        <td><StatusBadge {...severityDisplay[v.severity]} /></td>
                        <td><Link to={`/endpoints/${encodeURIComponent(v.endpointId)}`}>{v.endpointId}</Link></td>
                        <td className="cell-wrap">{v.description}</td>
                        <td>{toolName[v.source]}</td>
                        <td>{formatDateTime(v.detectedUtc)}</td>
                        <td><StatusBadge {...vulnStatusDisplay[v.status]} /></td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}