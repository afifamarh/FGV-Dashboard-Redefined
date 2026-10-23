using FGV.Dashboard.Api.Contracts;
using FGV.Dashboard.Application.About;
using Microsoft.AspNetCore.Mvc;

namespace FGV.Dashboard.Api.Controllers;

[ApiController]
[Route("api/v1/app-info")]
public sealed class AppInfoController : ControllerBase
{
    private readonly IAppInfoProvider _provider;

    public AppInfoController(IAppInfoProvider provider) => _provider = provider;

    [HttpGet]
    [ProducesResponseType<AppInfoResponse>(StatusCodes.Status200OK)]
    public ActionResult<AppInfoResponse> Get()
    {
        var info = _provider.GetAppInfo();
        return new AppInfoResponse(info.Name, info.Version, info.Environment, info.ServerTimeUtc);
    }
}