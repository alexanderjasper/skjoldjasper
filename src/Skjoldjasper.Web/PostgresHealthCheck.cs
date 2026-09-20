using Marten;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Skjoldjasper.Web;

/// <summary>
/// Proves the app can actually reach Postgres, not just that it booted.
/// Wired to /healthz for the container healthcheck.
/// </summary>
public sealed class PostgresHealthCheck(IDocumentStore store) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await using var session = store.QuerySession();
            await session.QueryAsync<int>("select 1", cancellationToken);
            return HealthCheckResult.Healthy();
        }
        catch (Exception e)
        {
            return HealthCheckResult.Unhealthy("Cannot reach Postgres.", e);
        }
    }
}
