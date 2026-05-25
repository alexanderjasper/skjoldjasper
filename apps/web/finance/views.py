import io

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import HttpRequest, HttpResponse
from django.shortcuts import redirect, render

from finance.forms import ImportCsvForm
from finance.importers.sydjysk import parse as parse_sydjysk
from finance.models import Household, Transaction


def _resolve_household(request: HttpRequest) -> Household | None:
    return Household.objects.filter(memberships__user=request.user).first()


@login_required
def import_form(request: HttpRequest) -> HttpResponse:
    household = _resolve_household(request)
    if household is None:
        return render(request, "finance/no_household.html")

    if request.method == "POST":
        form = ImportCsvForm(request.POST, request.FILES)
        if form.is_valid():
            stream = io.TextIOWrapper(form.cleaned_data["file"].file, encoding="utf-8")
            new = dup = 0
            for row in parse_sydjysk(stream):
                _, created = Transaction.objects.get_or_create(
                    household=household,
                    external_id=row["external_id"],
                    defaults=row,
                )
                if created:
                    new += 1
                else:
                    dup += 1
            messages.success(
                request, f"Imported {new} new, skipped {dup} duplicates."
            )
            return redirect("finance:import")
    else:
        form = ImportCsvForm()

    return render(request, "finance/import_form.html", {"form": form})
