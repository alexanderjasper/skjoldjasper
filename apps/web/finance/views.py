import io
from datetime import date
from decimal import Decimal

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.db import transaction as db_transaction
from django.db.models import ProtectedError, Q, Sum
from django.http import HttpRequest, HttpResponse, HttpResponseForbidden
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from finance.defaults import seed_default_categories
from finance.forms import BudgetCreateForm, CategoryForm, HouseholdCreateForm, ImportCsvForm
from finance.importers.sydjysk import parse as parse_sydjysk
from finance.models import (
    Budget,
    Category,
    Household,
    Membership,
    Transaction,
    TransactionSplit,
)


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
def index(request: HttpRequest) -> HttpResponse:
    return redirect("finance:dashboard", year=date.today().year)


@login_required
def create_household(request: HttpRequest) -> HttpResponse:
    if _resolve_household(request) is not None:
        return redirect("finance:index")

    if request.method == "POST":
        form = HouseholdCreateForm(request.POST)
        if form.is_valid():
            with db_transaction.atomic():
                household = Household.objects.create(name=form.cleaned_data["name"])
                Membership.objects.create(household=household, user=request.user)
            return redirect("finance:index")
    else:
        form = HouseholdCreateForm()
    return render(request, "finance/create_household.html", {"form": form})


@login_required
def create_budget(request: HttpRequest, year: int) -> HttpResponse:
    household = _resolve_household(request)
    if household is None:
        return redirect("finance:create_household")

    if Budget.objects.filter(household=household, year=year).exists():
        return redirect("finance:dashboard", year=year)

    if request.method == "POST":
        form = BudgetCreateForm(request.POST)
        if form.is_valid():
            with db_transaction.atomic():
                budget = Budget.objects.create(household=household, year=year)
                if form.cleaned_data["seed_defaults"]:
                    seed_default_categories(budget)
            return redirect("finance:dashboard", year=year)
    else:
        form = BudgetCreateForm()
    return render(request, "finance/create_budget.html", {"form": form, "year": year})


@login_required
def dashboard(request: HttpRequest, year: int) -> HttpResponse:
    household = _resolve_household(request)
    if household is None:
        return redirect("finance:create_household")

    budget = Budget.objects.filter(household=household, year=year).first()
    if budget is None:
        return redirect("finance:create_budget", year=year)

    categories = list(
        Category.objects.filter(budget=budget)
        .annotate(
            actual=Sum(
                "splits__amount",
                filter=Q(splits__transaction__date__year=year),
            )
        )
        .order_by("sort_order", "name")
    )

    by_id = {c.id: c for c in categories}
    for c in categories:
        c.children_list = []
    for c in categories:
        if c.parent_id:
            by_id[c.parent_id].children_list.append(c)
    roots = [c for c in categories if c.parent_id is None]

    for r in roots:
        _aggregate_category(r)

    income_target = sum((r.target_total for r in roots if r.target_total > 0), Decimal("0"))
    income_actual = sum((r.actual for r in roots if r.target_total > 0), Decimal("0"))
    expense_target = sum((r.target_total for r in roots if r.target_total < 0), Decimal("0"))
    expense_actual = sum((r.actual for r in roots if r.target_total < 0), Decimal("0"))

    return render(
        request,
        "finance/budget_dashboard.html",
        {
            "year": year,
            "budget": budget,
            "roots": roots,
            "income_target": income_target,
            "income_actual": income_actual,
            "expense_target": expense_target,
            "expense_actual": expense_actual,
            "net_target": income_target + expense_target,
            "net_actual": income_actual + expense_actual,
        },
    )


def _aggregate_category(cat: Category) -> None:
    """Roll up actual/target/deviation from leaves to groups, in place."""
    if not cat.children_list:
        cat.actual = cat.actual or Decimal("0")
        cat.target_total = cat.yearly_target or Decimal("0")
    else:
        for child in cat.children_list:
            _aggregate_category(child)
        cat.actual = sum((c.actual for c in cat.children_list), Decimal("0"))
        cat.target_total = sum((c.target_total for c in cat.children_list), Decimal("0"))
    if cat.target_total:
        cat.deviation_pct = (cat.actual - cat.target_total) / abs(cat.target_total) * 100
    else:
        cat.deviation_pct = None


