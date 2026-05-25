import io

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db import transaction as db_transaction
from django.http import HttpRequest, HttpResponse, HttpResponseForbidden
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from finance.forms import ImportCsvForm
from finance.importers.sydjysk import parse as parse_sydjysk
from finance.models import Budget, Category, Household, Transaction, TransactionSplit


def _resolve_household(request: HttpRequest) -> Household | None:
    return Household.objects.filter(memberships__user=request.user).first()


def _leaves_for_budget(budget: Budget | None):
    """Leaf categories of `budget`, ordered by parent then own sort order.

    Returned ordering is compatible with `{% regroup … by parent.name %}` in
    templates so the dropdown can render <optgroup>s without extra work.
    """
    if budget is None:
        return Category.objects.none()
    return (
        Category.objects.filter(budget=budget, children__isnull=True)
        .select_related("parent")
        .order_by("parent__sort_order", "parent__name", "sort_order", "name")
    )


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


@login_required
def transaction_list(request: HttpRequest, year: int) -> HttpResponse:
    household = _resolve_household(request)
    if household is None:
        return render(request, "finance/no_household.html")

    transactions = Transaction.objects.filter(
        household=household, date__year=year
    ).prefetch_related("splits__category")

    status = request.GET.get("status", "all")
    if status == "uncategorized":
        transactions = transactions.filter(splits__isnull=True)
    elif status == "categorized":
        transactions = transactions.filter(splits__isnull=False).distinct()

    budget = Budget.objects.filter(household=household, year=year).first()

    return render(
        request,
        "finance/transaction_list.html",
        {
            "year": year,
            "transactions": transactions,
            "leaves": _leaves_for_budget(budget),
            "status": status,
            "budget": budget,
        },
    )


@login_required
@require_POST
def transaction_categorize(request: HttpRequest, pk: int) -> HttpResponse:
    household = _resolve_household(request)
    if household is None:
        return HttpResponseForbidden()

    tx = get_object_or_404(Transaction, pk=pk, household=household)
    category_id = request.POST.get("category") or ""

    with db_transaction.atomic():
        tx.splits.all().delete()
        if category_id:
            category = get_object_or_404(
                Category, pk=category_id, budget__household=household
            )
            split = TransactionSplit.objects.create(
                transaction=tx, category=category, amount=tx.amount
            )
            TransactionSplit.validate_total(tx, split.amount)

    budget = Budget.objects.filter(household=household, year=tx.date.year).first()
    tx.refresh_from_db()
    return render(
        request,
        "finance/transaction_row.html",
        {"tx": tx, "leaves": _leaves_for_budget(budget)},
    )
