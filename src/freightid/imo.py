"""IMO ship number validation.

An IMO number is 7 digits, optionally prefixed "IMO". The check digit is
the last digit of (d1*7 + d2*6 + d3*5 + d4*4 + d5*3 + d6*2).

Weight arithmetic note (pinned in tests/test_properties.py): weights 7..2
mod 10 are not all coprime to 10, so certain single-digit mutations are
undetectable by design -- e.g. a delta of 2 at the weight-5 position, or a
delta of 5 at any even-weight position, leaves the checksum unchanged.

Scope: SHIP numbers only. IMO company/registered-owner numbers use a
different scheme and are out of scope for v0.1.

freightid checks math only -- never registration or vessel existence.
"""

from __future__ import annotations

import re

_PREFIX = re.compile(r"^IMO[\s\-]*", re.IGNORECASE)
WEIGHTS = (7, 6, 5, 4, 3, 2)


def _normalize(value: str) -> str:
    s = str(value).strip()
    s = _PREFIX.sub("", s)
    return re.sub(r"[\s\-\.]", "", s)


def _result(value, normalized, valid, reason, detail):
    return {
        "input": value,
        "normalized": normalized,
        "valid": valid,
        "kind": "imo_ship_number",
        "reason": reason,
        "detail": detail,
        "registration": "not_checked",
    }


def compute_check_digit(first_six: str) -> int:
    return sum(int(d) * w for d, w in zip(first_six, WEIGHTS)) % 10


def validate_imo(value: str) -> dict:
    """Validate an IMO ship number. Math only."""
    normalized = _normalize(value)
    if not re.match(r"^[0-9]{7}$", normalized):
        reason = "bad_length" if normalized.isdigit() else "bad_charset"
        if not normalized:
            reason = "bad_length"
        return _result(value, normalized, False, reason, {})
    expected = compute_check_digit(normalized[:6])
    given = int(normalized[6])
    detail = {"check_digit_expected": expected, "check_digit_given": given}
    if expected != given:
        return _result(value, normalized, False, "bad_check_digit", detail)
    return _result(value, normalized, True, None, detail)


def explain_imo(value: str) -> dict:
    """validate_imo plus the weighted-sum arithmetic as text."""
    out = validate_imo(value)
    n = out["normalized"]
    if not re.match(r"^[0-9]{7}$", n):
        return out
    terms = [f"{d}x{w}" for d, w in zip(n[:6], WEIGHTS)]
    total = sum(int(d) * w for d, w in zip(n[:6], WEIGHTS))
    out["detail"]["worked_example"] = (
        " + ".join(terms) + f" = {total}; last digit {total % 10}"
    )
    return out