@login_required
def category_tree(request: HttpRequest, year: int) -> HttpResponse:
    household = _resolve_household(request)
    if household is None:
        return redirect("finance:create_household")
    budget = Budget.objects.filter(household=household, year=year).first()
    if budget is None:
        return redirect("finance:create_budget", year=year)

    categories = list(
        Category.objects.filter(budget=budget).order_by("sort_order", "name")
    )
    by_id = {c.id: c for c in categories}
    for c in categories:
        c.children_list = []
    for c in categories:
        if c.parent_id:
            by_id[c.parent_id].children_list.append(c)
    roots = [c for c in categories if c.parent_id is None]

    edit_pk = _int_or_none(request.GET.get("edit"))
    new_under = request.GET.get("new")  # "root" or a pk string
    new_parent_id = _int_or_none(new_under) if new_under != "root" else None
    show_new_root = new_under == "root"

    edit_form = None
    if edit_pk and edit_pk in by_id:
        edit_form = CategoryForm(instance=by_id[edit_pk], budget=budget)

    new_form = None
    if new_under is not None:
        initial = {}
        if new_parent_id and new_parent_id in by_id:
            initial["parent"] = by_id[new_parent_id]
        new_form = CategoryForm(initial=initial, budget=budget)

    return render(
        request,
        "finance/category_tree.html",
        {
            "year": year,
            "budget": budget,
            "roots": roots,
            "edit_pk": edit_pk,
            "edit_form": edit_form,
            "new_form": new_form,
            "new_parent_id": new_parent_id,
            "show_new_root": show_new_root,
        },
    )


def _int_or_none(value: str | None) -> int | None:
    if value is None or not value.isdigit():
        return None
    return int(value)


@login_required
@require_POST
def category_create(request: HttpRequest, year: int) -> HttpResponse:
    household = _resolve_household(request)
    if household is None:
        return HttpResponseForbidden()
    budget = get_object_or_404(Budget, household=household, year=year)

    form = CategoryForm(request.POST, budget=budget)
    if form.is_valid():
        cat = form.save(commit=False)
        cat.budget = budget
        try:
            cat.full_clean()
            cat.save()
            messages.success(request, f"Added {cat.name}.")
        except ValidationError as e:
            messages.error(request, "; ".join(_flatten_errors(e)))
    else:
        messages.error(request, "; ".join(_flatten_errors(form.errors)))
    return redirect("finance:category_tree", year=year)


@login_required
@require_POST
def category_update(request: HttpRequest, year: int, pk: int) -> HttpResponse:
    household = _resolve_household(request)
    if household is None:
        return HttpResponseForbidden()
    budget = get_object_or_404(Budget, household=household, year=year)
    cat = get_object_or_404(Category, pk=pk, budget=budget)

    form = CategoryForm(request.POST, instance=cat, budget=budget)
    if form.is_valid():
        cat = form.save(commit=False)
        try:
            cat.full_clean()
            cat.save()
            messages.success(request, f"Updated {cat.name}.")
        except ValidationError as e:
            messages.error(request, "; ".join(_flatten_errors(e)))
    else:
        messages.error(request, "; ".join(_flatten_errors(form.errors)))
    return redirect("finance:category_tree", year=year)


@login_required
@require_POST
def category_delete(request: HttpRequest, year: int, pk: int) -> HttpResponse:
    household = _resolve_household(request)
    if household is None:
        return HttpResponseForbidden()
    budget = get_object_or_404(Budget, household=household, year=year)
    cat = get_object_or_404(Category, pk=pk, budget=budget)

    if cat.children.exists():
        messages.error(
            request, f"{cat.name} has subcategories — delete or move them first."
        )
    else:
        try:
            name = cat.name
            cat.delete()
            messages.success(request, f"Deleted {name}.")
        except ProtectedError:
            messages.error(
                request,
                f"{cat.name} has transactions assigned — reassign them first.",
            )
    return redirect("finance:category_tree", year=year)


