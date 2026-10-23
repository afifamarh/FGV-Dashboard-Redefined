import { formatCount } from '../../shared/format';
import type { DashboardSummary } from './dashboardApi';
import { getPostureStatus } from './postureStatus';

const RADIUS = 56;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface PostureHeroProps {
    summary: DashboardSummary;
}

export default function PostureHero({ summary }: PostureHeroProps) {
    const score = summary.hardeningScore;
    const status = getPostureStatus(score);
    const offset = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE;

    return (
        <section className="posture-hero" aria-label="Overall security posture">
            <div className="posture-ring-wrap">
                <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">
                    <circle cx="66" cy="66" r={RADIUS} stroke="rgba(255,255,255,0.14)" strokeWidth="12" fill="none" />
                    <circle
                        cx="66" cy="66" r={RADIUS}
                        stroke={status.color} strokeWidth="12" fill="none" strokeLinecap="round"
                        strokeDasharray={CIRCUMFERENCE} strokeDashoffset={offset}
                    />
                </svg>
                <div className="posture-ring-label">
                    <div className="val">{score}</div>
                    <div className="lbl">Hardening score</div>
                </div>
            </div>

            <div className="posture-text">
                <h2>Overall posture: {status.label}</h2>
                <p>
                    Composite score from endpoint protection, patch compliance and hardening controls across
                    all four monitored tools. Sample data for prototype purposes.
                </p>
            </div>

            <div className="posture-stats">
                <div className="posture-stat">
                    <div className="n">{formatCount(summary.openVulnerabilities)}</div>
                    <div className="l">Open vulnerabilities</div>
                </div>
                <div className="posture-stat">
                    <div className="n">{formatCount(summary.openCriticalVulnerabilities)}</div>
                    <div className="l">Critical, unresolved</div>
                </div>
                <div className="posture-stat">
                    <div className="n">{formatCount(summary.nonCompliantEndpoints)}</div>
                    <div className="l">Non-compliant endpoints</div>
                </div>
            </div>
        </section>
    );
}