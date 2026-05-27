from django.urls import path

from finance import views

app_name = "finance"

urlpatterns = [
    path("", views.index, name="index"),
    path("create-household/", views.create_household, name="create_household"),
    path("<int:year>/", views.dashboard, name="dashboard"),
    path("<int:year>/create-budget/", views.create_budget, name="create_budget"),
    path("<int:year>/categories/", views.category_tree, name="category_tree"),
    path(
        "<int:year>/categories/new/",
        views.category_create,
        name="category_create",
    ),
    path(
        "<int:year>/categories/<int:pk>/",
        views.category_update,
        name="category_update",
    ),
    path(
        "<int:year>/categories/<int:pk>/delete/",
        views.category_delete,
        name="category_delete",
    ),
    path("overview/", views.overview, name="overview"),
    path("accounts/", views.accounts, name="accounts"),
    path("accounts/create/", views.account_create, name="account_create"),
    path("accounts/<int:pk>/", views.account_update, name="account_update"),
    path("import/", views.import_form, name="import"),
    path("<int:year>/transactions/", views.transaction_list, name="transactions"),
    path(
        "transactions/<int:pk>/categorize/",
        views.transaction_categorize,
        name="categorize",
    ),
    path("transactions/<int:pk>/split/", views.transaction_split, name="split"),
    path(
        "transactions/<int:pk>/split/line/",
        views.transaction_split_line,
        name="split_line",
    ),
    path("transactions/<int:pk>/row/", views.transaction_row, name="row"),
]
