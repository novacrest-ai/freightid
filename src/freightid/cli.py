"""freightid CLI: detect-and-report.

    freightid CSQU3054383            auto-detects the kind, prints JSON
    freightid --kind imo 9321483     force a kind
    freightid --explain CSQU3054383  include the worked arithmetic

Exit codes: 0 valid, 1 invalid, 2 unrecognized input.
"""

from __future__ import annotations

import argparse
import json
import re
import sys

from . import (
    validate_container, explain_container,
    validate_imo, explain_imo,
    validate_scac, validate_unlocode, validate_usdot, validate_mc,
)

_VALIDATORS = {
    "container": (validate_container, explain_container),
    "imo": (validate_imo, explain_imo),
    "unlocode": (validate_unlocode, None),
    "scac": (validate_scac, None),
    "usdot": (validate_usdot, None),
    "mc": (validate_mc, None),
}


def _detect(value: str):
    """Try kinds in spec order; return the first structurally plausible match."""
    stripped = re.sub(r"[\s\-\.]", "", value).upper()
    if re.match(r"^[A-Z]{4}[0-9]{7}$", stripped):
        return "container"
    if re.match(r"^(IMO)?[0-9]{7}$", stripped):
        return "imo"
    if re.match(r"^[A-Z]{2}[A-Z2-9]{3}$", stripped) and not stripped.isalpha():
        return "unlocode"
    if re.match(r"^[A-Z]{5}$", stripped):
        # five letters: could be UN/LOCODE or nothing; try unlocode first
        return "unlocode"
    if re.match(r"^[A-Z]{2,4}$", stripped):
        return "scac"
    if re.match(r"^(USDOT|DOT)?[0-9]{1,8}$", stripped):
        return "usdot"
    if re.match(r"^MC[0-9]{1,8}$", stripped):
        return "mc"
    return None


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        prog="freightid",
        description="Validate logistics identifiers. Checks math, not registration.",
    )
    parser.add_argument("value", help="identifier to validate")
    parser.add_argument("--kind", choices=sorted(_VALIDATORS),
                        help="force a specific identifier kind")
    parser.add_argument("--explain", action="store_true",
                        help="include worked check-digit arithmetic where available")
    args = parser.parse_args(argv)

    kind = args.kind or _detect(args.value)
    if kind is None:
        print(json.dumps({"input": args.value, "valid": False,
                          "reason": "unrecognized_format"}, indent=2))
        return 2

    validate, explain = _VALIDATORS[kind]
    fn = explain if (args.explain and explain) else validate
    result = fn(args.value)
    # SCAC fallback: five letters that failed unlocode country check
    if kind == "unlocode" and not result["valid"] and args.kind is None:
        alt = validate_scac(args.value)
        if alt["valid"]:
            result = alt
    print(json.dumps(result, indent=2))
    return 0 if result["valid"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
