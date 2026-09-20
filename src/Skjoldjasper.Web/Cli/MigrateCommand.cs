using JasperFx.CommandLine;
using JasperFx.Resources;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Skjoldjasper.Web.Identity;

namespace Skjoldjasper.Web.Cli;

[Description("Apply Identity migrations and Marten/Wolverine schema changes", Name = "migrate")]
public class MigrateCommand : JasperFxAsyncCommand<MigrateInput>
{
    public override async Task<bool> Execute(MigrateInput input)
    {
        using var host = input.BuildHost();

        var factory = host.Services.GetRequiredService<IDbContextFactory<IdentityContext>>();
        await using (var db = await factory.CreateDbContextAsync())
        {
            await db.Database.MigrateAsync();
        }

        await host.SetupResources();
        return true;
    }
}
