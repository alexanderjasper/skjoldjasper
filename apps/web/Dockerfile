FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv

# uv brings deterministic installs without a Python build step in the image.
COPY --from=ghcr.io/astral-sh/uv:0.10 /uv /usr/local/bin/uv

WORKDIR /app

# Install deps in a separate layer that only invalidates when the lockfile changes.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

COPY . .
RUN uv sync --frozen --no-dev

ENV PATH="/opt/venv/bin:$PATH"

# /data holds the SQLite file; the volume is created by docker-compose.
# collectstatic needs settings to import, so feed it a throwaway SECRET_KEY.
RUN mkdir -p /data && SECRET_KEY=build python manage.py collectstatic --noinput

EXPOSE 8000

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "2", "--access-logfile", "-", "skjoldjasper.wsgi:application"]
