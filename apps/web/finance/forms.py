from django import forms

from finance.models import Category


class ImportCsvForm(forms.Form):
    file = forms.FileField(label="Posteringsdetaljer.csv")


class HouseholdCreateForm(forms.Form):
    name = forms.CharField(
        max_length=100,
        label="Household name",
        widget=forms.TextInput(attrs={"placeholder": "e.g. Skjold Jasper"}),
    )


class BudgetCreateForm(forms.Form):
    seed_defaults = forms.BooleanField(
        required=False,
        initial=True,
        label="Seed default category tree "
        "(Indtægter / Udgifter with Bolig, Forsikring, Husholdning, …)",
    )


class CategoryForm(forms.ModelForm):
    """Add/edit a category inside one budget.

    The `budget` kwarg scopes parent choices and lets us exclude self +
    descendants from the parent dropdown when editing (preventing cycles).
    """

    class Meta:
        model = Category
        fields = ["name", "parent", "sort_order", "yearly_target"]

    def __init__(self, *args, budget=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["parent"].required = False
        self.fields["parent"].empty_label = "— top-level —"
        if budget is not None:
            # `budget` isn't a form field, so bind it to the instance now —
            # otherwise Category.clean() runs during form validation with
            # budget_id=None and wrongly rejects a parent as "different budget".
            self.instance.budget = budget
            qs = Category.objects.filter(budget=budget)
            if self.instance.pk:
                qs = qs.exclude(pk__in=_descendant_ids(self.instance))
            self.fields["parent"].queryset = qs.order_by("sort_order", "name")


def _descendant_ids(cat: Category) -> set[int]:
    ids = {cat.pk}
    for child in cat.children.all():
        ids |= _descendant_ids(child)
    return ids
