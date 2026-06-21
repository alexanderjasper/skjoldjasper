# Immich

Self-hosted photo library, adopted into Dokploy. See `docker-compose.yml` for the
stack and `BACKUP.md` for the backup strategy.

## How it's reached

| Path | URL | Route |
| --- | --- | --- |
| Public | `https://immich.skjoldjasper.dk` | Cloudflare Tunnel → Traefik → container |
| LAN | `http://immich.local` | mDNS → Traefik (host `:80`) → container |

The host port `2283` is **not** published — all traffic enters via Traefik. The
old `http://<home-server-ip>:2283` direct address therefore no longer works; use
one of the two routes above instead.

## Friendly LAN name: `immich.local`

So you don't have to remember the IP on the LAN, the host advertises `immich.local`
over mDNS pointing at itself. Unlike the Music Box (which needs host networking and
so lives on `:8480`), Immich routes through Traefik on port 80, so the LAN URL is a
bare **`http://immich.local`** — no port.

A second Traefik router (`immich-lan`, see the labels in `docker-compose.yml`)
matches `Host(immich.local)` and points at the same backend, but **without** the
`X-Forwarded-Proto=https` middleware — LAN traffic is plain http, and forcing the
https header would make Immich emit broken `https://` URLs.

One-time setup on the home server (Debian/Ubuntu, Avahi already runs for `.local`):

```sh
sudo apt install avahi-utils                                  # provides avahi-publish
sudo install -m 755 infra/immich/immich-mdns.sh /usr/local/sbin/
sudo install -m 644 infra/immich/immich-mdns.service /etc/systemd/system/
sudo systemctl enable --now immich-mdns.service
```

Verify from another device: `ping immich.local`, then open `http://immich.local`.

(Tip: give the server a **DHCP reservation** so its IP — and this alias — stays
put. The script re-reads the IP each start, but a stable lease avoids surprises.)
