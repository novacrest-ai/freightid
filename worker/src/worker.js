/**
 * freightid v2 preview — Cloudflare Worker
 *
 * Engine ported verbatim from freightid 0.1.0 (pip) via the self-tested
 * browser port on binlogic.io/free-tools/freightid.
 *
 * Endpoints (all GET, all JSON, CORS *):
 *   /            index + usage
 *   /validate    ?id=CSQU3054383            (&explain=1 for the worked math)
 *   /repair      ?id=TCLU41747408           did-you-mean for container + IMO numbers
 *   /mint        ?owner=BAN&category=U&serial=421992   (serial optional = random)
 *   /prefix      ?code=TCLU                 seeded BIC owner-prefix subset, honestly labeled
 *   /selftest    runs the vector suite in production
 *
 * Every validation result carries registration:"not_checked" — this service
 * proves math, never existence. Existence is a registry question.
 */

/* ================= ENGINE (port of freightid 0.1.0 — keep verbatim) ================= */
const LETTER_VALUES = { A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19, J: 20, K: 21, L: 23, M: 24, N: 25, O: 26, P: 27, Q: 28, R: 29, S: 30, T: 31, U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38 };
const CATEGORY_MEANINGS = { U: "freight container", J: "detachable freight container-related equipment", Z: "trailer or chassis" };
const ISO_COUNTRIES = ("AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW XK XZ").split(" ");
const COUNTRY_SET = new Set(ISO_COUNTRIES);

const norm = (v) => String(v).replace(/[\s\-.]/g, "").toUpperCase();
const charVal = (ch) => (/[A-Z]/.test(ch) ? LETTER_VALUES[ch] : parseInt(ch, 10));
const res = (input, normalized, valid, kind, reason, detail) => ({ input, normalized, valid, kind, reason, detail, registration: "not_checked" });

