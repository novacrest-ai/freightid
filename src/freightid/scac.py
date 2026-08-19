"""SCAC (Standard Carrier Alpha Code) validation.

A SCAC is 2-4 uppercase letters. There is no check digit; validation is
format-level only. Suffix conventions (metadata, never affecting validity):
codes ending in U are conventionally freight-container owner codes, X
privately owned railcars, Z truck chassis/trailers.

freightid checks format only -- never NMFTA registration.
"""

from __future__ import annotations

import re

_PATTERN = re.compile(r"^[A-Z]{2,4}$")

_SUFFIX_HINTS = {
    "U": "container owner code convention",
    "X": "privately owned railcar convention",
    "Z": "truck chassis/trailer convention",
}


def validate_scac(value: str) -> dict:
    normalized = re.sub(r"[\s\-\.]", "", str(value)).upper()
    ok = bool(_PATTERN.match(normalized))
    detail = {}
    reason = None
    if ok:
        detail["suffix_hint"] = _SUFFIX_HINTS.get(normalized[-1])
    else:
        reason = "bad_format"
    return {
        "input": value,
        "normalized": normalized,
        "valid": ok,
        "kind": "scac",
        "reason": reason,
        "detail": detail,
        "registration": "not_checked",
    }
