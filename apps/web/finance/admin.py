from django.contrib import admin

from finance.models import Budget, Category, Household, Membership, Transaction, TransactionSplit


class MembershipInline(admin.TabularInline):
    model = Membership
    extra = 0
    autocomplete_fields = ["user"]


@admin.register(Household)
class HouseholdAdmin(admin.ModelAdmin):
    list_display = ["name", "created_at"]
    inlines = [MembershipInline]


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ["household", "user", "joined_at"]
    list_filter = ["household"]
    autocomplete_fields = ["user"]


@admin.register(Budget)
class BudgetAdmin(admin.ModelAdmin):
    list_display = ["year", "household", "created_at"]
    list_filter = ["household"]
    search_fields = ["year", "household__name"]


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ["__str__", "budget", "yearly_target", "sort_order"]
    list_filter = ["budget"]
    search_fields = ["name"]
    autocomplete_fields = ["parent", "budget"]


class TransactionSplitInline(admin.TabularInline):
    model = TransactionSplit
    extra = 0
    autocomplete_fields = ["category"]


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ["date", "amount", "description", "counterparty", "household"]
    list_filter = ["household", "date"]
    search_fields = ["description", "counterparty", "external_id"]
    date_hierarchy = "date"
    inlines = [TransactionSplitInline]
    readonly_fields = ["imported_at"]


@admin.register(TransactionSplit)
class TransactionSplitAdmin(admin.ModelAdmin):
    list_display = ["transaction", "category", "amount", "created_at"]
    list_filter = ["category__budget"]
    autocomplete_fields = ["transaction", "category"]
