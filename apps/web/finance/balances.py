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


def monthly_external_flows(
    tracked_numbers: set[str], transactions: list[Transaction]
) -> list[dict]:
    """Money in/out of the household per month, excluding internal transfers.

    A transaction counts only when exactly one side is a tracked account —
    transfers between two of our own accounts net to zero for the household
    and are skipped. Returns [{"month": "YYYY-MM", "income": D, "expense": D}]
    sorted by month; `expense` is a positive magnitude.
    """
    buckets: dict[str, dict[str, Decimal]] = {}
    for tx in transactions:
        from_tracked = tx.from_account in tracked_numbers
        to_tracked = tx.to_account in tracked_numbers
        if from_tracked == to_tracked:
            continue  # neither side, or both (internal transfer)
        month = tx.date.strftime("%Y-%m")
        bucket = buckets.setdefault(month, {"income": Decimal("0"), "expense": Decimal("0")})
        if to_tracked:
            bucket["income"] += abs(tx.amount)
        else:
            bucket["expense"] += abs(tx.amount)

    return [
        {"month": m, "income": buckets[m]["income"], "expense": buckets[m]["expense"]}
        for m in sorted(buckets)
    ]
