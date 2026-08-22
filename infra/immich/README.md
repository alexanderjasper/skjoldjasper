# Immich

Self-hosted photo library, adopted into Dokploy. See `docker-compose.yml` for the
stack and `BACKUP.md` for the backup strategy.

## How it's reached

| Path | URL | Route |
| --- | --- | --- |
| Public | `https://immich.skjoldjasper.dk` | Cloudflare Tunnel → Traefik → container |
| LAN | `http://immich.local` | mDNS → Traefik (host `:80`) → container |

The host port `2283` is published on **loopback only** (`127.0.0.1:2283`), for
host-networked stacks on this box that need the API — see `infra/dlna`. All
LAN and public traffic still enters via Traefik, so the old
`http://<home-server-ip>:2283` direct address does not work; use one of the two
routes above instead.

## Friendly LAN name: `immich.local`

So you don't have to remember the IP on the LAN, the host advertises `immich.local`
over mDNS pointing at itself. Unlike the Music Box (which needs host networking and
so lives on `:8480`), Immich routes through Traefik on port 80, so the LAN URL is a
bare **`http://immich.local`** — no port.

A second Traefik router (`immich-lan`, see the labels in `docker-compose.yml`)
matches `Host(immich.local)` and points at the same backend, but **without** the
`X-Forwarded-Proto=https` middleware — LAN traffic is plain http, and forcing the
https header would make Immich emit broken `https://` URLs.

### How the alias is published (and two gotchas)

The obvious approach — `avahi-publish -a immich.local <ip>` — **does not work on
this host**, and fails with `Failed to add address: Local name collision`. Two
separate reasons, both worth knowing before you touch this:

1. **Avahi must be confined to the LAN NIC.** This box runs Docker (the Immich
   stack itself), so it has `docker0` + `br-*` + many `veth*` interfaces. By
   default Avahi broadcasts on all of them and hears its *own* probes reflected
   back across the bridges, reporting a phantom name collision. Pin it to the
   real LAN interface (here WiFi, `wlo1`) in `/etc/avahi/avahi-daemon.conf`:

   ```ini
   [server]
   allow-interfaces=wlo1
   ```

   (Confirm the daemon then only joins `wlo1` with
   `journalctl -u avahi-daemon | grep Joining`.)

2. **The alias is a CNAME, not a second A record.** Even on a single interface,
   `avahi-publish -a` still collides: the host's primary IP is already owned by
   `<hostname>.local`, and Avahi refuses a *duplicate address record* for it. So
   `immich-mdns.py` publishes a **CNAME** `immich.local -> <hostname>.local`
   instead (via Avahi's D-Bus API — `avahi-publish` has no CNAME mode). No
   address record means nothing to collide with; clients follow
   `immich.local -> <hostname>.local -> <host IP>`.

One-time setup on the home server (Debian/Ubuntu, Avahi already runs for `.local`):

```sh
# 1. confine avahi to the LAN NIC, then restart it (see gotcha #1 above)
sudo sed -i 's/^#*allow-interfaces=.*/allow-interfaces=wlo1/' /etc/avahi/avahi-daemon.conf
grep -q '^allow-interfaces=' /etc/avahi/avahi-daemon.conf || \
  sudo sed -i '/^\[server\]/a allow-interfaces=wlo1' /etc/avahi/avahi-daemon.conf
sudo systemctl restart avahi-daemon

# 2. install the CNAME publisher + unit
sudo apt install -y python3-dbus                              # avahi-publish has no CNAME mode
sudo install -m 755 infra/immich/immich-mdns.py /usr/local/sbin/
sudo install -m 644 infra/immich/immich-mdns.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now immich-mdns.service
```

Verify the CNAME resolves to the host IP, then test from another device:

```sh
avahi-resolve -4 -n immich.local      # -> <hostname>.local  <host IP>
ping immich.local                     # from a phone/laptop on the same LAN
```

Notes:
- macOS/iOS resolve `.local` natively; Linux needs `libnss-mdns`. **Android has
  poor `.local` support in browsers**, so `http://immich.local` may not load on
  an Android phone — use the IP or the public URL there.
- Give the server a **DHCP reservation** so its IP stays put. The CNAME points at
  `<hostname>.local` (not a hard-coded IP), so it follows the host automatically,
  but a stable lease still avoids surprises.
