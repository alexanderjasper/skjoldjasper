"""Parse Sydjysk Sparekasse Posteringsdetaljer.csv exports.

Semicolon-delimited, no header, ~15 columns. The ones we use:

    0  posteringstekst (sometimes blank)
    1  transaktionstekst (description; falls back to col 0)
    2  from account
    3  to account
    4  amount (Danish "1.234,56", signed)
    5  counterparty
    7  oprettet date     DD-MM-YYYY
    8  bogført date      DD-MM-YYYY
    9  dispositionsdato  DD-MM-YYYY (preferred; then bogført, then oprettet)
    10 Transaktions-ID (stable, unique — used as external_id)
    11 free-text reference (usually blank)

Yields Decimals (never floats).
"""

from __future__ import annotations

import csv
import hashlib
from collections.abc import Iterator
from datetime import date
from decimal import Decimal
from typing import IO


def parse(stream: IO[str]) -> Iterator[dict]:
    """Yield parsed rows. Keys match the Transaction model: date, amount,
    description, note, from_account, to_account, counterparty, external_id,
    raw.
    """
    reader = csv.reader(stream, delimiter=";")
    for row in reader:
        # Bank rows always have ≥ 12 columns; anything shorter is noise.
        if len(row) < 12:
            continue

        amount = _danish_amount(row[4])
        # Three date columns: oprettet (7), bogført (8), dispositionsdato (9).
        # Prefer the value date, then booked, then created.
        d = (
            _danish_date(row[9])
            or _danish_date(row[8])
            or _danish_date(row[7])
        )
        if d is None:
            continue

        description = row[1].strip() or row[0].strip()
        # col 10 is the stable bank Transaktions-ID (always present, unique);
        # col 11 is a free-text reference that's usually blank. Key on the ID,
        # falling back to the reference, then a content hash.
        external_id = (
            row[10].strip()
            or row[11].strip()
            or _fallback_external_id(d, description, amount)
        )

        yield {
            "date": d,
            "amount": amount,
            "description": description,
            "note": "",
            "from_account": row[2].strip(),
            "to_account": row[3].strip(),
            "counterparty": row[5].strip(),
            "external_id": external_id,
            "raw": row,
        }


def _danish_amount(s: str) -> Decimal:
    """'1.234,56' → Decimal('1234.56'); preserves sign; '' → 0."""
    s = s.strip()
    if not s:
        return Decimal("0")
    return Decimal(s.replace(".", "").replace(",", "."))


def _danish_date(s: str) -> date | None:
    """'DD-MM-YYYY' → date(YYYY, MM, DD); blank/malformed → None."""
    s = s.strip()
    if not s:
        return None
    parts = s.split("-")
    if len(parts) != 3:
        return None
    try:
        return date(int(parts[2]), int(parts[1]), int(parts[0]))
    except ValueError:
        return None


def _fallback_external_id(d: date, description: str, amount: Decimal) -> str:
    h = hashlib.sha256(f"{d.isoformat()}|{description}|{amount}".encode())
    return h.hexdigest()[:16]
