from django import forms


class ImportCsvForm(forms.Form):
    file = forms.FileField(label="Posteringsdetaljer.csv")
