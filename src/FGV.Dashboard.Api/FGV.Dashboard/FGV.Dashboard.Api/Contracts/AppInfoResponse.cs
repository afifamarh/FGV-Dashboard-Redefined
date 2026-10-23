namespace FGV.Dashboard.Api.Contracts
{
    public sealed record AppInfoResponse(
        string Name,
        string Version,
        string Environment,
        DateTimeOffset ServerTimeUtc);
}
