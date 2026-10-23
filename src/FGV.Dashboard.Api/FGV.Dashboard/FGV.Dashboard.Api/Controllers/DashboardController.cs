using FGV.Dashboard.Application.Dashboard;
using Microsoft.AspNetCore.Mvc;

namespace FGV.Dashboard.Api.Controllers;

[ApiController]
[Route("api/v1/dashboard")]
public sealed class DashboardController : ControllerBase
{
    private readonly DashboardService _service;

    public DashboardController(DashboardService service) => _service = service;

    [HttpGet("summary")]
    [ProducesResponseType<DashboardSummary>(StatusCodes.Status200OK)]
    public async Task<ActionResult<DashboardSummary>> GetSummary(CancellationToken cancellationToken)
    {
        var summary = await _service.GetSummaryAsync(cancellationToken);
        return summary;
    }
}
