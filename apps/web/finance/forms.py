from django import forms


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
