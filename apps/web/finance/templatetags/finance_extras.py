from decimal import Decimal

from django import template
from django.utils.safestring import mark_safe

register = template.Library()


@register.filter
def money(value) -> str:
    """Danish-style thousands grouping, no decimals — matches modellen's
    markdown reports. None or 0 renders as blank for visual quiet."""
    if value is None or value == "":
        return ""
    try:
        v = Decimal(value)
    except (TypeError, ValueError):
        return str(value)
    if v == 0:
        return ""
    return f"{v:,.0f}".replace(",", ".")


@register.filter
def deviation(pct) -> str:
    """Format a signed % with sign; bold when |pct| > 20."""
    if pct is None:
        return ""
    try:
        p = Decimal(pct)
    except (TypeError, ValueError):
        return str(pct)
    rendered = f"{p:+.0f}%"
    if abs(p) > 20:
        return mark_safe(f"<strong>{rendered}</strong>")
    return rendered
