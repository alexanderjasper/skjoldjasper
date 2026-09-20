# `infra/web` — the website service stack

Two containers serve `skjoldjasper.dk`:

| Container | What it does |
|---|---|
| `web` | The .NET app built from `src/Dockerfile`. Applies database changes on boot, then serves. |
| `postgres` | Postgres 18. Holds Marten's event store, its projections, and the Identity tables. |

Backups are not a container. A host-side script dumps the database nightly and
pushes it to pCloud, the same pattern `infra/nextcloud` and `infra/immich` use.

## One-time setup

1. Set `POSTGRES_PASSWORD` (see `.env.example`) on this service in Dokploy.
2. Install the backup script and timer on the host:
   ```sh
   sudo install -m 0755 infra/web/backup.sh /usr/local/sbin/skjoldjasper-web-backup.sh
   sudo install -m 0644 infra/web/systemd/skjoldjasper-web-backup.* /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now skjoldjasper-web-backup.timer
   ```
3. Create the `.backups/skjoldjasper-web/db` folder on the pCloud crypt remote.

## Verifying backups

```sh
sudo systemctl start skjoldjasper-web-backup.service
sudo tail -40 /var/log/skjoldjasper-web-backup.log
rclone --config /home/alexander/.config/rclone/rclone.conf \
  lsl pcloudcrypt:.backups/skjoldjasper-web/db/
```

## Restore drill

Run this once after the first deploy and any time the backup config changes.

```sh
# 1. Pull the most recent dump down from the remote.
rclone --config /home/alexander/.config/rclone/rclone.conf \
  copy pcloudcrypt:.backups/skjoldjasper-web/db/ /var/tmp/restore/ --max-age 48h

# 2. Restore it into a scratch database, never over the live one.
docker exec -i skjoldjasper_postgres createdb -U skjoldjasper restore_test
docker exec -i skjoldjasper_postgres \
  pg_restore -U skjoldjasper -d restore_test < /var/tmp/restore/<dump>

# 3. Confirm the event store came back.
docker exec skjoldjasper_postgres \
  psql -U skjoldjasper -d restore_test -c 'select count(*) from mt_events'

# 4. Clean up.
docker exec skjoldjasper_postgres dropdb -U skjoldjasper restore_test
```

## Database schema changes

The app runs with Marten's `AutoCreate.None`, so it never migrates itself. The
boot command runs `db-apply` first, which is idempotent. To inspect before
deploying:

```sh
docker compose exec web dotnet Skjoldjasper.Web.dll db-assert   # non-zero if drifted
docker compose exec web dotnet Skjoldjasper.Web.dll db-dump     # print the DDL
```

## Auto-deploy on push to `main`

Dokploy redeploys on every push via a **Git webhook** — no GitHub Actions
workflow needed. GitHub POSTs to a Dokploy webhook URL, Dokploy pulls the new
commit, rebuilds the image, and the boot command runs `db-apply` as usual.

This requires the Dokploy panel to be reachable by GitHub's servers. The
panel sits on a public Cloudflare Tunnel hostname guarded by Dokploy's own
login; we deliberately do **not** put Cloudflare Access in front of it, since
Access would block GitHub's unauthenticated webhook POST.

### One-time setup

1. **Expose the Dokploy panel through the existing Cloudflare Tunnel.** Add a
   public hostname (e.g. `dokploy.skjoldjasper.dk`) routing to the Dokploy
   panel's local port (default `:3000`).

2. **Enable auto-deploy** on the `web` application in the Dokploy UI, then
   copy the generated **webhook URL** from its deployment settings/logs.

3. **Register the webhook in GitHub**: repo → Settings → Webhooks → Add
   webhook. Paste the URL, content type `application/json`, event "Just the
   push event". Make sure the branch Dokploy watches matches `main`.

## Why nightly dumps rather than continuous replication

The previous stack streamed SQLite's WAL to pCloud with Litestream for a ~1s
RPO. Postgres has no equally cheap equivalent — continuous archiving means
running pgBackRest or WAL-G and somewhere to ship segments to. For a household
budget that is updated in bursts a few times a month, losing up to a day costs
one CSV re-import, so a nightly `pg_dump` is the right trade.
