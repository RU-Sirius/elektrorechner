// Rechenlogik – 1:1 aus dem Swift-Package CalcCore portiert.

const SI_FACTORS = { p: 1e-12, n: 1e-9, u: 1e-6, "µ": 1e-6, m: 1e-3, k: 1e3, M: 1e6, G: 1e9 };

// Zahl mit Dezimalkomma/-punkt und optionalem SI-Präfix, z. B. "4,7k", "100n", "2,2µ".
export function parse(text) {
  const s = String(text ?? "").trim().replace(",", ".");
  if (s === "") return null;
  const m = s.match(/^([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)\s*([pnuµmkMG])?$/);
  if (!m) return null;
  const v = Number(m[1]) * (m[2] ? SI_FACTORS[m[2]] : 1);
  return Number.isFinite(v) ? v : null;
}

// Ohmsches Gesetz: genau zwei von U, I, R, P > 0 → alle vier.
export function ohm({ u = null, i = null, r = null, p = null }) {
  const given = [u, i, r, p].filter((v) => v !== null);
  if (given.length !== 2) throw new Error("two");
  if (!given.every((v) => v > 0 && Number.isFinite(v))) throw new Error("positive");
  if (u !== null && i !== null) return { u, i, r: u / i, p: u * i };
  if (u !== null && r !== null) return { u, i: u / r, r, p: (u * u) / r };
  if (u !== null && p !== null) return { u, i: p / u, r: (u * u) / p, p };
  if (i !== null && r !== null) return { u: i * r, i, r, p: i * i * r };
  if (i !== null && p !== null) return { u: p / i, i, r: p / (i * i), p };
  return { u: Math.sqrt(p * r), i: Math.sqrt(p / r), r, p };
}

// ANNAHME: übliche Praxiswerte in m/(Ω·mm²); in der App änderbar.
export const MATERIALS = { cu: { name: "Kupfer", kappa: 56 }, al: { name: "Aluminium", kappa: 35 } };

export const SYSTEMS = {
  dc: { name: "DC", factor: 2, voltage: 12 },
  ac1: { name: "1~ AC", factor: 2, voltage: 230 },
  ac3: { name: "3~ AC", factor: Math.sqrt(3), voltage: 400 },
};

// Nennquerschnitte in mm² (Reihe nach IEC 60228).
export const STANDARD_SECTIONS = [0.5, 0.75, 1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300];

function checkPositive(...vals) {
  if (!vals.every((v) => v !== null && v > 0 && Number.isFinite(v))) throw new Error("positive");
}
function effCos(system, cos) {
  if (system === "dc") return 1;
  if (cos === null) cos = 1;
  if (!(cos > 0 && cos <= 1)) throw new Error("cos");
  return cos;
}

// Vereinfacht: ΔU = k·L·I·cosφ/(κ·A), ohne Reaktanz und Temperaturkorrektur.
export function voltageDrop({ system, length, current, section, voltage, cos, kappa }) {
  checkPositive(length, current, section, voltage, kappa);
  const c = effCos(system, cos);
  const rCond = length / (kappa * section);
  const drop = SYSTEMS[system].factor * current * c * rCond;
  const loss = (system === "ac3" ? 3 : 2) * current * current * rCond;
  return { drop, percent: (drop / voltage) * 100, loss, atLoad: voltage - drop };
}

export function minSection({ system, length, current, voltage, maxPercent, cos, kappa }) {
  checkPositive(length, current, voltage, maxPercent, kappa);
  const c = effCos(system, cos);
  const required = (SYSTEMS[system].factor * length * current * c) / (kappa * voltage * maxPercent / 100);
  const standard = STANDARD_SECTIONS.find((a) => a >= required * (1 - 1e-9)) ?? null;
  return { required, standard };
}

// Widerstands-Farbcode nach IEC 60062.
export const BANDS = [
  { id: "black", name: "Schwarz", css: "#000000", digit: 0, mult: 1 },
  { id: "brown", name: "Braun", css: "#73421a", digit: 1, mult: 10, tol: 1 },
  { id: "red", name: "Rot", css: "#e0201b", digit: 2, mult: 100, tol: 2 },
  { id: "orange", name: "Orange", css: "#f28c00", digit: 3, mult: 1e3 },
  { id: "yellow", name: "Gelb", css: "#f5d000", digit: 4, mult: 1e4 },
  { id: "green", name: "Grün", css: "#1f9e3a", digit: 5, mult: 1e5, tol: 0.5 },
  { id: "blue", name: "Blau", css: "#1e5bd6", digit: 6, mult: 1e6, tol: 0.25 },
  { id: "violet", name: "Violett", css: "#8a3fc7", digit: 7, mult: 1e7, tol: 0.1 },
  { id: "grey", name: "Grau", css: "#8c8c8c", digit: 8, mult: 1e8, tol: 0.05 },
  { id: "white", name: "Weiß", css: "#f7f7f7", digit: 9, mult: 1e9 },
  { id: "gold", name: "Gold", css: "#d4af37", mult: 0.1, tol: 5 },
  { id: "silver", name: "Silber", css: "#bfbfbf", mult: 0.01, tol: 10 },
];
export const band = (id) => BANDS.find((b) => b.id === id);

export function resistor(digitIds, multId) {
  if (digitIds.length < 2 || digitIds.length > 3) throw new Error("bands");
  let n = 0;
  for (const id of digitIds) {
    const b = band(id);
    if (b?.digit === undefined) throw new Error("bands");
    n = n * 10 + b.digit;
  }
  return n * band(multId).mult;
}

// Wert mit SI-Präfix, z. B. 4700 → "4,7 k".
export function si(value, unit) {
  if (!Number.isFinite(value) || value === 0) return `${fmt(value, 4)} ${unit}`;
  const prefixes = { "-12": "p", "-9": "n", "-6": "µ", "-3": "m", 0: "", 3: "k", 6: "M", 9: "G", 12: "T" };
  let exp = Math.floor(Math.log10(Math.abs(value)) / 3) * 3;
  exp = Math.min(Math.max(exp, -12), 12);
  const m = value / 10 ** exp;
  return `${Number(m.toPrecision(4)).toLocaleString("de-DE")} ${prefixes[exp]}${unit}`;
}

export function fmt(value, maxDigits = 2) {
  return value.toLocaleString("de-DE", { maximumFractionDigits: maxDigits });
}


// ===================== Erweiterungen =====================

const pos = (...v) => { if (!v.every((x) => x !== null && x > 0 && Number.isFinite(x))) throw new Error("positive"); };
const cosOk = (c) => { if (!(c > 0 && c <= 1)) throw new Error("cos"); };

// Reihen- und Parallelschaltung. Für C gilt es umgekehrt (Reihe = Kehrwertsumme).
export function series(values) { pos(...values); return values.reduce((a, b) => a + b, 0); }
export function parallel(values) { pos(...values); return 1 / values.reduce((a, b) => a + 1 / b, 0); }

// Unbelasteter Spannungsteiler.
export function divider({ uin, r1, r2 }) {
  pos(uin, r1, r2);
  const i = uin / (r1 + r2);
  return { uout: i * r2, i, p1: i * i * r1, p2: i * i * r2 };
}
// Gesucht R1 für gewünschte Ausgangsspannung bei gegebenem R2.
export function dividerR1({ uin, uout, r2 }) {
  pos(uin, uout, r2);
  if (uout >= uin) throw new Error("range");
  return (r2 * (uin - uout)) / uout;
}

// Normreihen nach IEC 60063 (Werte je Dekade).
export const E_SERIES = {
  E6: [1.0, 1.5, 2.2, 3.3, 4.7, 6.8],
  E12: [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2],
  E24: [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1],
};
const roundSig = (x) => Number(x.toPrecision(6));
// Nächstkleinerer, nächstgrößerer und nächstliegender Normwert.
export function eSeries(value, name = "E12") {
  pos(value);
  const base = E_SERIES[name];
  const dec = Math.floor(Math.log10(value));
  const cands = [];
  for (const d of [dec - 1, dec, dec + 1]) for (const b of base) cands.push(roundSig(b * 10 ** d));
  cands.sort((a, b) => a - b);
  const eps = value * 1e-9;
  const lower = [...cands].reverse().find((c) => c <= value + eps);
  const upper = cands.find((c) => c >= value - eps);
  // „nächstliegend“ logarithmisch (relativer Abstand), wie bei Normreihen üblich
  const nearest = Math.abs(Math.log(value / lower)) <= Math.abs(Math.log(upper / value)) ? lower : upper;
  return { lower, upper, nearest };
}

// LED-Vorwiderstand für n LEDs in Reihe.
export function ledResistor({ ub, uf, i, n = 1, series: ser = "E24" }) {
  pos(ub, uf, i, n);
  const ur = ub - n * uf;
  if (ur <= 0) throw new Error("range");
  const r = ur / i;
  const chosen = eSeries(r, ser).upper; // nächstgrößer → Strom bleibt ≤ Sollwert
  const iReal = ur / chosen;
  return { r, chosen, iReal, pR: iReal * iReal * chosen };
}

// Leistung im Wechsel-/Drehstromnetz. U bei 3~ = Außenleiterspannung.
export function acPower({ system, u, i, cos }) {
  pos(u, i); cosOk(cos);
  const k = system === "ac3" ? Math.sqrt(3) : 1;
  const s = k * u * i;
  return { s, p: s * cos, q: s * Math.sin(Math.acos(cos)), phiDeg: (Math.acos(cos) * 180) / Math.PI };
}
// Strom aus (mechanischer) Leistung, z. B. Motorbemessungsstrom.
export function currentFromPower({ system, p, u, cos, eta = 1 }) {
  pos(p, u, eta); cosOk(cos);
  if (eta > 1) throw new Error("eta");
  const k = system === "ac3" ? Math.sqrt(3) : 1;
  const pel = p / eta;
  return { i: pel / (k * u * cos), pel, s: pel / cos };
}

// Temperaturkoeffizient α bei 20 °C in 1/K. ANNAHME: Cu 0,00393; Al 0,00403 (Literaturwerte, änderbar).
export const ALPHA = { cu: 0.00393, al: 0.00403 };
// Leiterwiderstand, wahlweise Hin- und Rückleiter.
export function wireResistance({ length, section, kappa, alpha, temp = 20, loop = false }) {
  pos(length, section, kappa);
  const r20 = ((loop ? 2 : 1) * length) / (kappa * section);
  return { r20, rT: r20 * (1 + alpha * (temp - 20)) };
}

// Blindwiderstände und Reihen-/Parallelresonanz (ideal).
export function reactance({ f, l = null, c = null }) {
  pos(f);
  const w = 2 * Math.PI * f;
  const r = {};
  if (l !== null) { pos(l); r.xl = w * l; }
  if (c !== null) { pos(c); r.xc = 1 / (w * c); }
  if (l !== null && c !== null) r.f0 = 1 / (2 * Math.PI * Math.sqrt(l * c));
  return r;
}

// RC- bzw. RL-Glied: Zeitkonstante und -3-dB-Grenzfrequenz.
export function timeConstant({ kind, r, x }) {
  pos(r, x);
  const tau = kind === "rl" ? x / r : r * x;
  return { tau, fg: 1 / (2 * Math.PI * tau), t99: 5 * tau };
}

// Blindleistungskompensation von cos φ1 auf cos φ2 bei Wirkleistung P.
export function compensation({ p, cos1, cos2, u, f, system }) {
  pos(p, u, f); cosOk(cos1); cosOk(cos2);
  if (cos2 <= cos1) throw new Error("range");
  const qc = p * (Math.tan(Math.acos(cos1)) - Math.tan(Math.acos(cos2)));
  const w = 2 * Math.PI * f;
  if (system === "ac3") return { qc, cDelta: qc / (3 * w * u * u), cStar: qc / (w * u * u) };
  return { qc, c: qc / (w * u * u) };
}

// Stern-Dreieck-Umrechnung (Widerstände bzw. Impedanzbeträge bei reinen R).
export function deltaToStar(r12, r23, r31) {
  pos(r12, r23, r31);
  const s = r12 + r23 + r31;
  return { r1: (r12 * r31) / s, r2: (r12 * r23) / s, r3: (r23 * r31) / s };
}
export function starToDelta(r1, r2, r3) {
  pos(r1, r2, r3);
  const n = r1 * r2 + r2 * r3 + r3 * r1;
  return { r12: n / r3, r23: n / r1, r31: n / r2 };
}

// Pegel in dB.
export const db = {
  fromVoltageRatio: (x) => (pos(x), 20 * Math.log10(x)),
  fromPowerRatio: (x) => (pos(x), 10 * Math.log10(x)),
  toVoltageRatio: (d) => 10 ** (d / 20),
  toPowerRatio: (d) => 10 ** (d / 10),
};

// ===================== Photovoltaik & Speicher =====================

// Lineare Temperaturkorrektur einer Modulspannung; beta in %/K (meist negativ), Bezug 25 °C (STC).
const tempCorr = (v, beta, t) => v * (1 + (beta / 100) * (t - 25));

// Stringauslegung. ANNAHME: Der Temperaturkoeffizient von Voc wird auch für Vmpp verwendet,
// falls kein eigener Wert angegeben ist. Isc-Temperaturanstieg wird vernachlässigt.
export function pvString({ voc, vmpp, isc, pmod, beta, betaMpp = null, tMin, tMax, uMax, mppMin, mppMax, iMax }) {
  pos(voc, vmpp, isc, pmod, uMax, mppMin, mppMax, iMax);
  if (beta === null || tMin === null || tMax === null) throw new Error("positive");
  if (mppMin >= mppMax || vmpp >= voc) throw new Error("range");
  const bm = betaMpp ?? beta;
  const vocCold = tempCorr(voc, beta, tMin);
  const vmppHot = tempCorr(vmpp, bm, tMax);
  const vmppCold = tempCorr(vmpp, bm, tMin);
  const nMaxVoltage = Math.floor(uMax / vocCold);
  const nMinMpp = Math.ceil(mppMin / vmppHot);
  const nMaxMpp = Math.floor(mppMax / vmppCold);
  const nMax = Math.min(nMaxVoltage, nMaxMpp);
  return { vocCold, vmppHot, vmppCold, nMaxVoltage, nMinMpp, nMaxMpp, nMin: nMinMpp, nMax,
           ok: nMinMpp <= nMax, parallel: Math.floor(iMax / isc), pString: (n) => n * pmod };
}

// Jahresertrag und einfache (statische) Amortisation, ohne Degradation, Preissteigerung oder Zinsen.
export function pvYield({ kwp, specYield, selfShare, price, feedIn, invest, opex = 0 }) {
  pos(kwp, specYield);
  if (selfShare === null || selfShare < 0 || selfShare > 100) throw new Error("range");
  const e = kwp * specYield;
  const self = (e * selfShare) / 100;
  const grid = e - self;
  const savings = self * (price ?? 0) + grid * (feedIn ?? 0) - (opex ?? 0);
  return { e, self, grid, savings, payback: invest && savings > 0 ? invest / savings : null };
}

// Speicher: nutzbare Energie und Laufzeit. capacity in kWh, load in kW, dod/eta als Anteil (0…1).
export function batteryRuntime({ capacity, dod, eta, load }) {
  pos(capacity, dod, eta, load);
  if (dod > 1 || eta > 1) throw new Error("range");
  const usable = capacity * dod;
  return { usable, hours: (usable * eta) / load };
}
// Benötigte Nennkapazität für eine Last über eine Dauer.
export function batterySize({ load, hours, dod, eta, voltage = null }) {
  pos(load, hours, dod, eta);
  if (dod > 1 || eta > 1) throw new Error("range");
  const kwh = (load * hours) / (dod * eta);
  return { kwh, ah: voltage ? (kwh * 1000) / voltage : null };
}
// Ladezeit von SoC a nach b (Anteile) mit Ladeleistung in kW.
export function chargeTime({ capacity, socFrom, socTo, power, eta }) {
  pos(capacity, power, eta);
  if (!(socFrom >= 0 && socTo <= 1 && socTo > socFrom) || eta > 1) throw new Error("range");
  const energy = capacity * (socTo - socFrom);
  return { energy, hours: energy / (power * eta) };
}
