using System.Reflection;
using Microsoft.Extensions.DependencyInjection;

namespace Skjoldjasper.Finance;

public static class FinanceModule
{
    public static readonly Assembly Assembly = typeof(FinanceModule).Assembly;

    public static IServiceCollection AddFinance(this IServiceCollection services)
    {
        return services;
    }
}
