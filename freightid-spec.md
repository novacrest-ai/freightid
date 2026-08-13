# freightid — build spec v1.0 (agent-ready)

**Ship target: PyPI, Friday 14 Aug 2026, under github.com/novacrest-ai.**
*(Org name locked 13 Aug — mirrors the novacrest.ai domain. Bare `novacrest` = dormant third-party user account since ~2017, recovery request filed separately, non-blocking. Engineering stays at `altacrest`, untouched, never renamed.)*
Warm-up rep for the coverage map: proves the pipeline (spec → agent build → vector review → PyPI → aggregator auto-generation → listing sweep) end to end.
Board: parent 86e2mzrf3 · spec 86e2mzrfv (today) · agent build 86e2mzrgr · vector review 86e2mzrhw · PyPI 86e2mzrjq.

## What it is

Pure-function validators for every major logistics identifier format. Zero runtime dependencies. The pitch line (and README first line): **"AI agents can look up every port on Earth. Not one can check a container number. Now they can."**

House doctrine baked into the API: freightid verifies **math and format, never registration**. Every result distinguishes three states — `valid` (checksum/format passes), `invalid` (fails, with reason), and explicitly `registration: "not_checked"` on everything. We can prove a check digit; we cannot prove a container exists. Say so in the return value, not the fine print.

## Scope v0.1.0

| Function | Identifier | Validation depth |
|---|---|---|
| `validate_container(s)` | ISO 6346 container number | Full check-digit math |
| `validate_imo(s)` | IMO ship number | Full check-digit math |
| `validate_scac(s)` | SCAC carrier code | Format + suffix semantics metadata |
| `validate_unlocode(s)` | UN/LOCODE | Format + ISO-3166 country check |
| `validate_usdot(s)` | USDOT number | Format only |
| `validate_mc(s)` | MC docket number | Format only (normalizes "MC-" prefix) |

Out of scope v0.1 (README "roadmap" line, do not build): IMO *company* numbers (different scheme), UN/LOCODE name/function lookup (needs UNECE dataset — data joins stay human), BIC owner-code registry lookup (registration ≠ math), AWB/BOL/GS1 (v0.2 candidates).

## Return shape (every validator)

```python
{
  "input": "csqu 305438-3",          # as received
  "normalized": "CSQU3054383",        # uppercased, stripped of spaces/hyphens
  "valid": True,                      # format + checksum verdict
  "kind": "iso6346_container",
  "reason": None,                     # populated iff invalid: "bad_check_digit",
                                      # "bad_length", "bad_charset", "bad_category", ...
  "detail": {...},                    # per-kind fields, see below
  "registration": "not_checked",      # ALWAYS this string. Non-negotiable.
}
```

Plus `explain_container(s)` / `explain_imo(s)`: same dict with `detail.worked_example` — the full weighted-sum arithmetic as a string. This is the agent-facing party trick: compute, not just verdict.

## Algorithms — exact

### ISO 6346 container (`validate_container`)

Normalized form: 11 chars = 4 letters (owner 3 + category 1) + 6 digits (serial) + 1 digit (check).

1. Charset/length: `^[A-Z]{4}[0-9]{7}$` else `bad_length`/`bad_charset`.
2. Category (4th char) must be `U`, `J`, or `Z`; else `bad_category`. `detail.category` maps: U=freight container, J=detachable equipment, Z=trailer/chassis.
3. Letter values (multiples of 11 skipped): A=10 B=12 C=13 D=14 E=15 F=16 G=17 H=18 I=19 J=20 K=21 L=23 M=24 N=25 O=26 P=27 Q=28 R=29 S=30 T=31 U=32 V=34 W=35 X=36 Y=37 Z=38. Digits = face value.
4. Weight char i (0-indexed, first 10 chars) by 2^i. Sum. `check = sum mod 11`; **if 10 → 0** (this edge case is real in the wild; must accept).
5. Compare to 11th char.

