"""Known-good vectors from freightid-spec.md — the arbiter of artifact quality.

Runs under pytest or directly: python3 tests/test_vectors.py
Never modify a vector. If one seems wrong, stop and report.
"""

import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))

from freightid import (  # noqa: E402
    validate_container, explain_container,
    validate_imo, explain_imo,
    validate_scac, validate_unlocode, validate_usdot, validate_mc,
)


def test_container_canonical_valid():
    r = validate_container("CSQU3054383")
    assert r["valid"] is True
    assert r["detail"]["check_digit_expected"] == 3
    assert r["detail"]["owner"] == "CSQ"
    assert r["detail"]["category"] == "U"
    assert r["registration"] == "not_checked"


def test_container_canonical_worked_math():
    r = explain_container("CSQU3054383")
    assert "= 6185; 6185 mod 11 = 3" in r["detail"]["worked_example"]


def test_container_bad_check_digit():
    r = validate_container("CSQU3054384")
    assert r["valid"] is False
    assert r["reason"] == "bad_check_digit"


def test_container_normalization():
    assert validate_container("csqu 305438-3")["valid"] is True
    assert validate_container("csqu 305438-3")["normalized"] == "CSQU3054383"


def test_container_bad_category():
    # 4th char must be U, J or Z
    r = validate_container("CSQA3054383")
    assert r["valid"] is False
    assert r["reason"] == "bad_category"


def test_container_bad_length_and_charset():
    assert validate_container("CSQU305438")["reason"] == "bad_length"
    assert validate_container("CSQU30543!3")["reason"] == "bad_charset"


def test_imo_documentation_example():
    r = validate_imo("IMO 9074729")
    assert r["valid"] is True  # 63+0+35+16+21+4 = 139 -> 9


def test_imo_emma_maersk():
    r = validate_imo("9321483")
    assert r["valid"] is True  # 63+18+10+4+12+16 = 123 -> 3
    e = explain_imo("9321483")
    assert "= 123; last digit 3" in e["detail"]["worked_example"]


def test_imo_bad_check_digit():
    r = validate_imo("9074728")
    assert r["valid"] is False
    assert r["reason"] == "bad_check_digit"


def test_unlocode_valid():
    for code in ("USBOS", "NLRTM", "CNSHA", "US BOS"):
        assert validate_unlocode(code)["valid"] is True, code


def test_unlocode_unknown_country():
    r = validate_unlocode("XXBOS")
    assert r["valid"] is False
    assert r["reason"] == "unknown_country"


def test_unlocode_zero_excluded():
    r = validate_unlocode("USB0S")
    assert r["valid"] is False
    assert r["reason"] == "bad_format"


def test_scac():
    r = validate_scac("MAEU")
    assert r["valid"] is True
    assert r["detail"]["suffix_hint"] == "container owner code convention"
    assert validate_scac("FDEG")["valid"] is True
    assert validate_scac("TOOLONGX")["valid"] is False


def test_usdot_and_mc():
    assert validate_usdot("USDOT 1234567")["valid"] is True
    assert validate_usdot("12345678")["valid"] is True
    assert validate_usdot("123456789")["valid"] is False
    assert validate_mc("MC-123456")["valid"] is True
    assert validate_mc("MC 987654")["normalized"] == "987654"


def test_every_result_carries_registration_not_checked():
    for r in (
        validate_container("CSQU3054383"),
        validate_imo("9321483"),
        validate_scac("MAEU"),
        validate_unlocode("USBOS"),
        validate_usdot("1234567"),
        validate_mc("MC-123456"),
    ):
        assert r["registration"] == "not_checked"


if __name__ == "__main__":
    fns = [(n, f) for n, f in sorted(globals().items())
           if n.startswith("test_") and callable(f)]
    failed = 0
    for name, fn in fns:
        try:
            fn()
            print(f"PASS  {name}")
        except AssertionError as exc:
            failed += 1
            print(f"FAIL  {name}  {exc}")
    print(f"\n{len(fns) - failed}/{len(fns)} vectors passed")
    sys.exit(1 if failed else 0)
