import { ArrowLeft } from 'lucide-react';
import { useCallback } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { useApi } from '../../shared/api/useApi';
import { formatDateTime } from '../../shared/format';
import StatusBadge from '../../shared/ui/StatusBadge';
import { defenderThreatText, kasperskyThreatText, recommendedActionText } from './detailText';
import { fetchEndpointDetail } from './endpointsApi';
import type { EndpointDetail } from './endpointsApi';
import {
    overallDisplay,
    patchDisplay,
    protectionDisplay,
    riskDisplay,
    severityDisplay,
    toolName,
} from './statusDisplay';

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="detail-card">
            <h3>{title}</h3>
            {children}
        </section>
    );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="detail-row">
            <span className="k">{label}</span>
            <span className="v">{children}</span>
        </div>
    );
}

function Detail({ detail }: { detail: EndpointDetail }) {
    const { summary: e, controls, openFindings } = detail;
    const failing = controls.filter((c) => !c.passed);
    const trendFindings = openFindings.filter((f) => f.source === 'trendMicro').length;

    return (
        <>
            <header className="page-head">
                <div>
                    <h1>{e.hostname}</h1>
                    <p>
                        {e.id} · {e.operatingSystem ?? 'OS unknown'} · {e.location ?? 'Location unknown'} ·{' '}
                        {e.ipAddress ?? 'No IP'}
                    </p>
                </div>
                <StatusBadge {...overallDisplay[e.overall]} />
            </header>

            <div className="detail-grid">
                <Section title="Microsoft Defender">
                    <Row label="Protection status">
                        <StatusBadge {...protectionDisplay[e.defender]} />
                    </Row>
                    <Row label="Threat status">{defenderThreatText(e.defender)}</Row>
                </Section>

                <Section title="SCCM">
                    <Row label="Patch status">
                        <StatusBadge {...patchDisplay[e.patch]} />
                    </Row>
                    <Row label="Update compliance">
                        {e.patchCompliancePct === null
                            ? '—'
                            : `${e.patchCompliancePct}% (${detail.patchInstalled}/${detail.patchApplicable})`}
                    </Row>
                    <Row label="Missing updates">{e.missingUpdates}</Row>
                </Section>

                <Section title="Kaspersky">
                    <Row label="Protection status">
                        <StatusBadge {...protectionDisplay[e.kaspersky]} />
                    </Row>
                    <Row label="Threat status">{kasperskyThreatText(e.kaspersky)}</Row>
                </Section>

                <Section title="Trend Micro Vision One">
                    <Row label="Risk level">
                        <StatusBadge {...riskDisplay[e.trendMicro]} />
                    </Row>
                    <Row label="Unresolved findings from this tool">{trendFindings}</Row>
                </Section>

                <Section title="Overall security">
                    <Row label="Hardening score">
                        {detail.hardeningScore} / 100 ({detail.passedControls}/{controls.length} controls)
                    </Row>
                    <Row label="Unresolved vulnerabilities">{openFindings.length}</Row>
                    <Row label="Recommended action">{recommendedActionText[detail.recommendedAction]}</Row>
                </Section>
            </div>

            <section className="detail-card detail-wide">
                <h3>Failing hardening controls ({failing.length})</h3>
                {failing.length > 0 ? (
                    <div className="badge-row">
                        {failing.map((c) => (
                            <span key={c.key} className="badge badge-amber" title={c.source}>
                                {c.name}
                            </span>
                        ))}
                    </div>
                ) : (
                    <p className="hint">All sample hardening controls are met.</p>
                )}
            </section>

            <section className="detail-card detail-wide">
                <h3>Unresolved vulnerabilities ({openFindings.length})</h3>
                {openFindings.length > 0 ? (
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th scope="col">ID</th>
                                    <th scope="col">Severity</th>
                                    <th scope="col">Source</th>
                                    <th scope="col">Detected</th>
                                </tr>
                            </thead>
                            <tbody>
                                {openFindings.map((f) => (
                                    <tr key={f.id}>
                                        <td>
                                            <b>{f.id}</b>
                                        </td>
                                        <td>
                                            <StatusBadge {...severityDisplay[f.severity]} />
                                        </td>
                                        <td>{toolName[f.source]}</td>
                                        <td>{formatDateTime(f.detectedUtc)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="hint">No unresolved vulnerabilities for this endpoint.</p>
                )}
            </section>
        </>
    );
}

export default function EndpointDetailPage() {
    const { id = '' } = useParams();
    const fetcher = useCallback((signal: AbortSignal) => fetchEndpointDetail(id, signal), [id]);
    const { data, error, loading } = useApi(fetcher);

    return (
        <section>
            <Link to="/endpoints" className="back-link">
                <ArrowLeft size={14} aria-hidden="true" /> Back to endpoints
            </Link>

            {error && (
                <p role="alert" className="error-banner">
                    Could not load endpoint {id}: {error}
                </p>
            )}
            {loading && !data && <p>Loading…</p>}

            {data && <Detail detail={data} />}
        </section>
    );
}