from django.urls import path

from finance import views

app_name = "finance"

urlpatterns = [
    path("import/", views.import_form, name="import"),
]
