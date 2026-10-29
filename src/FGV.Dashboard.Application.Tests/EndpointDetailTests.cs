using System;
using System.Collections.Generic;
using System.Text;
using FGV.Dashboard.Application.Endpoints;
using FGV.Dashboard.Application.Security;
using Xunit;

namespace FGV.Dashboard.Application.Tests;

public class EndpointDetailTests
{
    private sealed class FakeSource(
        IReadOnlyList<EndpointAsset> endpoints,
        IReadOnlyList<Vulnerability> vulnerabilities) : ISecurityDataSource
    {
        public Task<IReadOnlyList<EndpointAsset>> GetEndpointsAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(endpoints);

        public Task<IReadOnlyList<Vulnerability>> GetVulnerabilitiesAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(vulnerabilities);
    }

    private static EndpointAsset Asset(
        string id,
        bool config = true,
        ProtectionStatus defender = ProtectionStatus.Protected) =>
        new(id, $"HOST-{id}", "10.0.0.1", defender, ProtectionStatus.Protected, RiskLevel.Low, 100, 100,
            new EndpointConfig(config, config, config, config), "Windows 11 Pro", "HQ");

    private static Vulnerability Vuln(string id, string endpointId, Severity severity, bool resolved = false) =>
                new(id, endpointId, severity, SecurityTool.Defender, resolved ? VulnerabilityStatus.Resolved : VulnerabilityStatus.Open, DateTimeOffset.UnixEpoch);

    private static EndpointService ServiceWith(EndpointAsset[] assets, params Vulnerability[] vulns) =>
        new(new FakeSource(assets, vulns));

    [Fact]
    public async Task Unknown_id_returns_null()
    {
        var detail = await ServiceWith([Asset("EP-1")]).GetDetailAsync("EP-404");

        Assert.Null(detail);
    }

    [Fact]
    public async Task Detail_reports_failing_controls_and_hardening_score()
    {
        // All four configuration checks fail, the four tool-based checks pass: 4 of 8 = 50.
        var detail = await ServiceWith([Asset("EP-1", config: false)]).GetDetailAsync("EP-1");

        Assert.NotNull(detail);
        Assert.Equal(4, detail.PassedControls);
        Assert.Equal(50, detail.HardeningScore);
        Assert.Equal(4, detail.Controls.Count(c => !c.Passed));
    }

    [Fact]
    public async Task Detail_lists_only_open_findings_most_severe_first()
    {
        var vulns = new[]
        {
            Vuln("V1", "EP-1", Severity.Low),
            Vuln("V2", "EP-1", Severity.Critical),
            Vuln("V3", "EP-1", Severity.High, resolved: true),
            Vuln("V4", "EP-2", Severity.Critical),
        };

        var detail = await ServiceWith([Asset("EP-1"), Asset("EP-2")], vulns).GetDetailAsync("EP-1");

        Assert.NotNull(detail);
        Assert.Equal(new[] { "V2", "V1" }, detail.OpenFindings.Select(f => f.Id));
    }

    [Fact]
    public async Task Offline_endpoint_recommends_reconnecting()
    {
        var detail = await ServiceWith([Asset("EP-1", defender: ProtectionStatus.Offline)]).GetDetailAsync("EP-1");

        Assert.NotNull(detail);
        Assert.Equal(RecommendedAction.ReconnectAndVerify, detail.RecommendedAction);
    }
}
