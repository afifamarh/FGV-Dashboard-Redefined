using System;
using System.Collections.Generic;
using System.Text;

namespace FGV.Dashboard.Application.Security
{
    public enum ProtectionStatus { Unknown, Protected, AtRisk, Offline }
    public enum PatchState { Unknown, Compliant, NonCompliant }
    public enum RiskLevel { Unknown, Low, Medium, High, Critical }
    public enum Severity { Critical, High, Medium, Low }
    public enum OverallStatus { Unknown, Protected, AttentionRequired, Critical, Offline }
}
