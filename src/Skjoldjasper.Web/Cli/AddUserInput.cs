using JasperFx.CommandLine;

namespace Skjoldjasper.Web.Cli;

public class AddUserInput : NetCoreInput
{
    [Description("Username to sign in with")]
    public string UserName { get; set; } = string.Empty;

    [Description("Password")]
    public string Password { get; set; } = string.Empty;
}
