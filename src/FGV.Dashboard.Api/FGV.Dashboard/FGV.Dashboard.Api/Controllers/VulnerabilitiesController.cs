using FGV.Dashboard.Api.Contracts;
using FGV.Dashboard.Application.Endpoints;
using FGV.Dashboard.Application.Vulnerabilities;
using Microsoft.AspNetCore.Mvc;

namespace FGV.Dashboard.Api.Controllers;

[ApiController]
[Route("api/v1/vulnerabilities")]
public sealed class VulnerabilitiesController : ControllerBase
{
    private readonly VulnerabilityService _service;

    public VulnerabilitiesController(VulnerabilityService service) => _service = service;

    [HttpGet]
    [ProducesResponseType<PagedResult<VulnerabilityListItem>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<PagedResult<VulnerabilityListItem>>> List(
        [FromQuery] VulnerabilityListRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _service.QueryAsync(request.ToQuery(), cancellationToken);
        return result;
    }

    [HttpGet("summary")]
    [ProducesResponseType<VulnerabilitySummary>(StatusCodes.Status200OK)]
    public async Task<ActionResult<VulnerabilitySummary>> GetSummary(CancellationToken cancellationToken)
    {
        var summary = await _service.GetSummaryAsync(cancellationToken);
        return summary;
    }
}