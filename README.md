# skjoldjasper

Personal website at [skjoldjasper.dk](https://skjoldjasper.dk).

A small Django site that will host a family finance module (modellen) and
later other things — games, etc. Deployed behind Cloudflare Tunnel +
Traefik via Dokploy.

## Stack

- Django 6 on Python 3.13, managed with `uv`
- `django-allauth` for auth (email + password, signup closed)
- Whitenoise for static files, Gunicorn in production
- SQLite locally; volume-mounted SQLite in production (Postgres available
  via `DATABASE_URL` if/when needed)

## Layout

```text
apps/web/           # The Django project
  manage.py
  pyproject.toml
  skjoldjasper/     # Django config package (settings, urls, adapters)
infra/              # Docker Compose, Dokploy, backups
```

Future Django apps (finance, games, …) will live as packages inside
`apps/web/`.

## Local development

```bash
cd apps/web
uv sync

# First time only
SECRET_KEY=dev DEBUG=True .venv/bin/python manage.py migrate
SECRET_KEY=dev DEBUG=True .venv/bin/python manage.py createsuperuser

# Run the dev server
SECRET_KEY=dev DEBUG=True .venv/bin/python manage.py runserver
```

Then:

- `/` — public landing page (placeholder)
- `/accounts/login/` — sign in
- `/admin/` — Django admin

Public signup is disabled. Create the next user in the admin under
**Users → Add user**.

In `DEBUG=True` emails (password reset, etc.) print to the console.

## Configuration

Settings read from `apps/web/.env` (see `apps/web/.env.example`). The
production deployment supplies these via Dokploy:

| Var                 | Purpose                                       |
|---------------------|-----------------------------------------------|
| `SECRET_KEY`        | Django signing key                            |
| `DEBUG`             | `True` / `False`                              |
| `ALLOWED_HOSTS`     | Comma-separated hostnames                     |
| `CSRF_TRUSTED_ORIGINS` | Comma-separated origins                    |
| `DATABASE_URL`      | Defaults to local SQLite                      |
| `EMAIL_HOST`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_PORT`, `EMAIL_USE_TLS`, `DEFAULT_FROM_EMAIL` | SMTP for password reset etc. |

## Deployment

Built from `apps/web/Dockerfile` and rolled out by Dokploy. Production
data lives on a volume mounted at `/data`; the SQLite file is at
`/data/db.sqlite3`. Backups are documented in `infra/`.
