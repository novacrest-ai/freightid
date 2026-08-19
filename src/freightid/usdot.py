"""USDOT and MC (motor carrier docket) number validation.

Neither identifier carries a check digit; validation is format-level only
(1-8 digits after stripping the customary prefixes). freightid says so
plainly rather than manufacturing certainty.

freightid checks format only -- never FMCSA registration or authority.
"""

from __future__ import annotations

import re

_DOT_PREFIX = re.compile(r"^(USDOT|DOT)[\s\-\.#:]*", re.IGNORECASE)
_MC_PREFIX = re.compile(r"^(MC)[\s\-\.#:]*", re.IGNORECASE)
_DIGITS = re.compile(r"^[0-9]{1,8}$")


def _validate(value: str, kind: str, prefix_re) -> dict:
    s = str(value).strip()
    s = prefix_re.sub("", s)
    normalized = re.sub(r"[\s\-\.,]", "", s)
    ok = bool(_DIGITS.match(normalized))
    return {
        "input": value,
        "normalized": normalized,
        "valid": ok,
        "kind": kind,
        "reason": None if ok else "bad_format",
        "detail": {"note": "no check digit exists for this identifier"},
        "registration": "not_checked",
    }


def validate_usdot(value: str) -> dict:
    return _validate(value, "usdot_number", _DOT_PREFIX)


def validate_mc(value: str) -> dict:
    return _validate(value, "mc_number", _MC_PREFIX)
