using System;
using System.Collections.Generic;
using System.Text;
using FGV.Dashboard.Application.Security;

namespace FGV.Dashboard.Application.Dashboard;

public sealed record OverallCounts(int Protected, int AttentionRequired, int Critical, int Offline, int Unknown);

public sealed record DashboardSummary(
    int TotalEndpoints,
    OverallCounts Overall,
    int VulnerableEndpoints,
    int OpenVulnerabilities,
    int OpenCriticalVulnerabilities,
    int NonCompliantEndpoints,
    int MissingUpdates,
    SccmSummary Sccm,
    int HardeningScore,
    DateTimeOffset GeneratedUtc);