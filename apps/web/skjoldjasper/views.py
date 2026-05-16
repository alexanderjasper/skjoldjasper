from django.http import HttpRequest, HttpResponse


def home(_request: HttpRequest) -> HttpResponse:
    return HttpResponse(
        "<!doctype html><meta charset='utf-8'><title>skjoldjasper.dk</title>"
        "<h1>skjoldjasper.dk</h1><p>Under construction.</p>",
        content_type="text/html; charset=utf-8",
    )
