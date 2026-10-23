using System;
using System.Collections.Generic;
using System.Text;

namespace FGV.Dashboard.Application.Security;

public interface ISecurityDataSource
{
    Task<IReadOnlyList<EndpointAsset>> GetEndpointsAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Vulnerability>> GetVulnerabilitiesAsync(CancellationToken cancellationToken = default);
}
