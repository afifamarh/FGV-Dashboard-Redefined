using System;
using System.Collections.Generic;
using System.Text;
using FGV.Dashboard.Application.Security;

namespace FGV.Dashboard.Application.Endpoints;

public enum EndpointSortField
{
    Hostname,
    Overall,
    Defender,
    Patch,
    Kaspersky,
    TrendMicro,
    PatchCompliance,
    MissingUpdates,
}

public sealed record EndpointQuery(
    string? Search = null,
    OverallStatus? Overall = null,
    ProtectionStatus? Defender = null,
    PatchState? Patch = null,
    ProtectionStatus? Kaspersky = null,
    RiskLevel? TrendMicro = null,
    EndpointSortField SortBy = EndpointSortField.Hostname,
    bool Descending = false,
    int Page = 1,
    int PageSize = 25);

public sealed record EndpointListItem(
    string Id,
    string Hostname,
    string? IpAddress,
    string? OperatingSystem,
    string? Location,
    OverallStatus Overall,
    ProtectionStatus Defender,
    PatchState Patch,
    ProtectionStatus Kaspersky,
    RiskLevel TrendMicro,
    int? PatchCompliancePct,
    int MissingUpdates);

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount)
{
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
}

public sealed record ControlResult(string Key, string Name, string Source, bool Passed);

public sealed record OpenFinding(string Id, Severity Severity, SecurityTool Source, DateTimeOffset DetectedUtc);

public sealed record EndpointDetail(
    EndpointListItem Summary,
    int PatchApplicable,
    int PatchInstalled,
    int HardeningScore,
    int PassedControls,
    RecommendedAction RecommendedAction,
    IReadOnlyList<ControlResult> Controls,
    IReadOnlyList<OpenFinding> OpenFindings);
