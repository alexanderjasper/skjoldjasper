using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Skjoldjasper.Web.Identity;

public sealed class IdentityContext(DbContextOptions<IdentityContext> options)
    : IdentityUserContext<AppUser, Guid>(options)
{
    public const string Schema = "identity";

    protected override void OnModelCreating(ModelBuilder builder)
    {
        builder.HasDefaultSchema(Schema);
        base.OnModelCreating(builder);

        builder.Entity<AppUser>(user =>
        {
            user.Ignore(u => u.Email);
            user.Ignore(u => u.NormalizedEmail);
            user.Ignore(u => u.EmailConfirmed);
            user.Ignore(u => u.PhoneNumber);
            user.Ignore(u => u.PhoneNumberConfirmed);
            user.Ignore(u => u.TwoFactorEnabled);
        });
    }
}
