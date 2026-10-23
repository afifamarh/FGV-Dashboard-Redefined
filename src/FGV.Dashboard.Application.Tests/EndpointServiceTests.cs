using FGV.Dashboard.Application.Endpoints;
using FGV.Dashboard.Application.Security;
using Xunit;

namespace FGV.Dashboard.Application.Tests;

public class EndpointServiceTests
{
    private sealed class FakeSource(IReadOnlyList<EndpointAsset> endpoints) : ISecurityDataSource
    {
        public Task<IReadOnlyList<EndpointAsset>> GetEndpointsAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(endpoints);

        public Task<IReadOnlyList<Vulnerability>> GetVulnerabilitiesAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<Vulnerability>>(Array.Empty<Vulnerability>());
    }

    private static EndpointAsset Asset(
        string id,
        string hostname,
        ProtectionStatus defender = ProtectionStatus.Protected) =>
        new(id, hostname, "10.0.0.1", defender, ProtectionStatus.Protected, RiskLevel.Low, 100, 100,
            new EndpointConfig(true, true, true, true), "Windows 11 Pro", "HQ");

    private static EndpointService ServiceWith(params EndpointAsset[] assets) => new(new FakeSource(assets));

    [Fact]
    public async Task Filters_by_defender_status()
    {
        var service = ServiceWith(Asset("1", "PC-A"), Asset("2", "PC-B", ProtectionStatus.Offline));

        var result = await service.QueryAsync(new EndpointQuery(Defender: ProtectionStatus.Offline));

        Assert.Equal(1, result.TotalCount);
        Assert.Equal("PC-B", result.Items[0].Hostname);
    }

    [Fact]
    public async Task Search_is_case_insensitive()
    {
        var service = ServiceWith(Asset("1", "SAMPLE-PC-0001"), Asset("2", "LAB-02"));

        var result = await service.QueryAsync(new EndpointQuery(Search: "sample"));

        Assert.Equal(new[] { "SAMPLE-PC-0001" }, result.Items.Select(i => i.Hostname));
    }

    [Fact]
    public async Task Paging_returns_the_requested_slice_and_total_count()
    {
        var assets = Enumerable.Range(1, 30).Select(i => Asset(i.ToString(), $"PC-{i:D2}")).ToArray();

        var result = await ServiceWith(assets).QueryAsync(new EndpointQuery(Page: 2, PageSize: 10));

        Assert.Equal(30, result.TotalCount);
        Assert.Equal(3, result.TotalPages);
        Assert.Equal(10, result.Items.Count);
        Assert.Equal("PC-11", result.Items[0].Hostname);
    }

    [Fact]
    public async Task Sorts_by_hostname_descending()
    {
        var service = ServiceWith(Asset("1", "PC-A"), Asset("2", "PC-C"), Asset("3", "PC-B"));

        var result = await service.QueryAsync(new EndpointQuery(Descending: true));

        Assert.Equal(new[] { "PC-C", "PC-B", "PC-A" }, result.Items.Select(i => i.Hostname));
    }

    [Fact]
    public async Task Page_size_is_capped_at_100()
    {
        var assets = Enumerable.Range(1, 150).Select(i => Asset(i.ToString(), $"PC-{i:D3}")).ToArray();

        var result = await ServiceWith(assets).QueryAsync(new EndpointQuery(PageSize: 5000));

        Assert.Equal(100, result.PageSize);
        Assert.Equal(100, result.Items.Count);
    }
}