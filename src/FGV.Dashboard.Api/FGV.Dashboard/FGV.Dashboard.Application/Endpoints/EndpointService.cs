using System;
using System.Collections.Generic;
using System.Text;
using FGV.Dashboard.Application.Security;

namespace FGV.Dashboard.Application.Endpoints;

public sealed class EndpointService
{
    private const int MaxPageSize = 100;

    private readonly record struct Row(EndpointAsset Asset, OverallStatus Overall);

    private readonly ISecurityDataSource _source;

    public EndpointService(ISecurityDataSource source) => _source = source;

    public async Task<PagedResult<EndpointListItem>> QueryAsync(
        EndpointQuery query,
        CancellationToken cancellationToken = default)
    {
        var endpoints = await _source.GetEndpointsAsync(cancellationToken);

        var rows = endpoints
            .Select(e => new Row(e, SecurityCalculator.ComputeOverall(e)))
            .Where(r => Matches(r, query));

        var sorted = ApplySort(rows, query).ToList();

        var pageSize = Math.Clamp(query.PageSize, 1, MaxPageSize);
        var page = Math.Max(1, query.Page);
        var items = sorted
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(ToItem)
            .ToList();

        return new PagedResult<EndpointListItem>(items, page, pageSize, sorted.Count);
    }

    private static bool Matches(Row row, EndpointQuery q)
    {
        var e = row.Asset;
        if (q.Overall is { } overall && row.Overall != overall) return false;
        if (q.Defender is { } defender && e.Defender != defender) return false;
        if (q.Patch is { } patch && e.Patch != patch) return false;
        if (q.Kaspersky is { } kaspersky && e.Kaspersky != kaspersky) return false;
        if (q.TrendMicro is { } trend && e.TrendMicro != trend) return false;

        if (string.IsNullOrWhiteSpace(q.Search)) return true;
        var term = q.Search.Trim();
        return Contains(e.Id, term) || Contains(e.Hostname, term) || Contains(e.IpAddress, term)
            || Contains(e.OperatingSystem, term) || Contains(e.Location, term);
    }

    private static bool Contains(string? value, string term) =>
        value is not null && value.Contains(term, StringComparison.OrdinalIgnoreCase);

    private static IOrderedEnumerable<Row> Order<TKey>(
        IEnumerable<Row> rows,
        Func<Row, TKey> key,
        bool descending,
        IComparer<TKey>? comparer = null) =>
        descending ? rows.OrderByDescending(key, comparer) : rows.OrderBy(key, comparer);

    // Enum columns sort by their declared order (for Overall: roughly increasing severity).
    private static IEnumerable<Row> ApplySort(IEnumerable<Row> rows, EndpointQuery q)
    {
        var ordered = q.SortBy switch
        {
            EndpointSortField.Overall => Order(rows, r => r.Overall, q.Descending),
            EndpointSortField.Defender => Order(rows, r => r.Asset.Defender, q.Descending),
            EndpointSortField.Patch => Order(rows, r => r.Asset.Patch, q.Descending),
            EndpointSortField.Kaspersky => Order(rows, r => r.Asset.Kaspersky, q.Descending),
            EndpointSortField.TrendMicro => Order(rows, r => r.Asset.TrendMicro, q.Descending),
            EndpointSortField.MissingUpdates => Order(rows, r => r.Asset.MissingUpdates, q.Descending),
            EndpointSortField.PatchCompliance => Order(rows,
                r => SecurityPolicy.PatchPercent(r.Asset.PatchApplicable, r.Asset.PatchInstalled) ?? -1,
                q.Descending),
            _ => Order(rows, r => r.Asset.Hostname, q.Descending, StringComparer.OrdinalIgnoreCase),
        };

        // Stable tie-break so paging never shows the same row twice.
        return ordered.ThenBy(r => r.Asset.Id, StringComparer.Ordinal);
    }

    private static EndpointListItem ToItem(Row row)
    {
        var e = row.Asset;
        return new EndpointListItem(
            e.Id, e.Hostname, e.IpAddress, e.OperatingSystem, e.Location,
            row.Overall, e.Defender, e.Patch, e.Kaspersky, e.TrendMicro,
            SecurityPolicy.PatchPercent(e.PatchApplicable, e.PatchInstalled),
            e.MissingUpdates);
    }
}
