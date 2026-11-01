// Beleuchtung (Wirkungsgradverfahren), Motoranlauf, Messwert-Prüfung.
import { MCB_TRIP } from "./calc.js";

const pos = (...v) => { if (v.some((x) => !(x > 0) || !Number.isFinite(x))) throw new Error("positive"); };

// Wirkungsgradverfahren: N = Em·A / (Φ·η_B·MF). Raumindex k = a·b / (h·(a + b)), h = Höhe Leuchte über Nutzebene.
export function lighting({ a, b, h, em, phi, etaB, mf, pLum = null }) {
  pos(a, b, h, em, phi, etaB, mf);
  if (etaB > 1.5 || mf > 1) throw new Error("range");
  const area = a * b, k = (a * b) / (h * (a + b));
  const nExact = (em * area) / (phi * etaB * mf), n = Math.ceil(nExact - 1e-9);
  const emReached = (n * phi * etaB * mf) / area;
  const r = { area, k, nExact, n, emReached };
  if (pLum !== null && pLum > 0) { r.pTotal = n * pLum; r.wPerM2 = r.pTotal / area; r.wPerM2_100lx = (r.wPerM2 / emReached) * 100; }
  return r;
}

// Bemessungsstrom des Drehstrommotors aus Wellenleistung: I = P / (√3·U·cosφ·η)
export const motorCurrent = ({ p, u, cos, eta }) => { pos(p, u, cos, eta); if (cos > 1 || eta > 1) throw new Error("range"); return p / (Math.sqrt(3) * u * cos * eta); };
// Anlaufverfahren: direkt, Stern-Dreieck (Strom und Moment auf 1/3), Sanftanlauf mit Startspannung (I ~ U, M ~ U²)
export function motorStart({ p, u, cos, eta, kI, kM = null, method, uStart = null }) {
  const iN = motorCurrent({ p, u, cos, eta });
  pos(kI);
  let fI = 1, fM = 1;
  if (method === "stardelta") { fI = 1 / 3; fM = 1 / 3; }
  else if (method === "soft") { pos(uStart); if (uStart > 1) throw new Error("range"); fI = uStart; fM = uStart ** 2; }
  const r = { iN, iA: kI * iN * fI, ratioI: kI * fI, fM };
  if (kM !== null && kM > 0) r.kMStart = kM * fM;
  // Motorschutzrelais: bei Stern-Dreieck üblicherweise in den Motorsträngen → Einstellung I_N/√3
  r.relay = method === "stardelta" ? iN / Math.sqrt(3) : iN;
  return r;
}

// Schutzorgan wie „B16“, „C 10“, „D20“ lesen → Abschaltstrom Ia = Faktor · In
export function parseDevice(text) {
  const m = /^\s*([BCDbcd])\s*(\d+(?:[.,]\d+)?)\s*A?\s*$/.exec(String(text ?? ""));
  if (!m) return null;
  const type = m[1].toUpperCase(), inn = Number(m[2].replace(",", "."));
  return { type, inn, ia: MCB_TRIP[type] * inn };
}
// Messwerte eines Stromkreises gegen Grenzwerte prüfen. Leere Messwerte werden nicht bewertet (null).
export function checkCircuit({ device, zs, riso, trcd, ircd }, { u0, zsFactor, risoMin, tMax, idn }) {
  const dev = parseDevice(device);
  const out = { dev };
  if (dev && zs !== null) { out.zsMax = (u0 / dev.ia) * zsFactor; out.zsOk = zs <= out.zsMax; out.ik = u0 / zs; }
  if (riso !== null) out.risoOk = riso >= risoMin;
  if (trcd !== null) out.tOk = trcd <= tMax;
  if (ircd !== null && idn) out.iOk = ircd <= idn; // Auslösestrom darf IΔn nicht überschreiten
  const checks = [out.zsOk, out.risoOk, out.tOk, out.iOk].filter((v) => v !== undefined);
  out.status = checks.length === 0 ? null : checks.every(Boolean);
  return out;
}
