using System.ComponentModel.DataAnnotations;

namespace Skjoldjasper.Web.Identity;

public sealed class LoginInput
{
    [Required]
    public string UserName { get; set; } = string.Empty;

    [Required, DataType(DataType.Password)]
    public string Password { get; set; } = string.Empty;
}
