using System;
using System.Collections.Generic;
using System.Text;

namespace FGV.Dashboard.Application.About
{
    public interface IAppInfoProvider
    {
        AppInfo GetAppInfo();
    }
}
