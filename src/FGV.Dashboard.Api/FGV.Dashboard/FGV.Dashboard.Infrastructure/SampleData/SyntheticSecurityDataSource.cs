using System;
using System.Collections.Generic;
using System.Text;
using FGV.Dashboard.Application.Security;

namespace FGV.Dashboard.Infrastructure.SampleData;

/// <summary>Deterministic, fictional data for development. Contains no real FGV records.</summary>
public sealed class SyntheticSecurityDataSource : ISecurityDataSource
{
    private readonly IReadOnlyList<EndpointAsset> _endpoints;
    private readonly IReadOnlyList<Vulnerability> _vulnerabilities;

    public SyntheticSecurityDataSource(TimeProvider time)
    {
        var rng = new Random(20260101);
        var now = time.GetUtcNow();
        var endpoints = new List<EndpointAsset>();
        var vulnerabilities = new List<Vulnerability>();

        for (var i = 1; i <= 120; i++)
        {
            var id = $"EP-{i:D4}";
            var applicable = rng.Next(20, 61);
            var installed = (int)Math.Round(applicable * (0.6 + rng.NextDouble() * 0.4));

            endpoints.Add(new EndpointAsset(
                id,
                $"SAMPLE-PC-{i:D4}",
                NextIp(rng),
                Pick(rng, (ProtectionStatus.Protected, 80), (ProtectionStatus.AtRisk, 12), (ProtectionStatus.Offline, 8)),
                Pick(rng, (ProtectionStatus.Protected, 88), (ProtectionStatus.AtRisk, 12)),
                Pick(rng, (RiskLevel.Low, 55), (RiskLevel.Medium, 30), (RiskLevel.High, 11), (RiskLevel.Critical, 4)),
                applicable,
                installed,
                new EndpointConfig(Chance(rng, 92), Chance(rng, 85), Chance(rng, 80), Chance(rng, 90))));

            var findings = Chance(rng, 55) ? rng.Next(1, 4) : 0;
            for (var v = 1; v <= findings; v++)
            {
                vulnerabilities.Add(new Vulnerability(
                    $"VULN-{i:D4}-{v}",
                    id,
                    Pick(rng, (Severity.Critical, 8), (Severity.High, 27), (Severity.Medium, 45), (Severity.Low, 20)),
                    Chance(rng, 40),
                    now.AddDays(-rng.Next(0, 56))));
            }
        }

        _endpoints = endpoints;
        _vulnerabilities = vulnerabilities;
    }

    public Task<IReadOnlyList<EndpointAsset>> GetEndpointsAsync(CancellationToken cancellationToken = default)
        => Task.FromResult(_endpoints);

    public Task<IReadOnlyList<Vulnerability>> GetVulnerabilitiesAsync(CancellationToken cancellationToken = default)
        => Task.FromResult(_vulnerabilities);

    private static bool Chance(Random rng, int percent) => rng.Next(100) < percent;

    private static T Pick<T>(Random rng, params (T Value, int Weight)[] options)
    {
        var roll = rng.Next(options.Sum(o => o.Weight));
        foreach (var (value, weight) in options)
        {
            if (roll < weight) return value;
            roll -= weight;
        }
        return options[^1].Value;
    }

    private static string NextIp(Random rng)
    {
        var roll = rng.Next(100);
        if (roll < 70) return $"10.{rng.Next(1, 255)}.{rng.Next(0, 255)}.{rng.Next(1, 255)}";
        if (roll < 85) return $"172.16.{rng.Next(0, 255)}.{rng.Next(1, 255)}";
        if (roll < 95) return $"192.168.{rng.Next(0, 255)}.{rng.Next(1, 255)}";
        return $"203.0.113.{rng.Next(1, 255)}";
    }
}