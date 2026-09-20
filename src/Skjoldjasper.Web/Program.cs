using JasperFx;
using JasperFx.Events.Daemon;
using Marten;
using Skjoldjasper.Finance;
using Skjoldjasper.Web;
using Skjoldjasper.Web.Components;
using Weasel.Core;
using Wolverine;
using Wolverine.Marten;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Postgres")
                       ?? throw new InvalidOperationException(
                           "ConnectionStrings:Postgres is required.");

builder.Services.AddMarten(opts =>
    {
        opts.Connection(connectionString);

        // Schema changes are deliberate in production: the container applies
        // them at boot as an explicit step, the app never migrates itself.
        opts.AutoCreateSchemaObjects = builder.Environment.IsDevelopment()
            ? AutoCreate.CreateOrUpdate
            : AutoCreate.None;
    })
    .IntegrateWithWolverine()
    // Single container, so exactly one node ever runs projections.
    .AddAsyncDaemon(DaemonMode.HotCold);

builder.Host.UseWolverine(opts =>
{
    // Handlers live in the module libraries, not the host.
    opts.Discovery.IncludeAssembly(FinanceModule.Assembly);

    // Wolverine 6 dropped the Roslyn compiler from the core package. Compiling
    // handler code at startup is fine locally; the deployed image should
    // instead ship pre-generated code (`dotnet run -- codegen write` plus
    // TypeLoadMode.Static) and drop the WolverineFx.RuntimeCompilation
    // reference. Worth doing when we build the Dockerfile.
    opts.UseRuntimeCompilation();
});

// Modules — the INSTALLED_APPS list.
builder.Services.AddFinance();

builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

builder.Services.AddHealthChecks()
    .AddCheck<PostgresHealthCheck>("postgres");

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
}

app.UseStatusCodePagesWithReExecute("/not-found", createScopeForStatusCodePages: true);
app.UseAntiforgery();

app.MapHealthChecks("/healthz");
app.MapStaticAssets();
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode()
    .AddAdditionalAssemblies(FinanceModule.Assembly);

await app.RunJasperFxCommands(args);
