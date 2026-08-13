"""UN/LOCODE validation.

A UN/LOCODE is five characters: a 2-letter ISO 3166-1 country code plus a
3-character location code drawn from A-Z and the digits 2-9 (0 and 1 are
excluded by the standard to avoid confusion with O and I). Customarily
written with a space ("US BOS"); freightid accepts and drops it.

Country codes are checked against the embedded ISO 3166-1 alpha-2 set plus
the UNECE extensions XK and XZ that appear in the UN/LOCODE list itself.
Existence of the LOCATION is not checked -- that requires the UNECE
dataset, which is out of scope for v0.1 by design.

freightid checks format and country only -- never that the place exists.
"""

from __future__ import annotations

import re

from .data import UNLOCODE_COUNTRIES

_PATTERN = re.compile(r"^[A-Z]{2}[A-Z2-9]{3}$")


def validate_unlocode(value: str) -> dict:
    normalized = re.sub(r"[\s\-\.]", "", str(value)).upper()
    detail = {}
    reason = None
    ok = False
    if not _PATTERN.match(normalized):
        reason = "bad_format"
    else:
        country, location = normalized[:2], normalized[2:]
        detail = {"country": country, "location": location}
        if country not in UNLOCODE_COUNTRIES:
            reason = "unknown_country"
        else:
            ok = True
    return {
        "input": value,
        "normalized": normalized,
        "valid": ok,
        "kind": "unlocode",
        "reason": reason,
        "detail": detail,
        "registration": "not_checked",
    }
