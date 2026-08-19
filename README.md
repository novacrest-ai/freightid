# freightid

**AI agents can look up every port on Earth. Not one can check a container number. Now they can.**

Pure-function validators for the identifier formats that move global freight — with the arithmetic shown, not just the verdict.

```
pip install freightid
```

```python
from freightid import validate_container, explain_container

validate_container("csqu 305438-3")["valid"]      # True
explain_container("CSQU3054383")["detail"]["worked_example"]
# 'C(13)x1 + S(30)x2 + Q(28)x4 + U(32)x8 + 3(3)x16 + 0(0)x32 + 5(5)x64
#  + 4(4)x128 + 3(3)x256 + 8(8)x512 = 6185; 6185 mod 11 = 3 -> check digit 3'
```

Or from the shell — kind auto-detected, JSON out:

```
freightid CSQU3054383
freightid --kind imo 9321483
freightid --explain "IMO 9074729"
```

## What it validates

| Identifier | Depth |
|---|---|
| ISO 6346 container numbers | full check-digit math + worked explanation |
| IMO ship numbers | full check-digit math + worked explanation |
| SCAC carrier codes | format + suffix-convention metadata |
| UN/LOCODE place codes | format + ISO 3166-1 country check |
| USDOT numbers | format (no check digit exists) |
| MC docket numbers | format (no check digit exists) |

## freightid checks math, not registration

A mathematically valid container number is not evidence that the container
exists. freightid can prove a check digit; it cannot prove registration —
so every result says so explicitly:

```python
{"valid": True, ..., "registration": "not_checked"}
```

That field is always `"not_checked"`. If you need registry truth, ask a
registry. freightid will never blur the line for you.

## Honest edges

The standards have designed-in blind spots, and freightid's test suite
asserts them rather than hiding them:

- **ISO 6346:** letter substitutions whose value difference is a multiple
  of 11 (A↔K, B↔L, …) are undetectable — the weighted sum doesn't move.
  Separately, mod-11 remainders 0 and 10 both fold to check digit 0, so
  mutations moving the remainder between those two are invisible; this is
  why the standard discourages remainder-10 serials.
- **IMO:** the position weights (7..2) aren't all coprime to 10, so certain
  digit deltas at certain positions slip through by design.

## Roadmap

Not in v0.1, on the list: UN/LOCODE location lookup (needs the UNECE
dataset), IMO company numbers, BIC owner-registry awareness, AWB/BOL/GS1.

---

Built by [Novacrest](https://novacrest.ai) · from the team behind
[OmniOrders](https://omniorders.com) · MIT © 2026 Shipedge Inc.

## Edge API — worker/

The same engine as a public JSON API on Cloudflare Workers — validate, repair
(did-you-mean), mint, prefix lookup, and a production self-test:
https://freightid.altacrest.workers.dev

It powers the browser tool at https://omniorders.com/free-tools/freightid.
Deploy instructions: worker/README.md
