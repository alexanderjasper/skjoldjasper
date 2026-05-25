from django.contrib import admin

from finance.models import Budget, Category, Household, Membership


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
