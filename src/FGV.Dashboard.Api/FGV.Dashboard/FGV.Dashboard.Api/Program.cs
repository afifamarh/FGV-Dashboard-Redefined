using System.Text.Json;
using System.Text.Json.Serialization;
using FGV.Dashboard.Application.About;
using FGV.Dashboard.Application.Dashboard;
using FGV.Dashboard.Application.Endpoints;
using FGV.Dashboard.Application.Security;
using FGV.Dashboard.Infrastructure.About;
using FGV.Dashboard.Infrastructure.SampleData;
using FGV.Dashboard.Application.Vulnerabilities;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(
        new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)));
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();

builder.Services.AddSingleton<IAppInfoProvider>(
    new AppInfoProvider(builder.Environment.EnvironmentName));
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<ISecurityDataSource, SyntheticSecurityDataSource>();
builder.Services.AddScoped<DashboardService>();
builder.Services.AddScoped<EndpointService>();
builder.Services.AddScoped<VulnerabilityService>();

var app = builder.Build();

app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();