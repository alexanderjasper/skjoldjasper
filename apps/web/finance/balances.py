"""Reconstruct account balances over time from transaction flows.

The bank export has no running balance, so a balance series is the account's
opening balance plus the cumulative effect of every transaction touching it.
Sign is taken from the *direction* (received vs sent), not the stored amount
sign, so it stays correct regardless of which leg of a transfer a row
represents.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from finance.models import Account, Transaction


def _delta_for(tx: Transaction, number: str) -> Decimal:
    """Effect of `tx` on the account `number`: +received, -sent, 0 if neither
    or a self-transfer (both legs the same account)."""
    to_here = tx.to_account == number
    from_here = tx.from_account == number
    if to_here and not from_here:
        return abs(tx.amount)
    if from_here and not to_here:
        return -abs(tx.amount)
    return Decimal("0")


def account_balance_series(
    account: Account, transactions: list[Transaction]
) -> tuple[list[tuple[date, Decimal]], Decimal]:
    """Return (points, current_balance) for one account.

    `points` is a sorted list of (day, end-of-day balance). `transactions`
    may be the household's full list — only those touching this account and
    on/after the opening date contribute.
    """
    number = account.number
    opening = account.opening_balance or Decimal("0")
    opening_date = account.opening_date

    by_day: dict[date, Decimal] = {}
    for tx in transactions:
        if opening_date and tx.date < opening_date:
            continue
        delta = _delta_for(tx, number)
        if delta:
            by_day[tx.date] = by_day.get(tx.date, Decimal("0")) + delta

    running = opening
    balances: dict[date, Decimal] = {}
    start = opening_date or (min(by_day) if by_day else None)
    if start is not None:
        balances[start] = running  # baseline; overwritten if start has activity
    for day in sorted(by_day):
        running += by_day[day]
        balances[day] = running

    return sorted(balances.items()), running
