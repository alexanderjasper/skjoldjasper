"""Opinionated default category tree for new budgets.

Modeled after ~/Code/modellen's per-year budget.json structure — the
groups any Danish household ends up needing anyway. Leaves ship without
yearly targets so the user sees an obvious "fill me in" prompt in the
dashboard, not pre-baked numbers from someone else's life.
"""

from finance.models import Budget, Category

DEFAULT_TREE: list[dict] = [
    {
        "name": "Indtægter",
        "children": [
            {"name": "Løn A"},
            {"name": "Løn B"},
            {"name": "Børnepenge"},
        ],
    },
    {
        "name": "Udgifter",
        "children": [
            {
                "name": "Bolig",
                "children": [
                    {"name": "Realkredit"},
                    {"name": "Internet"},
                    {"name": "El"},
                    {"name": "Varme"},
                ],
            },
            {"name": "Husholdning", "children": [{"name": "Mad"}]},
            {
                "name": "Forsikring",
                "children": [
                    {"name": "Bil"},
                    {"name": "Hus"},
                    {"name": "Indbo"},
                ],
            },
            {"name": "Kontingenter", "children": [{"name": "A-kasse"}]},
            {"name": "Transport", "children": [{"name": "Tog"}]},
            {
                "name": "Variable",
                "children": [
                    {"name": "Ferie"},
                    {"name": "Diverse"},
                ],
            },
        ],
    },
]


def seed_default_categories(budget: Budget) -> None:
    """Build DEFAULT_TREE under `budget`. Idempotent only at the budget level —
    caller must check the budget has no categories yet."""

    def create(items: list[dict], parent: Category | None) -> None:
        for i, item in enumerate(items):
            cat = Category.objects.create(
                budget=budget,
                parent=parent,
                name=item["name"],
                sort_order=i,
            )
            if "children" in item:
                create(item["children"], parent=cat)

    create(DEFAULT_TREE, parent=None)
