# freightid v2 preview — edge API

The freightid engine (same math as `pip install freightid` and the
[validator page](https://binlogic.io/free-tools/freightid)) as a public
JSON API on Cloudflare Workers, plus the two v2 capabilities:

- **/repair** — the did-you-mean. A broken container or IMO number comes back
  with every single-edit candidate that passes the full check, ranked.
- **/prefix** — owner lookup against a seeded subset of well-known BIC
  prefixes, honestly labeled as a subset. A miss is never claimed as "unissued."

Everything else the engine does rides along: `/validate` (with `&explain=1`
worked math), `/mint`, and `/selftest`, which runs the full 21-vector suite in
production so anyone can audit the deployment itself.

Honesty contract, unchanged from v1: every result carries
`registration:"not_checked"`. Math proves transcription, never existence.
Typo-proof, not fraud-proof.

## Deploy (2 commands, free plan, no card)

From this folder:

```
npx wrangler login
npx wrangler deploy
```

The first opens a browser to authorize your Cloudflare account. The second
prints your live URL, e.g. `https://freightid.<your-subdomain>.workers.dev`.

## Verify it worked

```
curl "https://freightid.<your-subdomain>.workers.dev/selftest"
curl "https://freightid.<your-subdomain>.workers.dev/repair?id=TCLU41747408"
```

The first should say 21/21. The second should return exactly two candidates:
`TCLU4174708` and `TCLU4174740` — the only two mathematically possible true
containers behind the corrupted broadcast number.

## Test locally (no account needed)

```
node test/smoke.mjs
```

## Not in this preview (worker memo scope)

Remote MCP endpoint (agent-callable), full BIC register (rung two done
properly), no-code nodes, sheets formula, badges, telemetry. The Fly/FastAPI
branch that dogfoods the actual pip package stays open pending the platform
verdict.
