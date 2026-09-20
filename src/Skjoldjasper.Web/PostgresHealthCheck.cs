using Marten;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Skjoldjasper.Web;

public sealed class PostgresHealthCheck(IDocumentStore store) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        await using var session = store.QuerySession();
        await session.QueryAsync<int>("select 1", cancellationToken);
        return HealthCheckResult.Healthy();
    }
}
