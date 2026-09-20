FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Directory.Build.props Directory.Packages.props ./
COPY */*.csproj ./
RUN for f in *.csproj; do mkdir -p "${f%.csproj}" && mv "$f" "${f%.csproj}/"; done
RUN dotnet restore Skjoldjasper.Web/Skjoldjasper.Web.csproj

COPY . .
RUN dotnet publish Skjoldjasper.Web/Skjoldjasper.Web.csproj -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled AS runtime
WORKDIR /app

ENV ASPNETCORE_FORWARDEDHEADERS_ENABLED=true

COPY --from=build /app .

USER $APP_UID
EXPOSE 8080

CMD ["Skjoldjasper.Web.dll"]
