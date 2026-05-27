from datetime import date
from decimal import Decimal

from django.test import TestCase

from finance.balances import account_balance_series, monthly_external_flows
from finance.models import Account, Household, Transaction


class BalanceSeriesTests(TestCase):
    def setUp(self):
        self.household = Household.objects.create(name="Test")
        self.acct = Account.objects.create(
            household=self.household,
            number="9740 0005415861",
            label="Savings",
            opening_balance=Decimal("1000"),
        )

    def _tx(self, d, amount, frm="", to=""):
        return Transaction.objects.create(
            household=self.household,
            date=d,
            amount=Decimal(amount),
            description="x",
            from_account=frm,
            to_account=to,
            external_id=f"{d}-{amount}-{frm}-{to}",
        )

    def test_received_adds_sent_subtracts(self):
        txs = [
            self._tx(date(2026, 1, 2), "500", to=self.acct.number),     # +500
            self._tx(date(2026, 1, 5), "-200", frm=self.acct.number),   # -200
        ]
        points, current = account_balance_series(self.acct, txs)
        self.assertEqual(current, Decimal("1300"))
        self.assertEqual(points[-1], (date(2026, 1, 5), Decimal("1300")))

    def test_sign_from_direction_not_stored_amount(self):
        # A received amount stored as negative (sender's leg perspective)
        # must still increase this account's balance.
        txs = [self._tx(date(2026, 1, 3), "-300", to=self.acct.number)]
        _, current = account_balance_series(self.acct, txs)
        self.assertEqual(current, Decimal("1300"))

    def test_opening_date_excludes_earlier_flows(self):
        self.acct.opening_date = date(2026, 2, 1)
        txs = [
            self._tx(date(2026, 1, 9), "999", to=self.acct.number),   # before → ignored
            self._tx(date(2026, 2, 4), "100", to=self.acct.number),   # counted
        ]
        _, current = account_balance_series(self.acct, txs)
        self.assertEqual(current, Decimal("1100"))

    def test_self_transfer_is_ignored(self):
        txs = [self._tx(date(2026, 1, 1), "50", frm=self.acct.number, to=self.acct.number)]
        _, current = account_balance_series(self.acct, txs)
        self.assertEqual(current, Decimal("1000"))

    def test_no_activity_returns_opening(self):
        _, current = account_balance_series(self.acct, [])
        self.assertEqual(current, Decimal("1000"))


class MonthlyFlowTests(TestCase):
    def setUp(self):
        self.household = Household.objects.create(name="Test")
        self.own_a = "9740 0005415861"
        self.own_b = "9740 0005415799"
        self.tracked = {self.own_a, self.own_b}

    def _tx(self, d, amount, frm="", to=""):
        return Transaction.objects.create(
            household=self.household, date=d, amount=Decimal(amount),
            description="x", from_account=frm, to_account=to,
            external_id=f"{d}-{amount}-{frm}-{to}",
        )

    def test_external_in_and_out_grouped_by_month(self):
        txs = [
            self._tx(date(2026, 1, 5), "5000", to=self.own_a),    # salary in
            self._tx(date(2026, 1, 20), "-1200", frm=self.own_a),  # bill out
            self._tx(date(2026, 2, 1), "5000", to=self.own_a),    # salary in
        ]
        flows = monthly_external_flows(self.tracked, txs)
        self.assertEqual(flows, [
            {"month": "2026-01", "income": Decimal("5000"), "expense": Decimal("1200")},
            {"month": "2026-02", "income": Decimal("5000"), "expense": Decimal("0")},
        ])

    def test_internal_transfer_excluded(self):
        txs = [self._tx(date(2026, 1, 5), "-2000", frm=self.own_a, to=self.own_b)]
        self.assertEqual(monthly_external_flows(self.tracked, txs), [])
