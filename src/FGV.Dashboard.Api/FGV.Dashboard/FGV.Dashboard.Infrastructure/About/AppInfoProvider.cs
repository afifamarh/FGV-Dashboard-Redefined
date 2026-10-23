using System;
using System.Collections.Generic;
using System.Text;

using FGV.Dashboard.Application.About;

namespace FGV.Dashboard.Infrastructure.About;

public sealed class AppInfoProvider : IAppInfoProvider
{
    private readonly string _environmentName;
    private readonly TimeProvider _time;

    public AppInfoProvider(string environmentName, TimeProvider? time = null)
    {
        _environmentName = environmentName;
        _time = time ?? TimeProvider.System;
    }

    public AppInfo GetAppInfo() => new(
        "FGV Prodata Security Dashboard API",
        typeof(AppInfoProvider).Assembly.GetName().Version?.ToString() ?? "unknown",
        _environmentName,
        _time.GetUtcNow());
}