function computeContainerCheck(firstTen) {
  let t = 0;
  for (let i = 0; i < 10; i++) t += charVal(firstTen[i]) * Math.pow(2, i);
  return (t % 11) % 10;
}
function validateContainer(value) {
  const n = norm(value);
  if (n.length !== 11) return res(value, n, false, "iso6346_container", "bad_length", {});
  if (!/^[A-Z]{4}[0-9]{7}$/.test(n)) return res(value, n, false, "iso6346_container", "bad_charset", {});
  const cat = n[3];
  if (!(cat in CATEGORY_MEANINGS)) return res(value, n, false, "iso6346_container", "bad_category", { category: cat });
  const exp = computeContainerCheck(n.slice(0, 10));
  const giv = parseInt(n[10], 10);
  const d = { owner: n.slice(0, 3), category: cat, category_meaning: CATEGORY_MEANINGS[cat], serial: n.slice(4, 10), check_digit_expected: exp, check_digit_given: giv };
  if (exp !== giv) return res(value, n, false, "iso6346_container", "bad_check_digit", d);
  return res(value, n, true, "iso6346_container", null, d);
}
function explainContainer(value) {
  const out = validateContainer(value);
  const n = out.normalized;
  if (out.reason === "bad_length" || out.reason === "bad_charset") return out;
  const terms = [];
  let t = 0;
  for (let i = 0; i < 10; i++) {
    const v = charVal(n[i]), w = Math.pow(2, i);
    terms.push(n[i] + "(" + v + ")x" + w);
    t += v * w;
  }
  const r = t % 11, c = r % 10;
  out.detail.worked_example = terms.join(" + ") + " = " + t + "; " + t + " mod 11 = " + r + (r === 10 ? " -> check digit 0 (remainder 10 maps to 0)" : " -> check digit " + c);
  return out;
}
const IMO_W = [7, 6, 5, 4, 3, 2];
const imoNorm = (v) => String(v).trim().replace(/^IMO[\s\-]*/i, "").replace(/[\s\-.]/g, "");
function computeImoCheck(firstSix) {
  let t = 0;
  for (let i = 0; i < 6; i++) t += parseInt(firstSix[i], 10) * IMO_W[i];
  return t % 10;
}
function validateIMO(value) {
  const n = imoNorm(value);
  if (!/^[0-9]{7}$/.test(n)) return res(value, n, false, "imo_ship_number", /^[0-9]*$/.test(n) ? "bad_length" : "bad_charset", {});
  const exp = computeImoCheck(n.slice(0, 6));
  const giv = parseInt(n[6], 10);
  const d = { check_digit_expected: exp, check_digit_given: giv };
  if (exp !== giv) return res(value, n, false, "imo_ship_number", "bad_check_digit", d);
  return res(value, n, true, "imo_ship_number", null, d);
}
function explainIMO(value) {
  const out = validateIMO(value);
  const n = out.normalized;
  if (!/^[0-9]{7}$/.test(n)) return out;
  const terms = [];
  let t = 0;
  for (let i = 0; i < 6; i++) {
    terms.push(n[i] + "x" + IMO_W[i]);
    t += parseInt(n[i], 10) * IMO_W[i];
  }
  out.detail.worked_example = terms.join(" + ") + " = " + t + "; last digit " + (t % 10);
  return out;
}
const SCAC_HINTS = { U: "container owner code convention", X: "privately owned railcar convention", Z: "truck chassis/trailer convention" };
function validateSCAC(value) {
  const n = norm(value), ok = /^[A-Z]{2,4}$/.test(n), d = {};
  if (ok) d.suffix_hint = SCAC_HINTS[n[n.length - 1]] || null;
  return res(value, n, ok, "scac", ok ? null : "bad_format", d);
}
function validateUNLOCODE(value) {
  const n = norm(value);
  if (!/^[A-Z]{2}[A-Z2-9]{3}$/.test(n)) return res(value, n, false, "unlocode", "bad_format", {});
  const c = n.slice(0, 2), loc = n.slice(2);
  if (!COUNTRY_SET.has(c)) return res(value, n, false, "unlocode", "unknown_country", { country: c, location: loc });
  return res(value, n, true, "unlocode", null, { country: c, location: loc });
}
function stripValidateDigits(value, kind, prefixRe) {
  const s = String(value).trim().replace(prefixRe, "").replace(/[\s\-.,]/g, "");
  const ok = /^[0-9]{1,8}$/.test(s);
  return res(value, s, ok, kind, ok ? null : "bad_format", { note: "no check digit exists for this identifier" });
}
const validateUSDOT = (v) => stripValidateDigits(v, "usdot_number", /^(USDOT|DOT)[\s\-.#:]*/i);
const validateMC = (v) => stripValidateDigits(v, "mc_number", /^(MC)[\s\-.#:]*/i);
function mintContainer(owner, cat, serial) {
  const body = (owner + cat + serial).toUpperCase();
  if (!/^[A-Z]{3}[UJZ][0-9]{6}$/.test(body)) return null;
  return body + String(computeContainerCheck(body));
}
function detect(value) {
  const s = norm(value);
  if (/^[A-Z]{4}[0-9]{7}$/.test(s)) return "container";
  if (/^(IMO)?[0-9]{7}$/.test(s)) return "imo";
  if (/^[A-Z]{2}[A-Z2-9]{3}$/.test(s)) return "unlocode";
  if (/^[A-Z]{2,4}$/.test(s)) return "scac";
  if (/^(USDOT|DOT)?[0-9]{1,8}$/.test(s)) return "usdot";
  if (/^MC[0-9]{1,8}$/.test(s)) return "mc";
  return null;
}
/* =============== END ENGINE =============== */

/* =============== v2: REPAIR — did-you-mean for broken numbers =============== */
const AZ = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const D10 = "0123456789";

function containerCandidates(n) {
  const out = [];
  const seen = new Set();
  const push = (cand, edit, rank) => {
    if (cand === n || seen.has(cand)) return;
    const v = validateContainer(cand);
    if (!v.valid) return;
    seen.add(cand);
    out.push({ value: cand, owner: v.detail.owner, category: v.detail.category, serial: v.detail.serial, check_digit: v.detail.check_digit_given, edit, _rank: rank });
  };
  if (n.length === 11) {
    for (let i = 0; i < 10; i++) {
      if (n[i] === n[i + 1]) continue;
      const cand = n.slice(0, i) + n[i + 1] + n[i] + n.slice(i + 2);
      push(cand, "transpose positions " + (i + 1) + "-" + (i + 2), 1);
    }
    for (let i = 0; i < 11; i++) {
      const charset = i < 3 ? AZ : i === 3 ? "UJZ" : D10;
      for (const ch of charset) {
        if (ch === n[i]) continue;
        push(n.slice(0, i) + ch + n.slice(i + 1), "substitute position " + (i + 1) + " (" + n[i] + "→" + ch + ")", 2);
      }
    }
  } else if (n.length === 12) {
    for (let i = 0; i < 12; i++) {
      push(n.slice(0, i) + n.slice(i + 1), "delete position " + (i + 1) + " (" + n[i] + ")", 1);
    }
  } else if (n.length === 10) {
    for (let i = 0; i <= 10; i++) {
      for (const ch of AZ + D10) {
        push(n.slice(0, i) + ch + n.slice(i), "insert " + ch + " at position " + (i + 1), 1);
      }
    }
  }
  out.sort((a, b) => a._rank - b._rank);
  return out.map(({ _rank, ...c }) => c);
}

function imoCandidates(n) {
  const out = [];
  const seen = new Set();
  const push = (cand, edit, rank) => {
    if (cand === n || seen.has(cand)) return;
    if (!validateIMO(cand).valid) return;
    if (seen.has(cand)) return;
    seen.add(cand);
    out.push({ value: cand, edit, _rank: rank });
  };
  if (n.length === 7) {
    for (let i = 0; i < 6; i++) {
      if (n[i] === n[i + 1]) continue;
      push(n.slice(0, i) + n[i + 1] + n[i] + n.slice(i + 2), "transpose positions " + (i + 1) + "-" + (i + 2), 1);
    }
    for (let i = 0; i < 7; i++) {
      for (const ch of D10) {
        if (ch === n[i]) continue;
        push(n.slice(0, i) + ch + n.slice(i + 1), "substitute position " + (i + 1) + " (" + n[i] + "→" + ch + ")", 2);
      }
    }
  } else if (n.length === 8) {
    for (let i = 0; i < 8; i++) push(n.slice(0, i) + n.slice(i + 1), "delete position " + (i + 1) + " (" + n[i] + ")", 1);
  } else if (n.length === 6) {
    for (let i = 0; i <= 6; i++) for (const ch of D10) push(n.slice(0, i) + ch + n.slice(i), "insert " + ch + " at position " + (i + 1), 1);
  }
  out.sort((a, b) => a._rank - b._rank);
  return out.map(({ _rank, ...c }) => c);
}

const REPAIR_CAP = 12;
function repair(value) {
  const n = norm(value);
  const looksContainer = /^[A-Z][A-Z0-9]{9,11}$/.test(n) && /[A-Z]/.test(n[0]);
  const looksImo = /^[0-9]{6,8}$/.test(imoNorm(value));
  if (looksContainer) {
    const v = validateContainer(n);
    if (v.valid) return { input: value, normalized: n, kind: "iso6346_container", already_valid: true, candidates: [], note: "Number is already valid — nothing to repair." };
    const cands = containerCandidates(n);
    return {
      input: value, normalized: n, kind: "iso6346_container", already_valid: false,
      reason: v.reason,
      candidates: cands.slice(0, REPAIR_CAP),
      candidates_total: cands.length,
      note: cands.length ? "Every candidate is one edit away and passes the full ISO 6346 check. Ranked by edit likelihood. Math only — confirm against your booking or the BIC registry before acting." : "No single-edit repair produces a valid number — the error is likely in more than one character.",
      registration: "not_checked",
    };
  }
  if (looksImo) {
    const n2 = imoNorm(value);
    const v = validateIMO(n2);
    if (v.valid) return { input: value, normalized: n2, kind: "imo_ship_number", already_valid: true, candidates: [], note: "Number is already valid — nothing to repair." };
    const cands = imoCandidates(n2);
    return {
      input: value, normalized: n2, kind: "imo_ship_number", already_valid: false,
      reason: v.reason,
      candidates: cands.slice(0, REPAIR_CAP),
      candidates_total: cands.length,
      note: cands.length ? "Every candidate is one edit away and passes the IMO weighted check. Math only." : "No single-edit repair produces a valid number.",
      registration: "not_checked",
    };
  }
  return { input: value, normalized: n, kind: "unsupported", candidates: [], note: "Repair supports ISO 6346 container numbers and IMO ship numbers — the two formats with check digits. The rest have nothing to repair against." };
}

/* =============== v2: PREFIX — seeded BIC owner subset, honestly labeled =============== */
const PREFIX_DATA = {
  MAEU: "Maersk (A.P. Moller-Maersk)", MRKU: "Maersk", MSKU: "Maersk", SEAU: "Maersk (SeaLand heritage)", SUDU: "Hamburg Süd (Maersk group)",
  MSCU: "MSC Mediterranean Shipping Company", MEDU: "MSC Mediterranean Shipping Company",
  CMAU: "CMA CGM", CGMU: "CMA CGM", APLU: "APL (CMA CGM group)",
  COSU: "COSCO Shipping", OOLU: "OOCL (COSCO group)", OOCU: "OOCL (COSCO group)",
  HLXU: "Hapag-Lloyd", HLCU: "Hapag-Lloyd", UACU: "Hapag-Lloyd (UASC heritage)",
  ONEU: "Ocean Network Express (ONE)",
  EMCU: "Evergreen Marine", EGHU: "Evergreen Marine", EISU: "Evergreen Marine",
  YMLU: "Yang Ming Marine Transport", WHLU: "Wan Hai Lines", HMMU: "HMM (ex-Hyundai Merchant Marine)",
  ZIMU: "ZIM Integrated Shipping", ZCSU: "ZIM Integrated Shipping",
  TCLU: "Triton International (leasing)", TRLU: "Triton International (leasing)", TCNU: "Triton International (leasing)",
  TGHU: "Textainer (leasing)", TEMU: "Textainer (leasing)",
  CAIU: "CAI International (leasing)", BMOU: "Beacon Intermodal Leasing", FCIU: "Florens (leasing)", FSCU: "Florens (leasing)",
};
const PREFIX_COVERAGE = Object.keys(PREFIX_DATA).length;

function prefixLookup(code) {
  let c = norm(code);
  if (/^[A-Z]{4}[0-9]{7}$/.test(c)) c = c.slice(0, 4);
  if (/^[A-Z]{3}$/.test(c)) c = c + "U";
  if (!/^[A-Z]{4}$/.test(c)) return { input: code, error: "bad_format", note: "Pass a 4-letter prefix (TCLU), a 3-letter owner code (TCL), or a full container number." };
  const owner = PREFIX_DATA[c];
  const base = {
    input: code, prefix: c, owner_code: c.slice(0, 3), category: c[3],
    coverage: "seeded subset of " + PREFIX_COVERAGE + " well-known prefixes — NOT the full BIC register",
    authoritative_source: "https://www.bic-code.org/bic-codes/",
  };
  if (owner) return { ...base, found: true, owner };
  return {
    ...base, found: false, owner: null,
    note: "Not in this seeded subset. That is NOT evidence the prefix is unissued — the full register lives with the BIC. Check the authoritative source.",
  };
}

/* =============== v2: SELFTEST — the page's vectors + repair vectors, run in prod =============== */
function selftest() {
  const failures = [];
  let t = 0, p = 0;
  const ok = (name, c) => { t++; if (c) p++; else failures.push(name); };
  ok("container valid", validateContainer("CSQU3054383").valid === true);
  ok("container check=3", validateContainer("CSQU3054383").detail.check_digit_expected === 3);
  ok("container normalizes", validateContainer("csqu 305438-3").valid === true);
  ok("container bad check", validateContainer("CSQU3054384").reason === "bad_check_digit");
  ok("container bad category", validateContainer("CSQA3054383").reason === "bad_category");
  ok("container bad length", validateContainer("CSQU305438").reason === "bad_length");
  ok("imo valid w/ prefix", validateIMO("IMO 9074729").valid === true);
  ok("imo valid", validateIMO("9321483").valid === true);
  ok("imo ever given", validateIMO("9811000").valid === true);
  ok("imo bad check", validateIMO("9074728").reason === "bad_check_digit");
  ok("unlocode valid", validateUNLOCODE("USBOS").valid === true);
  ok("unlocode bad country", validateUNLOCODE("XXBOS").reason === "unknown_country");
  ok("unlocode bad format", validateUNLOCODE("USB0S").reason === "bad_format");
  ok("scac hint", validateSCAC("MAEU").detail.suffix_hint === "container owner code convention");
  ok("usdot+mc", validateUSDOT("USDOT 1234567").valid === true && validateMC("MC-123456").normalized === "123456");
  ok("mint roundtrip", validateContainer(mintContainer("BAN", "U", "421992")).valid === true);
  const r1 = repair("CSQU3054384");
  ok("repair finds the true number", r1.candidates.some((c) => c.value === "CSQU3054383"));
  const r2 = repair("TCLU41747408");
  ok("repair 12-char via deletions", r2.candidates.length > 0 && r2.candidates.every((c) => c.edit.startsWith("delete")));
  ok("repair leaves valid alone", repair("CSQU3054383").already_valid === true);
  ok("prefix TCLU found", prefixLookup("TCLU").found === true);
  ok("prefix honest miss", prefixLookup("BANU").found === false && /NOT evidence/.test(prefixLookup("BANU").note));
  return { pass: p, total: t, ok: p === t, failures };
}

/* =============== ROUTER =============== */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (obj, status = 200, cache = 60) =>
  new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache ? "public, max-age=" + cache : "no-store", ...CORS },
  });

function validateAny(raw, explain) {
  const kind = detect(raw);
  let r;
  if (kind === "container") r = explain ? explainContainer(raw) : validateContainer(raw);
  else if (kind === "imo") r = explain ? explainIMO(raw) : validateIMO(raw);
  else if (kind === "unlocode") {
    r = validateUNLOCODE(raw);
    if (!r.valid) { const alt = validateSCAC(raw); if (alt.valid) r = alt; }
  } else if (kind === "scac") r = validateSCAC(raw);
  else if (kind === "usdot") r = validateUSDOT(raw);
  else if (kind === "mc") r = validateMC(raw);
  else r = { input: raw, normalized: "", valid: false, kind: "unrecognized", reason: "unrecognized_format", detail: {}, registration: "not_checked" };
  return r;
}

const INDEX = {
  name: "freightid",
  version: "2.0.0-preview",
  what: "Deterministic validation, repair, and minting for logistics identifiers. Math, not registration.",
  endpoints: {
    "/validate?id=CSQU3054383": "validate any supported identifier (add &explain=1 for the worked check-digit math)",
    "/repair?id=TCLU41747408": "did-you-mean: single-edit candidates that pass the full check (containers + IMO)",
    "/mint?owner=BAN&category=U&serial=421992": "mint a mathematically valid container number (serial optional = random) for test data",
    "/prefix?code=TCLU": "owner lookup against a seeded subset of well-known BIC prefixes, honestly labeled",
    "/selftest": "run the full vector suite in production",
  },
  formats: ["iso6346_container", "imo_ship_number", "scac", "unlocode", "usdot_number", "mc_number"],
  page: "https://binlogic.io/free-tools/freightid",
  library: "pip install freightid",
  honesty: 'Every result carries registration:"not_checked". A valid number proves transcription, not existence — typo-proof, not fraud-proof.',
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (request.method !== "GET") return json({ error: "GET only" }, 405, 0);
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const id = url.searchParams.get("id") || "";

    if (path === "/") return json(INDEX, 200, 300);
    if (path === "/validate") {
      if (!id) return json({ error: "missing ?id=" }, 400, 0);
      return json(validateAny(id, url.searchParams.get("explain") === "1"));
    }
    if (path === "/repair") {
      if (!id) return json({ error: "missing ?id=" }, 400, 0);
      return json(repair(id));
    }
    if (path === "/mint") {
      const owner = url.searchParams.get("owner") || "";
      const category = url.searchParams.get("category") || "U";
      let serial = url.searchParams.get("serial") || "";
      if (!serial) serial = String(Math.floor(Math.random() * 1000000));
      serial = serial.padStart(6, "0");
      const minted = mintContainer(owner, category, serial);
      if (!minted) return json({ error: "owner must be 3 letters, category U/J/Z, serial up to 6 digits" }, 400, 0);
      return json({ minted, valid: true, owner: owner.toUpperCase(), category, serial, note: "Mathematically valid, refers to nothing. For seeding WMS/OMS test data.", registration: "not_checked" }, 200, 0);
    }
    if (path === "/prefix") {
      const code = url.searchParams.get("code") || id;
      if (!code) return json({ error: "missing ?code=" }, 400, 0);
      return json(prefixLookup(code));
    }
    if (path === "/selftest") return json(selftest(), 200, 0);
    return json({ error: "not found", see: "/" }, 404, 0);
  },
};

export { validateContainer, validateIMO, repair, prefixLookup, mintContainer, selftest };
