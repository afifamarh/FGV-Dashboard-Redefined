using System;
using System.Collections.Generic;
using System.Text;

namespace FGV.Dashboard.Application.Security;

public sealed record EndpointConfig(
    bool Firewall,
    bool DiskEncryption,
    bool UsbControl,
    bool PasswordPolicy);

// Named EndpointAsset to avoid clashing with ASP.NET Core's Endpoint type.
public sealed record EndpointAsset(
    string Id,
    string Hostname,
    string? IpAddress,
    ProtectionStatus Defender,
    ProtectionStatus Kaspersky,
    RiskLevel TrendMicro,
    int PatchApplicable,
    int PatchInstalled,
    EndpointConfig Config,
    string? OperatingSystem = null,
    string? Location = null)
{
    public PatchState Patch => SecurityPolicy.EvaluatePatch(PatchApplicable, PatchInstalled);
    public int MissingUpdates => Math.Max(0, PatchApplicable - PatchInstalled);
}

public sealed record Vulnerability(
    string Id,
    string EndpointId,
    Severity Severity,
    SecurityTool Source,
    VulnerabilityStatus Status,
    DateTimeOffset DetectedUtc,
    string Description = "")
{
    public bool IsResolved => Status == VulnerabilityStatus.Resolved;
}

public sealed record SccmSummary(
    int Total,
    int Compliant,
    int NonCompliant,
    int Unknown,
    int OutOfCoverage,
    int Within,
    int ProblemToResolve,
    double? CompliancePct,
    int TargetPct,
    bool MeetsTarget);

public sealed record SeverityCounts(int Critical, int High, int Medium, int Low);

public sealed record ToolSummary(
    string Key,
    string Name,
    int Healthy,
    int Affected,
    int OpenFindings,
    IReadOnlyDictionary<string, int> StatusCounts);

public sealed record WeeklyCount(DateOnly WeekStart, int Count);