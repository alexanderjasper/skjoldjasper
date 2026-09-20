using JasperFx;
using Marten;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Skjoldjasper.Finance;
using Skjoldjasper.Web;
using Skjoldjasper.Web.Components;
using Skjoldjasper.Web.Identity;
using Wolverine;
using Wolverine.Marten;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Postgres")
                       ?? throw new InvalidOperationException(
                           "ConnectionStrings:Postgres is required.");

builder.Services.AddMarten(opts =>
    {
        opts.Connection(connectionString);
        opts.AutoCreateSchemaObjects = builder.Environment.IsDevelopment()
            ? AutoCreate.CreateOrUpdate
            : AutoCreate.None;
    })
    .IntegrateWithWolverine();

builder.UseWolverine(opts =>
{
    opts.Durability.Mode = DurabilityMode.MediatorOnly;
    opts.Discovery.IncludeAssembly(FinanceModule.Assembly);
});

builder.Services.AddDbContextFactory<IdentityContext>(opts => opts.UseNpgsql(
    connectionString,
    npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", IdentityContext.Schema)));

builder.Services.AddIdentityCore<AppUser>()
    .AddEntityFrameworkStores<IdentityContext>()
    .AddSignInManager();

builder.Services.AddScoped<UserAccounts>();

builder.Services.AddAuthentication(IdentityConstants.ApplicationScheme)
    .AddIdentityCookies();

builder.Services.AddAuthorization();
builder.Services.AddCascadingAuthenticationState();

builder.Services.AddHostedService<AdminSeeder>();

builder.Services.AddFinance();

builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

builder.Services.AddHealthChecks()
    .AddCheck<PostgresHealthCheck>("postgres", timeout: TimeSpan.FromSeconds(3));

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
}

app.UseStatusCodePagesWithReExecute("/not-found", createScopeForStatusCodePages: true);
app.UseAuthentication();
app.UseAuthorization();
app.UseAntiforgery();

app.MapHealthChecks("/healthz");
app.MapStaticAssets();
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode()
    .AddAdditionalAssemblies(FinanceModule.Assembly);

app.MapPost("/logout", async (SignInManager<AppUser> signIn) =>
{
    await signIn.SignOutAsync();
    return Results.Redirect("/");
});

await app.RunJasperFxCommands(args);
