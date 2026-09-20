using JasperFx.CommandLine;
using Microsoft.Extensions.DependencyInjection;
using Skjoldjasper.Web.Identity;

namespace Skjoldjasper.Web.Cli;

[Description("Create a sign-in account", Name = "users-add")]
public class AddUserCommand : JasperFxAsyncCommand<AddUserInput>
{
    public override async Task<bool> Execute(AddUserInput input)
    {
        using var host = input.BuildHost();
        using var scope = host.Services.CreateScope();
        var accounts = scope.ServiceProvider.GetRequiredService<UserAccounts>();

        var created = await accounts.CreateAsync(input.UserName, input.Password);
        Console.WriteLine(created ? $"Created {input.UserName}" : $"{input.UserName} already exists");
        return true;
    }
}
