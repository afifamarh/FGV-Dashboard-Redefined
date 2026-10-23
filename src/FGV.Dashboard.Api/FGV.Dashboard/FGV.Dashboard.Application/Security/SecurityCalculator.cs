using System;
using System.Collections.Generic;
using System.Text;
using FGV.Dashboard.Application.Security;

namespace FGV.Dashboard.Application.Security
{
    public static class SecurityPolicy
    {
        // Prototype rules carried over from the old dashboard, pending confirmation with your supervisor.
        public const int PatchSlaPercent = 90;
        public const int SccmTargetPercent = 80;

        public static int? PatchPercent(int applicable, int installed)
        {
            if (applicable <= 0) return null;
            var clamped = Math.Min(applicable, Math.Max(0, installed));
            return (int)Math.Round(clamped * 100.0 / applicable, MidpointRounding.AwayFromZero);
        }

        public static PatchState EvaluatePatch(int applicable, int installed) =>
            PatchPercent(applicable, installed) switch
            {
                null => PatchState.Unknown,
                >= PatchSlaPercent => PatchState.Compliant,
                _ => PatchState.NonCompliant,
            };
    }

    public static class SecurityCalculator
    {
        public const int HardeningControlCount = 8;

        public static OverallStatus ComputeOverall(EndpointAsset e)
        {
            var known = e.Defender != ProtectionStatus.Unknown
                     || e.Patch != PatchState.Unknown
                     || e.Kaspersky != ProtectionStatus.Unknown
                     || e.TrendMicro != RiskLevel.Unknown;
            if (!known) return OverallStatus.Unknown;
            if (e.Defender == ProtectionStatus.Offline) return OverallStatus.Offline;

            var risks = 0;
            if (e.Defender == ProtectionStatus.AtRisk) risks++;
            if (e.Patch == PatchState.NonCompliant) risks++;
            if (e.Kaspersky == ProtectionStatus.AtRisk) risks++;
            if (e.TrendMicro is RiskLevel.High or RiskLevel.Critical) risks++;

            if (e.TrendMicro == RiskLevel.Critical || risks >= 3) return OverallStatus.Critical;
            return risks >= 1 ? OverallStatus.AttentionRequired : OverallStatus.Protected;
        }

        public static int PassedControls(EndpointAsset e)
        {
            var passed = 0;
            if (e.Patch == PatchState.Compliant) passed++;
            if (e.Kaspersky == ProtectionStatus.Protected) passed++;
            if (e.Defender == ProtectionStatus.Protected) passed++;
            if (e.TrendMicro is RiskLevel.Low or RiskLevel.Medium) passed++;
            if (e.Config.Firewall) passed++;
            if (e.Config.DiskEncryption) passed++;
            if (e.Config.UsbControl) passed++;
            if (e.Config.PasswordPolicy) passed++;
            return passed;
        }

        public static int FleetHardeningScore(IReadOnlyCollection<EndpointAsset> fleet)
        {
            if (fleet.Count == 0) return 0;
            var passed = fleet.Sum(PassedControls);
            return (int)Math.Round(
                passed * 100.0 / (fleet.Count * HardeningControlCount),
                MidpointRounding.AwayFromZero);
        }

        // Prototype rule from the old app: 192.168.x.x and public addresses are outside SCCM coverage.
        private static bool IsOutsideCorporateRange(string? ip)
        {
            if (string.IsNullOrWhiteSpace(ip)) return false;
            var parts = ip.Trim().Split('.');
            if (parts.Length != 4 || !parts.All(p => byte.TryParse(p, out _))) return false;

            var a = int.Parse(parts[0]);
            var b = int.Parse(parts[1]);
            if (a == 192 && b == 168) return true;

            var isPrivate = a == 10
                         || (a == 172 && b is >= 16 and <= 31)
                         || a == 127
                         || (a == 169 && b == 254);
            return !isPrivate;
        }

        public static SccmSummary Sccm(IReadOnlyCollection<EndpointAsset> fleet)
        {
            var total = fleet.Count;
            var compliant = fleet.Count(e => e.Patch == PatchState.Compliant);
            var nonCompliant = fleet.Count(e => e.Patch == PatchState.NonCompliant);
            var unknown = fleet.Count(e => e.Patch == PatchState.Unknown);
            var outOfCoverage = fleet.Count(e =>
                e.Patch != PatchState.Compliant && IsOutsideCorporateRange(e.IpAddress));

            var within = total - outOfCoverage;
            var problemToResolve = (total - compliant) - outOfCoverage;
            var hasEvidence = fleet.Any(e => e.PatchApplicable > 0);
            double? pct = hasEvidence && within > 0 ? compliant * 100.0 / within : null;

            return new SccmSummary(
                total, compliant, nonCompliant, unknown, outOfCoverage, within,
                problemToResolve, pct, SecurityPolicy.SccmTargetPercent,
                pct >= SecurityPolicy.SccmTargetPercent);
        }

