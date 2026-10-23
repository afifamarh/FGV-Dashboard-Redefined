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

        public static PatchState EvaluatePatch(int applicable, int installed)
        {
            if (applicable <= 0) return PatchState.Unknown;
            var clamped = Math.Min(applicable, Math.Max(0, installed));
            var percent = Math.Round(clamped * 100.0 / applicable, MidpointRounding.AwayFromZero);
            return percent >= PatchSlaPercent ? PatchState.Compliant : PatchState.NonCompliant;
        }
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
    }
}
