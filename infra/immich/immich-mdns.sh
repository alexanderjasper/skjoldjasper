#!/bin/sh
# Advertise immich.local on the LAN via mDNS, pointing at this host's primary
# IP, so Immich is reachable at http://immich.local (Traefik serves it on :80)
# instead of a bare IP:port. Runs in the foreground; systemd supervises it.
#
# Needs avahi-utils (provides avahi-publish):  sudo apt install avahi-utils
set -eu

NAME="${IMMICH_MDNS_NAME:-immich.local}"
IP="$(hostname -I | awk '{print $1}')"

echo "Publishing mDNS alias ${NAME} -> ${IP}"
# -a = publish an address (A) record; stays registered until this process exits.
exec avahi-publish -a "${NAME}" "${IP}"
