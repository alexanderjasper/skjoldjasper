"""Idempotent superuser bootstrap for first-boot deploys.

Runs on every container start (see infra/web/docker-compose.yml). It does
nothing once any superuser exists, so it is safe to leave in the boot
command indefinitely — it only acts on a fresh database.

Credentials come from environment variables, matching Django's own
`createsuperuser --noinput` convention:

    DJANGO_SUPERUSER_USERNAME
    DJANGO_SUPERUSER_EMAIL      (optional)
    DJANGO_SUPERUSER_PASSWORD

If the username or password is missing, the command is a quiet no-op —
this keeps local `runserver` (where the vars are unset) unaffected.
"""

import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create a superuser from DJANGO_SUPERUSER_* env vars if none exists."

    def handle(self, *args, **options):
        User = get_user_model()

        if User.objects.filter(is_superuser=True).exists():
            self.stdout.write("Superuser already exists; nothing to do.")
            return

        username = os.environ.get("DJANGO_SUPERUSER_USERNAME")
        password = os.environ.get("DJANGO_SUPERUSER_PASSWORD")
        email = os.environ.get("DJANGO_SUPERUSER_EMAIL", "")

        if not username or not password:
            self.stdout.write(
                "No superuser and DJANGO_SUPERUSER_USERNAME/PASSWORD unset; "
                "skipping bootstrap."
            )
            return

        User.objects.create_superuser(
            username=username, email=email, password=password
        )
        self.stdout.write(self.style.SUCCESS(f"Created superuser {username!r}."))
