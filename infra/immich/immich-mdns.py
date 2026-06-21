#!/usr/bin/env python3
"""Advertise immich.local on the LAN via mDNS as a CNAME -> this host's name.

`avahi-publish -a` (a second A record for the host's own IP) trips avahi's
conflict detection ("Local name collision"): the host's primary IP is already
owned by <hostname>.local, and avahi refuses a duplicate address record. A CNAME
adds no address record, so there is nothing to collide with -- clients follow
immich.local -> <hostname>.local -> <host IP>.

Runs in the foreground; systemd supervises it. Needs python3-dbus
(avahi-publish has no CNAME mode, so we go through Avahi's D-Bus API).
"""
import signal
import sys

import dbus

CNAME = "immich.local"
TTL = 60
CLASS_IN = 0x01
TYPE_CNAME = 0x05
IF_UNSPEC = -1
PROTO_UNSPEC = -1


def encode_name(name):
    """DNS wire format: each label length-prefixed, terminated with a NUL."""
    out = bytearray()
    for label in name.rstrip(".").split("."):
        out.append(len(label))
        out.extend(label.encode("ascii"))
    out.append(0)
    return bytes(out)


bus = dbus.SystemBus()
server = dbus.Interface(
    bus.get_object("org.freedesktop.Avahi", "/"),
    "org.freedesktop.Avahi.Server",
)
target = server.GetHostNameFqdn()  # e.g. "skjoldjasper.local"

group = dbus.Interface(
    bus.get_object("org.freedesktop.Avahi", server.EntryGroupNew()),
    "org.freedesktop.Avahi.EntryGroup",
)
group.AddRecord(
    dbus.Int32(IF_UNSPEC),
    dbus.Int32(PROTO_UNSPEC),
    dbus.UInt32(0),
    CNAME,
    dbus.UInt16(CLASS_IN),
    dbus.UInt16(TYPE_CNAME),
    dbus.UInt32(TTL),
    dbus.ByteArray(encode_name(target)),
)
group.Commit()
print(f"Published CNAME {CNAME} -> {target}", flush=True)

# Block so the D-Bus connection (and thus the record) stays alive.
signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
signal.pause()
