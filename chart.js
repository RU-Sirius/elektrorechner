// Einfache Liniendiagramme als SVG (ohne externe Bibliothek, offline).
import { h } from "./ui.js";

const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

// „Schöne“ Achsenteilung (1-2-5-Raster).
function niceTicks(lo, hi, count = 5) {
  if (!(hi > lo)) { hi = lo + 1; }
  const raw = (hi - lo) / count, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out;
}
const fmtTick = (v) => (Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-2 && v !== 0) ? v.toExponential(0) : String(+v.toPrecision(4))).replace(".", ",");

/**
 * series: [{ x: [], y: [], color, dash, label }]
 * opts: { xLabel, yLabel, logX, yMin, yMax, height }
 */
export function lineChart(series, opts = {}) {
  const W = 640, H = opts.height ?? 300, L = 48, R = 12, T = 12, B = 34;
  const xs = series.flatMap((s) => s.x), ys = series.flatMap((s) => s.y).filter(Number.isFinite);
  const tx = opts.logX ? Math.log10 : (v) => v;
  let x0 = Math.min(...xs.map(tx)), x1 = Math.max(...xs.map(tx));
  let y0 = opts.yMin ?? Math.min(...ys), y1 = opts.yMax ?? Math.max(...ys);
  if (y1 - y0 < 1e-12) { y0 -= 1; y1 += 1; }
  const pad = (y1 - y0) * 0.06; if (opts.yMin === undefined) y0 -= pad; if (opts.yMax === undefined) y1 += pad;
  const sx = (v) => L + ((tx(v) - x0) / (x1 - x0)) * (W - L - R), sy = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img", "aria-label": opts.yLabel ?? "Diagramm" });
  const grid = "color-mix(in srgb, var(--sub) 25%, transparent)";
  // Gitter & Achsbeschriftung
  for (const v of niceTicks(y0, y1)) {
    svg.append(el("line", { x1: L, x2: W - R, y1: sy(v), y2: sy(v), stroke: grid, "stroke-width": 1 }));
    const t = el("text", { x: L - 6, y: sy(v) + 3, "text-anchor": "end" }); t.textContent = fmtTick(v); svg.append(t);
  }
  const xt = opts.logX ? Array.from({ length: Math.floor(x1) - Math.ceil(x0) + 1 }, (_, i) => 10 ** (Math.ceil(x0) + i)) : niceTicks(x0, x1, 6);
  for (const v of xt) {
    svg.append(el("line", { x1: sx(v), x2: sx(v), y1: T, y2: H - B, stroke: grid, "stroke-width": 1 }));
    const t = el("text", { x: sx(v), y: H - B + 14, "text-anchor": "middle" }); t.textContent = fmtTick(v); svg.append(t);
  }
  svg.append(el("rect", { x: L, y: T, width: W - L - R, height: H - T - B, fill: "none", stroke: grid }));
  if (opts.xLabel) { const t = el("text", { x: (L + W - R) / 2, y: H - 4, "text-anchor": "middle" }); t.textContent = opts.xLabel; svg.append(t); }
  if (opts.yLabel) { const t = el("text", { x: 10, y: T + (H - T - B) / 2, "text-anchor": "middle", transform: `rotate(-90 10 ${T + (H - T - B) / 2})` }); t.textContent = opts.yLabel; svg.append(t); }
  // Kurven (auf ~800 Punkte ausgedünnt)
  for (const s of series) {
    const step = Math.max(1, Math.floor(s.x.length / 800));
    let d = "";
    for (let i = 0; i < s.x.length; i += step) {
      const yv = Math.min(Math.max(s.y[i], y0 - (y1 - y0)), y1 + (y1 - y0));
      d += `${d ? "L" : "M"}${sx(s.x[i]).toFixed(1)} ${sy(yv).toFixed(1)}`;
    }
    svg.append(el("path", { d, fill: "none", stroke: s.color, "stroke-width": s.width ?? 2, "stroke-dasharray": s.dash ?? "", "stroke-linejoin": "round" }));
  }
  for (const m of opts.markers ?? []) {
    svg.append(el("line", { x1: sx(m.x), x2: sx(m.x), y1: T, y2: H - B, stroke: m.color, "stroke-dasharray": "3 3" }));
  }
  const legend = h("div", { class: "legend" }, ...series.filter((s) => s.label).map((s) => h("span", {}, h("i", { style: `background:${s.color}` }), s.label)));
  return h("div", { class: "row chart-row" }, svg, legend);
}
