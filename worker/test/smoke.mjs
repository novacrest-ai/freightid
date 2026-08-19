// node >=18: node test/smoke.mjs
import worker from "../src/worker.js";

const get = async (path) => {
  const r = await worker.fetch(new Request("https://freightid.test" + path));
  return { status: r.status, body: await r.json() };
};

let failures = 0;
const check = (name, cond, extra) => {
  console.log((cond ? "PASS" : "FAIL") + "  " + name + (extra ? "  " + extra : ""));
  if (!cond) failures++;
};

const st = await get("/selftest");
check("selftest all green", st.body.ok === true, st.body.pass + "/" + st.body.total + (st.body.failures.length ? " failing: " + st.body.failures.join(", ") : ""));

const v = await get("/validate?id=CSQU3054383&explain=1");
check("validate + worked example", v.body.valid === true && /mod 11/.test(v.body.detail.worked_example));

const dutch = await get("/repair?id=TCLU41747408");
check("coast-guard repair returns candidates", dutch.body.candidates.length >= 1);
console.log("  coast-guard candidates:", JSON.stringify(dutch.body.candidates.map((c) => c.value + " [" + c.edit + "]"), null, 2));

const sub = await get("/repair?id=CSQU3054384");
check("substitution repair finds true number", sub.body.candidates.some((c) => c.value === "CSQU3054383"), "total candidates: " + sub.body.candidates_total);

const mint = await get("/mint?owner=BAN&category=U&serial=421992");
check("mint BANU4219920", mint.body.minted === "BANU4219920");

const pf = await get("/prefix?code=TCLU");
check("prefix TCLU → Triton", pf.body.found === true && /Triton/.test(pf.body.owner));

const miss = await get("/prefix?code=BANU");
check("prefix miss is honest", miss.body.found === false && /NOT evidence/.test(miss.body.note));

const idx = await get("/");
check("index lists endpoints", idx.status === 200 && Object.keys(idx.body.endpoints).length === 5);

const imo = await get("/repair?id=9074728");
check("imo repair finds 9074729", imo.body.candidates.some((c) => c.value === "9074729"));

console.log(failures === 0 ? "\nALL SMOKE TESTS PASS" : "\n" + failures + " FAILURES");
process.exit(failures === 0 ? 0 : 1);
