using System;
using System.Collections.Generic;
using System.Text;
using FGV.Dashboard.Application.Security;
using Xunit;

namespace FGV.Dashboard.Application.Tests;

public class SecurityCalculatorTests
{
    private static EndpointAsset Asset(
        string id = "EP-1",
        string? ip = "10.0.0.1",
        ProtectionStatus defender = ProtectionStatus.Protected,
        ProtectionStatus kaspersky = ProtectionStatus.Protected,
        RiskLevel trend = RiskLevel.Low,
        int applicable = 100,
        int installed = 100,
        bool config = true) =>
        new(id, $"HOST-{id}", ip, defender, kaspersky, trend, applicable, installed,
            new EndpointConfig(config, config, config, config));

    [Fact]
    public void Healthy_endpoint_is_protected() =>
        Assert.Equal(OverallStatus.Protected, SecurityCalculator.ComputeOverall(Asset()));

    [Fact]
    public void Offline_defender_makes_endpoint_offline() =>
        Assert.Equal(OverallStatus.Offline,
            SecurityCalculator.ComputeOverall(Asset(defender: ProtectionStatus.Offline)));

    [Fact]
    public void Critical_trend_risk_makes_endpoint_critical() =>
        Assert.Equal(OverallStatus.Critical,
            SecurityCalculator.ComputeOverall(Asset(trend: RiskLevel.Critical)));

    [Fact]
    public void One_risk_signal_needs_attention() =>
        Assert.Equal(OverallStatus.AttentionRequired,
            SecurityCalculator.ComputeOverall(Asset(kaspersky: ProtectionStatus.AtRisk)));

    [Theory]
    [InlineData(100, 90, PatchState.Compliant)]
    [InlineData(100, 89, PatchState.NonCompliant)]
    [InlineData(0, 0, PatchState.Unknown)]
    public void Patch_state_follows_the_90_percent_rule(int applicable, int installed, PatchState expected) =>
        Assert.Equal(expected, Asset(applicable: applicable, installed: installed).Patch);

    [Fact]
    public void Sccm_excludes_out_of_coverage_devices_from_the_denominator()
    {
        var fleet = new[]
        {
            Asset("A", "10.0.0.1"),
            Asset("B", "10.0.0.2"),
            Asset("C", "10.0.0.3", installed: 50),
            Asset("D", "192.168.1.5", installed: 50),
        };

        var summary = SecurityCalculator.Sccm(fleet);

        Assert.Equal(4, summary.Total);
        Assert.Equal(2, summary.Compliant);
        Assert.Equal(1, summary.OutOfCoverage);
        Assert.Equal(3, summary.Within);
        Assert.Equal(2.0 / 3 * 100, summary.CompliancePct!.Value, 5);
    }

    [Fact]
    public void Fleet_hardening_score_is_the_share_of_passed_checks()
    {
        // A passes 8 of 8. B passes 4 of 8 (all four config checks fail). 12 / 16 = 75.
        var fleet = new[] { Asset("A", config: true), Asset("B", config: false) };

        Assert.Equal(75, SecurityCalculator.FleetHardeningScore(fleet));
    }

    private static Vulnerability Vuln(
    string id,
    DateTimeOffset detected,
    Severity severity = Severity.High,
    SecurityTool source = SecurityTool.Defender,
    bool resolved = false) =>
    new(id, "EP-1", severity, source, resolved, detected);

    [Fact]
    public void Weekly_trend_has_eight_monday_based_weeks_ending_at_the_latest_detection()
    {
        // 2026-10-21 is a Wednesday, so the latest week starts on Monday 2026-10-19.
        var vulns = new[]
        {
            Vuln("V1", new DateTimeOffset(2026, 10, 21, 9, 0, 0, TimeSpan.Zero)),
            Vuln("V2", new DateTimeOffset(2026, 10, 19, 0, 0, 0, TimeSpan.Zero)),
            Vuln("V3", new DateTimeOffset(2026, 10, 12, 23, 59, 0, TimeSpan.Zero)),
        };

        var trend = SecurityCalculator.WeeklyVulnerabilityTrend(vulns, DateTimeOffset.UnixEpoch);

        Assert.Equal(8, trend.Count);
        Assert.Equal(new DateOnly(2026, 10, 19), trend[^1].WeekStart);
        Assert.Equal(2, trend[^1].Count);
        Assert.Equal(1, trend[^2].Count);
    }

    [Fact]
    public void Tool_summary_counts_affected_endpoints_and_open_findings()
    {
        var fleet = new[]
        {
            Asset("A"),
            Asset("B", defender: ProtectionStatus.AtRisk),
            Asset("C", defender: ProtectionStatus.Offline),
        };
        var open = new[]
        {
            Vuln("V1", DateTimeOffset.UnixEpoch),
            Vuln("V2", DateTimeOffset.UnixEpoch, source: SecurityTool.Sccm),
        };

        var summary = SecurityCalculator.SummarizeTool(SecurityTool.Defender, fleet, open);

        Assert.Equal(2, summary.Affected);
        Assert.Equal(1, summary.Healthy);
        Assert.Equal(1, summary.OpenFindings);
        Assert.Equal(1, summary.StatusCounts["offline"]);
    }
}
