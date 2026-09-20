namespace Skjoldjasper.Web.Identity;

public sealed class AdminSeeder(IServiceScopeFactory scopes, IConfiguration config) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        var userName = config["ADMIN_USERNAME"];
        var password = config["ADMIN_PASSWORD"];
        if (string.IsNullOrWhiteSpace(userName) || string.IsNullOrWhiteSpace(password))
        {
            return;
        }

        using var scope = scopes.CreateScope();
        var accounts = scope.ServiceProvider.GetRequiredService<UserAccounts>();
        await accounts.CreateAsync(userName, password);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