`detail`: `{owner: "CSQ", category: "U", serial: "305438", check_digit_expected: 3, check_digit_given: 3}`.

**Documented weakness (README + tests, not a bug):** weights 2^0..2^9 are distinct and nonzero mod 11, so every single-*digit* mutation is caught; but letter substitutions with value-delta ≡ 0 (mod 11) — e.g. A↔K, L↔B — are undetectable by design of the standard. Property tests must encode exactly this boundary.

### IMO ship number (`validate_imo`)

Normalized: strip optional leading `IMO` / `IMO ` prefix; require `^[0-9]{7}$`.
`sum = d1*7 + d2*6 + d3*5 + d4*4 + d5*3 + d6*2`; valid iff `sum % 10 == d7`.
`detail`: `{check_digit_expected, check_digit_given}`.

### SCAC (`validate_scac`)

`^[A-Z]{2,4}$`. No checksum exists. `detail.suffix_hint`: ends in U → "container owner code convention", X → "privately owned railcar convention", Z → "truck chassis/trailer convention", else None. Hints are metadata, never affect `valid`.

### UN/LOCODE (`validate_unlocode`)

Normalize: uppercase, drop internal space ("US BOS" → "USBOS"). Format `^[A-Z]{2}[A-Z2-9]{3}$` (digits 0 and 1 excluded from the location part by the standard). Country = first two chars must be in the embedded ISO 3166-1 alpha-2 set (`data.py`, frozenset of all 249 officially assigned codes, sourced from the ISO 3166-1 standard — agent embeds the full list; review step spot-checks 10). `reason`: `bad_format` or `unknown_country`. `detail`: `{country: "US", location: "BOS"}`. Existence of the location itself: not checked, and `registration: "not_checked"` carries that honestly.

### USDOT (`validate_usdot`)

Strip optional `USDOT`/`DOT` prefix and punctuation. `^[0-9]{1,8}$`. No checksum exists — README says so plainly.

### MC (`validate_mc`)

Strip optional `MC`/`MC-`/`MC ` prefix. `^[0-9]{1,8}$`. Same no-checksum honesty.

## Known-good vectors (review card 86e2mzrhw runs these)

- `CSQU3054383` → valid. Worked: 13·1+30·2+28·4+32·8+3·16+0·32+5·64+4·128+3·256+8·512 = 6185; 6185 mod 11 = 3. (Canonical ISO 6346 documentation example.)
- `CSQU3054384` → invalid, `bad_check_digit`.
- `IMO 9074729` → valid (63+0+35+16+21+4 = 139 → 9). `9321483` (Emma Maersk) → valid (63+18+10+4+12+16 = 123 → 3). `9074728` → invalid.
- `USBOS`, `NLRTM`, `CNSHA` → valid; `XXBOS` → `unknown_country`; `USB0S` → `bad_format` (zero excluded).
- `MAEU`, `FDEG` → valid SCAC; `MAEU` gets suffix_hint container-owner; `TOOLONGX` → invalid.
- Review step additionally pulls 5 real container numbers from BIC's public examples and 5 live IMO numbers from public vessel pages; all must pass. Any failure blocks Friday.

## Property tests (Hypothesis, dev-dependency only)

