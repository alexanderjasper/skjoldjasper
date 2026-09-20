using System.Reflection;
using Microsoft.Extensions.DependencyInjection;

namespace Skjoldjasper.Finance;

/// <summary>
/// The module's single registration seam — the equivalent of one line in
/// Django's INSTALLED_APPS. Everything finance-specific (documents,
/// projections, Wolverine handlers, pages) hangs off this type so the host
/// project never grows as modules are added.
/// </summary>
public static class FinanceModule
{
    /// <summary>Postgres schema owned by this module.</summary>
    public const string Schema = "finance";

    /// <summary>
    /// Needed by the host for two things: Wolverine handler discovery, and
    /// the Blazor router's AdditionalAssemblies so this module's pages route.
    /// </summary>
    public static readonly Assembly Assembly = typeof(FinanceModule).Assembly;

    public static IServiceCollection AddFinance(this IServiceCollection services)
    {
        // Nothing to register yet. As documents and projections arrive they go
        // here, via services.ConfigureMarten(...), into this module's own
        // schema so `\dt finance.*` stays legible once other modules share the
        // database. The event store itself stays shared across modules.
        return services;
    }
}
