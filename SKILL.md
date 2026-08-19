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
