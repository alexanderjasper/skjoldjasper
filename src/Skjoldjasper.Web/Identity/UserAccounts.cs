using Microsoft.AspNetCore.Identity;

namespace Skjoldjasper.Web.Identity;

public sealed class UserAccounts(UserManager<AppUser> users)
{
    public async Task<bool> CreateAsync(string userName, string password)
    {
        if (await users.FindByNameAsync(userName) is not null)
        {
            return false;
        }

        var result = await users.CreateAsync(new AppUser { UserName = userName }, password);
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(
                string.Join("; ", result.Errors.Select(e => e.Description)));
        }

        return true;
    }
}
