// Rechenlogik – 1:1 aus dem Swift-Package CalcCore portiert.

export function parse(text) {
  const s = String(text ?? "").trim().replace(",", ".");
  if (s === "") return null;
  const v = Number(s);
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
