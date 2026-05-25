from datetime import date
from decimal import Decimal
from io import StringIO
from pathlib import Path

from django.test import SimpleTestCase

from finance.importers.sydjysk import parse

FIXTURES = Path(__file__).parent / "fixtures"


class SydjyskImporterTest(SimpleTestCase):
    def test_parses_fixture_three_rows(self):
        with open(FIXTURES / "sydjysk_sample.csv", encoding="utf-8") as f:
            rows = list(parse(f))
        self.assertEqual(len(rows), 3)

    def test_first_row_is_positive_salary_with_bank_id(self):
        with open(FIXTURES / "sydjysk_sample.csv", encoding="utf-8") as f:
            row = next(parse(f))
        self.assertEqual(row["date"], date(2026, 4, 1))
        self.assertEqual(row["amount"], Decimal("33701.67"))
        self.assertEqual(row["description"], "A løn marts")
        self.assertEqual(row["external_id"], "8185184253")
        self.assertEqual(row["to_account"], "9740 0005415861")

    def test_negative_danish_amount(self):
        csv = (
            "DET FAGLIGE HUS;DET FAGLIGE HUS;9740 0005415861;;-1.791,00;;;"
            "01-04-2026;01-04-2026;01-04-2026;01-04-2026;0335589872;\n"
        )
        row = next(parse(StringIO(csv)))
        self.assertEqual(row["amount"], Decimal("-1791.00"))

    def test_falls_back_when_external_id_missing(self):
        # col 10 (dispositionsdato) empty, falls back to col 8 (bogført).
        # col 11 (tx id) empty, falls back to SHA-256 hash.
        csv = (
            "Manual cash;Manual cash;9740 0005415861;;-500,00;Cash;;"
            "15-03-2026;15-03-2026;;;;\n"
        )
        row = next(parse(StringIO(csv)))
        self.assertEqual(row["date"], date(2026, 3, 15))
        self.assertEqual(len(row["external_id"]), 16)
        self.assertTrue(all(c in "0123456789abcdef" for c in row["external_id"]))

    def test_skips_short_rows(self):
        self.assertEqual(list(parse(StringIO("too;short\n"))), [])

    def test_raw_holds_original_row(self):
        with open(FIXTURES / "sydjysk_sample.csv", encoding="utf-8") as f:
            row = next(parse(f))
        self.assertEqual(row["raw"][11], "8185184253")
