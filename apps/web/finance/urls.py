from django.urls import path

from finance import views

app_name = "finance"

urlpatterns = [
    path("", views.index, name="index"),
    path("create-household/", views.create_household, name="create_household"),
    path("<int:year>/", views.dashboard, name="dashboard"),
    path("import/", views.import_form, name="import"),
    path("<int:year>/transactions/", views.transaction_list, name="transactions"),
    path(
        "transactions/<int:pk>/categorize/",
        views.transaction_categorize,
        name="categorize",
    ),
]
