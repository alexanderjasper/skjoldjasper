#!/bin/sh
# Advertise musicbox.local on the LAN via mDNS, pointing at this host's
# primary IP, so the Music Box UI is reachable at http://musicbox.local:8480
# instead of a bare IP. Runs in the foreground; systemd supervises it.
#
# Needs avahi-utils (provides avahi-publish):  sudo apt install avahi-utils
set -eu

NAME="${MUSICBOX_MDNS_NAME:-musicbox.local}"
IP="$(hostname -I | awk '{print $1}')"

echo "Publishing mDNS alias ${NAME} -> ${IP}"
# -a = publish an address (A) record; stays registered until this process exits.
exec avahi-publish -a "${NAME}" "${IP}"
