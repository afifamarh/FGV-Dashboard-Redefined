using System.ComponentModel.DataAnnotations;
using FGV.Dashboard.Application.Endpoints;
using FGV.Dashboard.Application.Security;

namespace FGV.Dashboard.Api.Contracts;

public sealed class EndpointListRequest
{
    [StringLength(100)]
    public string? Search { get; set; }

    public OverallStatus? Overall { get; set; }
    public ProtectionStatus? Defender { get; set; }
    public PatchState? Patch { get; set; }
    public ProtectionStatus? Kaspersky { get; set; }
    public RiskLevel? TrendMicro { get; set; }

    public EndpointSortField SortBy { get; set; } = EndpointSortField.Hostname;
    public bool Descending { get; set; }

    [Range(1, 10_000)]
    public int Page { get; set; } = 1;

    [Range(1, 100)]
    public int PageSize { get; set; } = 25;

    public EndpointQuery ToQuery() =>
        new(Search, Overall, Defender, Patch, Kaspersky, TrendMicro, SortBy, Descending, Page, PageSize);


}
