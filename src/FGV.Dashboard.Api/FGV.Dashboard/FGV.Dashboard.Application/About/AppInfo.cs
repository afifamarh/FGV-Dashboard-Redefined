using System;
using System.Collections.Generic;
using System.Text;

namespace FGV.Dashboard.Application.About
{
    public sealed record AppInfo(
    string Name,
    string Version,
    string Environment,
    DateTimeOffset ServerTimeUtc);
}