        public static SeverityCounts CountBySeverity(IEnumerable<Vulnerability> vulnerabilities)
        {
            var list = vulnerabilities.ToList();
            return new SeverityCounts(
                list.Count(v => v.Severity == Severity.Critical),
                list.Count(v => v.Severity == Severity.High),
                list.Count(v => v.Severity == Severity.Medium),
                list.Count(v => v.Severity == Severity.Low));
        }

        // Prototype definition kept from the old app: healthy = total endpoints - affected endpoints.
        public static ToolSummary SummarizeTool(
            SecurityTool tool,
            IReadOnlyCollection<EndpointAsset> fleet,
            IReadOnlyCollection<Vulnerability> openVulnerabilities)
        {
            var openFindings = openVulnerabilities.Count(v => v.Source == tool);

            int Count(Func<EndpointAsset, bool> predicate) => fleet.Count(predicate);

            ToolSummary Build(string key, string name, int affected, Dictionary<string, int> counts) =>
                new(key, name, fleet.Count - affected, affected, openFindings, counts);

            return tool switch
            {
                SecurityTool.Defender => Build("defender", "Microsoft Defender",
                    Count(e => e.Defender is ProtectionStatus.AtRisk or ProtectionStatus.Offline),
                    new()
                    {
                        ["protected"] = Count(e => e.Defender == ProtectionStatus.Protected),
                        ["atRisk"] = Count(e => e.Defender == ProtectionStatus.AtRisk),
                        ["offline"] = Count(e => e.Defender == ProtectionStatus.Offline),
                    }),
                SecurityTool.Sccm => Build("sccm", "SCCM",
                    Count(e => e.Patch == PatchState.NonCompliant),
                    new()
                    {
                        ["compliant"] = Count(e => e.Patch == PatchState.Compliant),
                        ["nonCompliant"] = Count(e => e.Patch == PatchState.NonCompliant),
                        ["unknown"] = Count(e => e.Patch == PatchState.Unknown),
                    }),
                SecurityTool.Kaspersky => Build("kaspersky", "Kaspersky",
                    Count(e => e.Kaspersky == ProtectionStatus.AtRisk),
                    new()
                    {
                        ["protected"] = Count(e => e.Kaspersky == ProtectionStatus.Protected),
                        ["atRisk"] = Count(e => e.Kaspersky == ProtectionStatus.AtRisk),
                    }),
                SecurityTool.TrendMicro => Build("trendmicro", "Trend Micro Vision One",
                    Count(e => e.TrendMicro is RiskLevel.High or RiskLevel.Critical),
                    new()
                    {
                        ["lowOrMediumRisk"] = Count(e => e.TrendMicro is RiskLevel.Low or RiskLevel.Medium),
                        ["highOrCriticalRisk"] = Count(e => e.TrendMicro is RiskLevel.High or RiskLevel.Critical),
                    }),
                _ => throw new ArgumentOutOfRangeException(nameof(tool)),
            };
        }

        // New vulnerabilities per Monday-based week, for the 8 weeks ending with the latest detection.
        public static IReadOnlyList<WeeklyCount> WeeklyVulnerabilityTrend(
            IReadOnlyCollection<Vulnerability> vulnerabilities,
            DateTimeOffset fallbackNow,
            int weeks = 8)
        {
            var latest = vulnerabilities.Count > 0
                ? vulnerabilities.Max(v => v.DetectedUtc)
                : fallbackNow;
            var latestDate = DateOnly.FromDateTime(latest.UtcDateTime);
            var lastWeekStart = latestDate.AddDays(-(((int)latestDate.DayOfWeek + 6) % 7));

            var result = new List<WeeklyCount>();
            for (var i = weeks - 1; i >= 0; i--)
            {
                var start = lastWeekStart.AddDays(-7 * i);
                var end = start.AddDays(7);
                var count = vulnerabilities.Count(v =>
                {
                    var detected = DateOnly.FromDateTime(v.DetectedUtc.UtcDateTime);
                    return detected >= start && detected < end;
                });
                result.Add(new WeeklyCount(start, count));
            }
            return result;
        }
    }
}
