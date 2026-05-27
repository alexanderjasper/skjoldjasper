from decimal import Decimal

from django.test import TestCase

from finance.forms import CategoryForm
from finance.models import Budget, Category, Household


class CategoryFormTests(TestCase):
    def setUp(self):
        self.household = Household.objects.create(name="Test")
        self.budget = Budget.objects.create(household=self.household, year=2026)
        self.parent = Category.objects.create(
            budget=self.budget, name="Udgifter", sort_order=0
        )

    def test_can_create_child_category(self):
        """Regression: budget isn't a form field, so the instance's budget must
        be bound before validation or Category.clean() rejects the parent as
        belonging to a different budget."""
        form = CategoryForm(
            {
                "name": "Mad",
                "parent": str(self.parent.id),
                "sort_order": "0",
                "yearly_target": "",
            },
            budget=self.budget,
        )
        self.assertTrue(form.is_valid(), form.errors)
        cat = form.save()
        self.assertEqual(cat.parent_id, self.parent.id)
        self.assertEqual(cat.budget_id, self.budget.id)

    def test_can_create_top_level_category(self):
        form = CategoryForm(
            {"name": "Indtægter", "parent": "", "sort_order": "1", "yearly_target": ""},
            budget=self.budget,
        )
        self.assertTrue(form.is_valid(), form.errors)
        cat = form.save()
        self.assertIsNone(cat.parent_id)

    def test_leaf_target_then_child_is_rejected(self):
        """A category with a yearly_target may not gain children."""
        leaf = Category.objects.create(
            budget=self.budget, name="Realkredit", yearly_target=Decimal("-83400")
        )
        form = CategoryForm(
            {"name": "Sub", "parent": str(leaf.id), "sort_order": "0", "yearly_target": ""},
            budget=self.budget,
        )
        self.assertFalse(form.is_valid())
        self.assertIn("parent", form.errors)
