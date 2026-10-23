using System;
using System.Collections.Generic;
using System.Text;
using FGV.Dashboard.Application.Security;

namespace FGV.Dashboard.Application.Dashboard;

public sealed class DashboardService
{
    private readonly ISecurityDataSource _source;
    private readonly TimeProvider _time;

    public DashboardService(ISecurityDataSource source, TimeProvider time)
    {
        _source = source;
        _time = time;
    }

    public async Task<DashboardSummary> GetSummaryAsync(CancellationToken cancellationToken = default)
    {
        var endpoints = await _source.GetEndpointsAsync(cancellationToken);
        var vulnerabilities = await _source.GetVulnerabilitiesAsync(cancellationToken);
        var now = _time.GetUtcNow();

        var overall = endpoints.Select(SecurityCalculator.ComputeOverall).ToList();
        int Count(OverallStatus status) => overall.Count(o => o == status);

        var open = vulnerabilities.Where(v => !v.IsResolved).ToList();
        var resolved = vulnerabilities.Where(v => v.IsResolved).ToList();
        var endpointsWithOpenFindings = open.Select(v => v.EndpointId).ToHashSet();

        var tools = Enum.GetValues<SecurityTool>()
            .Select(tool => SecurityCalculator.SummarizeTool(tool, endpoints, open))
            .ToList();

        return new DashboardSummary(
            endpoints.Count,
            new OverallCounts(
                Count(OverallStatus.Protected),
                Count(OverallStatus.AttentionRequired),
                Count(OverallStatus.Critical),
                Count(OverallStatus.Offline),
                Count(OverallStatus.Unknown)),
            endpoints.Count(e => endpointsWithOpenFindings.Contains(e.Id)),
            open.Count,
            open.Count(v => v.Severity == Severity.Critical),
            endpoints.Count(e => e.Patch == PatchState.NonCompliant),
            endpoints.Sum(e => e.MissingUpdates),
            SecurityCalculator.Sccm(endpoints),
            SecurityCalculator.FleetHardeningScore(endpoints),
            SecurityCalculator.CountBySeverity(open),
            SecurityCalculator.CountBySeverity(resolved),
            tools,
            SecurityCalculator.WeeklyVulnerabilityTrend(vulnerabilities.ToList(), now),
            now);
    }
}
