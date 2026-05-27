from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class Household(models.Model):
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.name


class Membership(models.Model):
    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships"
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("household", "user")]

    def __str__(self) -> str:
        return f"{self.user} in {self.household}"


class Budget(models.Model):
    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name="budgets")
    year = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("household", "year")]
        ordering = ["-year"]

    def __str__(self) -> str:
        return f"Budget {self.year}"


class Account(models.Model):
    """A bank account number seen in imported transactions, with a
    human label and an opening balance so balances over time can be
    reconstructed from flows (the bank export carries no running balance).

    `tracked` accounts are our own accounts: they get a balance series and
    count toward net worth. Untracked numbers are counterparties/externals.
    """

    household = models.ForeignKey(
        Household, on_delete=models.CASCADE, related_name="accounts"
    )
    number = models.CharField(max_length=64, help_text="As it appears in the bank CSV.")
    label = models.CharField(max_length=100, blank=True)
    tracked = models.BooleanField(
        default=True,
        help_text="One of our own accounts — include in balances and net worth.",
    )
    opening_balance = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0"),
        help_text="Balance as of the opening date (or all-time if no date).",
    )
    opening_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date the opening balance applies to; flows on/after it accrue.",
    )
    sort_order = models.IntegerField(default=0)

    class Meta:
        unique_together = [("household", "number")]
        ordering = ["sort_order", "label", "number"]

    def __str__(self) -> str:
        return self.label or self.number


class Category(models.Model):
    """Self-referential tree. Leaves have yearly_target; groups don't."""

    budget = models.ForeignKey(Budget, on_delete=models.CASCADE, related_name="categories")
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.CASCADE, related_name="children"
    )
    name = models.CharField(max_length=100)
    sort_order = models.IntegerField(default=0)
    yearly_target = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Signed: positive = income, negative = expense. Leaf categories only.",
    )

    class Meta:
        ordering = ["sort_order", "name"]
        verbose_name_plural = "categories"

    def __str__(self) -> str:
        if self.parent_id:
            return f"{self.parent} › {self.name}"
        return self.name

    def clean(self) -> None:
        super().clean()
        # A category may only carry yearly_target when it has no children.
        if (
            self.yearly_target is not None
            and self.pk is not None
            and self.children.exists()
        ):
            raise ValidationError(
                {"yearly_target": "yearly_target may only be set on leaf categories."}
            )
        # And you can't add children to a category that already has a target.
        if self.parent_id is not None and self.parent.yearly_target is not None:
            raise ValidationError(
                {"parent": "Parent category has a yearly_target; clear it before adding children."}
            )
        # Tree must stay within one budget.
        if self.parent_id is not None and self.parent.budget_id != self.budget_id:
            raise ValidationError({"parent": "Parent category must belong to the same budget."})


class Transaction(models.Model):
    household = models.ForeignKey(
        Household, on_delete=models.CASCADE, related_name="transactions"
    )
    date = models.DateField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.CharField(max_length=500)
    note = models.TextField(blank=True)
    from_account = models.CharField(max_length=64, blank=True)
    to_account = models.CharField(max_length=64, blank=True)
    counterparty = models.CharField(max_length=200, blank=True)
    external_id = models.CharField(max_length=100)
    raw = models.JSONField(default=list, blank=True)
    imported_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("household", "external_id")]
        ordering = ["-date", "-id"]

    def __str__(self) -> str:
        return f"{self.date} {self.amount} {self.description[:40]}"


class TransactionSplit(models.Model):
    transaction = models.ForeignKey(
        Transaction, on_delete=models.CASCADE, related_name="splits"
    )
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="splits")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.transaction} → {self.category} ({self.amount})"

    @classmethod
    def validate_total(cls, transaction: Transaction, total: Decimal) -> None:
        if abs(total - transaction.amount) > Decimal("0.01"):
            raise ValidationError(
                f"splits total {total} does not match transaction amount "
                f"{transaction.amount}"
            )