1. **Round-trip:** generate owner∈[A-Z]³, category∈{U,J,Z}, serial∈0..999999 → compute check → `validate_container` is True. 10k examples.
2. **Digit sensitivity:** any single-digit mutation of a valid container → invalid. Always.
3. **Letter boundary:** single-letter mutation → invalid iff value-delta mod 11 ≠ 0; the A↔K / B↔L family must (correctly) still validate — asserting the *weakness* pins the algorithm.
4. **IMO round-trip + mutation:** analogous; digit mutations in positions 1–6 with delta·weight ≢ 0 (mod 10) → invalid (weights 7..2 aren't all coprime to 10 — position 5 (weight 5) and even-weight positions have blind deltas; encode the true boundary, same spirit as #3).
5. **Normalization idempotence:** validate(normalized) == validate(raw) for all inputs with spaces/hyphens/case noise.
6. All validators: never raise on arbitrary str input (fuzz with `st.text()`); always return the dict shape.

## Package skeleton

```
freightid/
├── pyproject.toml
├── README.md
├── LICENSE                    # MIT
├── SKILL.md
├── src/freightid/
│   ├── __init__.py            # re-exports all validate_*/explain_*, __version__="0.1.0"
│   ├── container.py           # ISO 6346
│   ├── imo.py
│   ├── scac.py
│   ├── unlocode.py
│   ├── usdot.py               # also MC
│   ├── data.py                # ISO 3166-1 alpha-2 frozenset
│   └── cli.py                 # `freightid <anything>` → tries all kinds, prints JSON
└── tests/
    ├── test_vectors.py        # the table above, verbatim
    └── test_properties.py     # the six Hypothesis suites
```

pyproject essentials: `[build-system] hatchling`; `requires-python = ">=3.9"`; no dependencies; `[project.optional-dependencies] dev = ["hypothesis", "pytest"]`; `[project.scripts] freightid = "freightid.cli:main"`; keywords: logistics, shipping, container, ISO 6346, IMO, SCAC, UN/LOCODE, validation; classifiers incl. `Typed`; **`[project.urls] Homepage / Repository / Documentation → https://github.com/novacrest-ai/freightid`** — these are the measured followed-link surface; they are the point.

CLI: detect-and-report. `freightid CSQU3054383` → pretty JSON with kind auto-detected (try container → imo → unlocode → scac → usdot); `--kind` to force; exit 0 valid / 1 invalid / 2 unrecognized. ~40 lines, argparse, nothing clever.

README structure: pitch line → install → 6-line usage → the three-state honesty paragraph (verbatim: "freightid checks math, not registration") → per-identifier notes incl. the ISO 6346 letter-substitution weakness → roadmap line → "by Novacrest" footer linking the org.

## SKILL.md (agent-skill wrapper — surface #4, ships same day)

```markdown
---
name: freightid
description: Validate and explain logistics identifiers — ISO 6346 container
  numbers (full check-digit math), IMO ship numbers, SCAC carrier codes,
  UN/LOCODE place codes, USDOT and MC numbers. Use whenever a shipping ID
  appears and its validity, structure, or check digit matters. Checks math
  and format only — never registration or existence.
---
# freightid

Install once: `pip install freightid`

Validate: `freightid CSQU3054383` (auto-detects kind, JSON verdict)
Force kind: `freightid --kind imo 9321483`
In Python: `from freightid import validate_container, explain_container`

`explain_*` returns the full weighted-sum arithmetic — use it when the user
wants to see WHY a check digit is what it is. Every result carries
`registration: "not_checked"`; do not claim an identifier "exists," only
that its math holds.
```

## Friday publish checklist (86e2mzrjq)

1. Org gate: `github.com/novacrest-ai` exists as an ORGANIZATION with company custody (Benjy = owner, 2FA enforced, company-reachable billing email), repo `freightid` public, website field + topics set (86e2mzqrh pattern). Never publish from a personal account.
2. `python -m build`; twine check; **TestPyPI first**, install-test in a clean venv, then PyPI.
3. Verify PyPI project page renders README and the three project URLs are live links (this is the measured surface — screenshot for the receipt log).
4. Within 48h: survey card 86e2mzt5k — confirm libraries.io / Snyk Advisor / ecosyste.ms / piwheels auto-generated pages; log first_seen dates.
5. Then the sweep cards fire per plan: MCP directories, skill registries, n8n/npm ports are the map's job, not freightid's.

## Build-mode note for the agent

Pure functions, no I/O, no network, no classes where a function does. Every module ≤120 lines. Type hints throughout, `py.typed` marker. Docstrings carry the worked example for their own algorithm. If any vector fails, stop and report — do not "fix" a vector.
