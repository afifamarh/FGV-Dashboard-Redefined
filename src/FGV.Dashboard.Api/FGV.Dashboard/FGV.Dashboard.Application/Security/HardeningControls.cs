using System;
using System.Collections.Generic;
using System.Text;

namespace FGV.Dashboard.Application.Security;

public sealed record HardeningControl(
    string Key,
    string Name,
    string Source,
    Func<EndpointAsset, bool> Check);

public static class HardeningControls
{
    // Prototype checklist carried over from the old app; not confirmed FGV requirements.
    public static IReadOnlyList<HardeningControl> All { get; } =
    [
        new("patch", "Security updates installed", "SCCM",
            e => e.Patch == PatchState.Compliant),
        new("antivirus", "Antivirus real-time protection", "Kaspersky",
            e => e.Kaspersky == ProtectionStatus.Protected),
        new("defender", "Microsoft Defender protection", "Microsoft Defender",
            e => e.Defender == ProtectionStatus.Protected),
        new("edr", "EDR / XDR risk level", "Trend Micro Vision One",
            e => e.TrendMicro is RiskLevel.Low or RiskLevel.Medium),
        new("firewall", "Host firewall enabled", "Endpoint configuration",
            e => e.Config.Firewall),
        new("diskEncryption", "Full-disk encryption", "Endpoint configuration",
            e => e.Config.DiskEncryption),
        new("usbControl", "Removable media control", "Endpoint configuration",
            e => e.Config.UsbControl),
        new("passwordPolicy", "Password & screen-lock policy", "Endpoint configuration",
            e => e.Config.PasswordPolicy),
    ];
}