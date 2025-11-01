FROM postgres:16

# Install pgBackRest from the official PostgreSQL APT repo (PGDG) to support PG16
RUN set -eux; \
  apt-get update; \
  apt-get install -y --no-install-recommends wget gnupg ca-certificates; \
  echo "deb http://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list; \
  wget -qO - https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor > /etc/apt/trusted.gpg.d/postgresql.gpg; \
  apt-get update; \
  apt-get install -y --no-install-recommends pgbackrest; \
  rm -rf /var/lib/apt/lists/*


