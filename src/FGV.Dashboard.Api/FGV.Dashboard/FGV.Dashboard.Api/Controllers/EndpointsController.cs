using FGV.Dashboard.Api.Contracts;
using FGV.Dashboard.Application.Endpoints;
using Microsoft.AspNetCore.Mvc;

namespace FGV.Dashboard.Api.Controllers;

[ApiController]
[Route("api/v1/endpoints")]
public sealed class EndpointsController : ControllerBase
{
    private readonly EndpointService _service;

    public EndpointsController(EndpointService service) => _service = service;

    [HttpGet]
    [ProducesResponseType<PagedResult<EndpointListItem>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<PagedResult<EndpointListItem>>> List(
        [FromQuery] EndpointListRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _service.QueryAsync(request.ToQuery(), cancellationToken);
        return result;
    }

    [HttpGet("{id:maxlength(50)}")]
    [ProducesResponseType<EndpointDetail>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EndpointDetail>> Get(string id, CancellationToken cancellationToken)
    {
        var detail = await _service.GetDetailAsync(id, cancellationToken);
        if (detail is null) return NotFound();
        return detail;
    }
}