def _flatten_errors(errors) -> list[str]:
    """Pull message strings out of a ValidationError or form.errors dict."""
    if isinstance(errors, ValidationError):
        return list(errors.messages)
    out: list[str] = []
    for field, errs in errors.items():
        prefix = "" if field == "__all__" else f"{field}: "
        out.extend(f"{prefix}{e}" for e in errs)
    return out


@login_required
def import_form(request: HttpRequest) -> HttpResponse:
    household = _resolve_household(request)
    if household is None:
        return redirect("finance:create_household")

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
        return redirect("finance:create_household")

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

    return _render_tx_row(request, household, tx)


@login_required
def transaction_split(request: HttpRequest, pk: int) -> HttpResponse:
    """GET → render the multi-split editor row. POST → save split list."""
    household = _resolve_household(request)
    if household is None:
        return HttpResponseForbidden()
    tx = get_object_or_404(Transaction, pk=pk, household=household)
    budget = Budget.objects.filter(household=household, year=tx.date.year).first()
    leaves = _leaves_for_budget(budget)

    if request.method == "POST":
        category_ids = request.POST.getlist("category")
        amounts = request.POST.getlist("amount")
        lines: list[tuple[Category, Decimal]] = []
        total = Decimal("0")
        try:
            for cid, amt in zip(category_ids, amounts):
                if not cid or amt == "":
                    continue
                category = leaves.get(pk=cid)
                value = Decimal(amt)
                lines.append((category, value))
                total += value
            if not lines:
                raise ValueError("at least one split is required")
            TransactionSplit.validate_total(tx, total)
        except (ValueError, ArithmeticError, Category.DoesNotExist, ValidationError) as e:
            messages.error(request, f"Could not save splits: {e}")
            return _render_split_editor(request, tx, leaves, _post_lines(category_ids, amounts))

        with db_transaction.atomic():
            tx.splits.all().delete()
            for category, value in lines:
                TransactionSplit.objects.create(
                    transaction=tx, category=category, amount=value
                )
        return _render_tx_row(request, household, tx)

    existing = [(str(s.category_id), str(s.amount)) for s in tx.splits.all()]
    if not existing:
        existing = [("", "")]
    return _render_split_editor(request, tx, leaves, existing)


@login_required
def transaction_split_line(request: HttpRequest, pk: int) -> HttpResponse:
    """Return a single empty split line fragment for HTMX append."""
    household = _resolve_household(request)
    if household is None:
        return HttpResponseForbidden()
    tx = get_object_or_404(Transaction, pk=pk, household=household)
    budget = Budget.objects.filter(household=household, year=tx.date.year).first()
    return render(
        request,
        "finance/_split_line.html",
        {"leaves": _leaves_for_budget(budget), "category_id": "", "amount": ""},
    )


@login_required
def transaction_row(request: HttpRequest, pk: int) -> HttpResponse:
    """Render the display row for a transaction (used by split-editor Cancel)."""
    household = _resolve_household(request)
    if household is None:
        return HttpResponseForbidden()
    tx = get_object_or_404(Transaction, pk=pk, household=household)
    return _render_tx_row(request, household, tx)


def _render_tx_row(request, household, tx):
    budget = Budget.objects.filter(household=household, year=tx.date.year).first()
    tx.refresh_from_db()
    return render(
        request,
        "finance/transaction_row.html",
        {"tx": tx, "leaves": _leaves_for_budget(budget)},
    )


def _render_split_editor(request, tx, leaves, lines):
    return render(
        request,
        "finance/transaction_split_row.html",
        {"tx": tx, "leaves": leaves, "lines": lines},
    )


def _post_lines(category_ids, amounts):
    """Zip POSTed category/amount lists for re-render on validation error."""
    pairs = list(zip(category_ids, amounts))
    return pairs or [("", "")]
