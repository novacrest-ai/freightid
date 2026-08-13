"""ISO 6346 container number validation.

An ISO 6346 container number is 11 characters: a 3-letter owner code,
a 1-letter equipment category (U, J or Z), a 6-digit serial and a check digit.

Check digit: each of the first 10 characters maps to a numeric value
(letters run A=10..Z=38 skipping multiples of 11; digits are face value),
is weighted by 2**position (position 0-9 left to right), summed, and the
sum mod 11 gives the check digit -- with the special rule that a remainder
of 10 maps to 0. Serials producing remainder 10 are discouraged by the
standard but exist in the wild, so remainder 10 -> check digit 0 must
be accepted.

Known standard weaknesses (documented, not bugs):
1) Letter substitutions whose value delta is a multiple of 11
   (A<->K, B<->L, C<->M, ...) leave the mod-11 sum unchanged and are
   undetectable by design.
2) The remainder-10 -> 0 fold: remainders 0 and 10 both map to check
   digit 0, so any single-character mutation that moves the remainder
   BETWEEN 0 and 10 is also undetectable. This ambiguity is exactly why
   the standard discourages serials whose remainder is 10.
All other single-character mutations are caught (weights 2^0..2^9 are
distinct and non-zero mod 11). tests/test_properties.py pins these
boundaries exactly.

freightid checks math and format only -- never registration. A valid
check digit does not mean the container exists.
"""

from __future__ import annotations

import re

# Letter values per ISO 6346: 10..38 skipping multiples of 11 (11, 22, 33).
LETTER_VALUES = {
    "A": 10, "B": 12, "C": 13, "D": 14, "E": 15, "F": 16, "G": 17,
    "H": 18, "I": 19, "J": 20, "K": 21, "L": 23, "M": 24, "N": 25,
    "O": 26, "P": 27, "Q": 28, "R": 29, "S": 30, "T": 31, "U": 32,
    "V": 34, "W": 35, "X": 36, "Y": 37, "Z": 38,
}

CATEGORY_MEANINGS = {
    "U": "freight container",
    "J": "detachable freight container-related equipment",
    "Z": "trailer or chassis",
}

_PATTERN = re.compile(r"^[A-Z]{4}[0-9]{7}$")


def _normalize(value: str) -> str:
    return re.sub(r"[\s\-\.]", "", str(value)).upper()


def _char_value(ch: str) -> int:
    return LETTER_VALUES[ch] if ch.isalpha() else int(ch)


def _result(value, normalized, valid, reason, detail):
    return {
        "input": value,
        "normalized": normalized,
        "valid": valid,
        "kind": "iso6346_container",
        "reason": reason,
        "detail": detail,
        "registration": "not_checked",
    }


def compute_check_digit(first_ten: str) -> int:
    """Check digit for the first 10 characters (4 letters + 6 digits)."""
    total = sum(_char_value(ch) * (2 ** i) for i, ch in enumerate(first_ten))
    return (total % 11) % 10  # remainder 10 maps to 0


def validate_container(value: str) -> dict:
    """Validate an ISO 6346 container number. Math and format only."""
    normalized = _normalize(value)
    if len(normalized) != 11:
        return _result(value, normalized, False, "bad_length", {})
    if not _PATTERN.match(normalized):
        return _result(value, normalized, False, "bad_charset", {})
    category = normalized[3]
    if category not in CATEGORY_MEANINGS:
        return _result(value, normalized, False, "bad_category",
                       {"category": category})
    expected = compute_check_digit(normalized[:10])
    given = int(normalized[10])
    detail = {
        "owner": normalized[:3],
        "category": category,
        "category_meaning": CATEGORY_MEANINGS[category],
        "serial": normalized[4:10],
        "check_digit_expected": expected,
        "check_digit_given": given,
    }
    if expected != given:
        return _result(value, normalized, False, "bad_check_digit", detail)
    return _result(value, normalized, True, None, detail)


def explain_container(value: str) -> dict:
    """validate_container plus the full weighted-sum arithmetic as text."""
    out = validate_container(value)
    normalized = out["normalized"]
    if out["reason"] in ("bad_length", "bad_charset"):
        return out
    terms = []
    total = 0
    for i, ch in enumerate(normalized[:10]):
        v = _char_value(ch)
        w = 2 ** i
        terms.append(f"{ch}({v})x{w}")
        total += v * w
    remainder = total % 11
    check = remainder % 10
    worked = (
        " + ".join(terms)
        + f" = {total}; {total} mod 11 = {remainder}"
        + (f" -> check digit {check} (remainder 10 maps to 0)"
           if remainder == 10 else f" -> check digit {check}")
    )
    out["detail"]["worked_example"] = worked
    return out
