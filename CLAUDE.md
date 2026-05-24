# skjoldjasper Development Guidelines

## Stack

- Django 6 on Python 3.13, dependencies managed with `uv`
- Whitenoise for static files, Gunicorn in production
- `django-allauth` for authentication (email + password, signup closed)
- SQLite for local dev (defaults to `db.sqlite3` next to `manage.py`); Postgres
  available via `DATABASE_URL` in production
- Deployed behind Cloudflare Tunnel + Traefik via Dokploy

## Project Structure

```text
apps/
└── web/                 # The Django project lives here
    ├── manage.py
    ├── pyproject.toml   # uv-managed deps
    └── skjoldjasper/    # Django config package
        ├── settings.py
        ├── urls.py
        ├── adapters.py  # custom allauth adapter (signup closed)
        └── views.py

infra/                   # Docker Compose, Dokploy, backups
```

Future Django apps (finance, games, …) live as packages inside `apps/web/`.

## Running locally

```bash
cd apps/web
uv sync
SECRET_KEY=dev DEBUG=True .venv/bin/python manage.py migrate
SECRET_KEY=dev DEBUG=True .venv/bin/python manage.py createsuperuser
SECRET_KEY=dev DEBUG=True .venv/bin/python manage.py runserver
```

## Creating user accounts

Public signup is disabled by `NoSignupAccountAdapter`. Create users from
the Django admin at `/admin/` (Users → Add) or with `manage.py
createsuperuser`.

## Style

- Python with `ruff` (line length 100, py313 target)
- Prefer server-rendered Django templates + HTMX over SPA frameworks
- Keep `skjoldjasper/` lean — domain logic belongs in feature apps
