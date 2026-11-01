import * as C from "./calc.js";

export const LEGAL = "Kostenloses Hilfsmittel ohne Gewähr. Alle Ergebnisse beruhen auf vereinfachten Formeln und dienen nur der Orientierung. " +
  "Sie ersetzen keine Planung, Bemessung und Prüfung nach den geltenden Normen und Vorschriften durch eine Elektrofachkraft. " +
  "Arbeiten an elektrischen Anlagen gehören in die Hände von Elektrofachkräften. Die Nutzung erfolgt auf eigene Verantwortung.";

export const DISCLAIMER = "Vereinfachte Berechnung ohne Leitungsreaktanz und ohne Temperaturkorrektur. " +
  "Strombelastbarkeit, Verlegeart, Häufung, Kurzschluss- und Abschaltbedingungen werden nicht geprüft. " +
  "Das Ergebnis ersetzt keine normgerechte Bemessung durch eine Elektrofachkraft.";

export const settings = {
  get maxPercent() { return Number(localStorage.getItem("maxPercent")) || 3; },
  set maxPercent(v) { localStorage.setItem("maxPercent", String(v)); },
};

// ---------- kleine DOM-Helfer ----------
export const h = (tag, attrs = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (v !== undefined && v !== null && v !== false) el.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null) el.append(c);
  return el;
};
export const section = (title, rows, footer) => [
  title ? h("div", { class: "section-title" }, title) : null,
  h("div", { class: "group" }, rows),
  footer ? h("div", { class: "footer" }, footer) : null,
].filter(Boolean);
// mode: "decimal" (Zahlentastatur) oder "text" (volle Tastatur, z. B. für IP-Adressen, Hex, Logik).
export const inputRow = (label, unit, value, oninput, id, mode = "decimal") =>
  h("label", { class: "row" + (mode === "text" ? " wide" : "") }, h("span", { class: "label" }, label),
    h("input", { type: "text", inputmode: mode, value, placeholder: "–", id, oninput, autocomplete: "off",
                 autocapitalize: mode === "text" ? "off" : undefined, autocorrect: mode === "text" ? "off" : undefined, spellcheck: mode === "text" ? "false" : undefined }),
    h("span", { class: "unit" }, unit));
export const resultRow = (label, value, cls = "") =>
  h("div", { class: "row" }, h("span", { class: "label" }, label), h("span", { class: "value " + cls }, value));
export const msgRow = (text, cls = "hint") => h("div", { class: "row" }, h("span", { class: cls }, text));
export const selectRow = (label, options, value, onchange) =>
  h("label", { class: "row" }, h("span", { class: "label" }, label),
    h("select", { onchange }, options.map(([v, t]) => h("option", { value: v, selected: v === value }, t))));
export const segmented = (options, value, onpick) =>
  h("div", { class: "row seg-row" }, h("div", { class: "seg" },
    options.map(([v, t]) => h("button", { class: v === value ? "on" : "", onclick: () => onpick(v) }, t))));
export const navRow = (hash, label, color, icon) =>
  h("a", { class: "row", href: "#" + hash },
    h("span", { class: "icon", style: `background:${color}` }, icon), h("span", { class: "label" }, label));


// Generischer Rechner: Eingaben → Ergebnis, mit sofortiger Neuberechnung.
const ERRORS = {
  positive: "Bitte gültige Werte > 0 eingeben.",
  cos: "cos φ muss zwischen 0 und 1 liegen.",
  eta: "Wirkungsgrad muss zwischen 0 und 1 liegen.",
};
// Gespeicherte Eingaben, die beim nächsten Öffnen eines Rechners übernommen werden.
let preset = null;
export const setPreset = (v) => { preset = v; };
// Zustand des gerade angezeigten Rechners (für „Speichern“).
export let currentState = null;
export const clearCurrentState = () => { currentState = null; };

export function calcView({ init, inputs, compute, resultTitle = "Ergebnis", footer, rangeMsg = "Werte außerhalb des gültigen Bereichs." }) {
  const s = { ...init, ...(preset ?? {}) };
  preset = null;
  currentState = s;
  const container = h("div");
  const resultBox = h("div");
  const bind = (k) => (e) => { s[k] = e.target.value; renderResult(); };
  const set = (k, v) => { s[k] = v; renderAll(); };
  const field = (k, label, unit, mode) => inputRow(label, unit, s[k], bind(k), undefined, mode);
  const renderResult = () => {
    let rows;
    try { rows = compute(s, C.parse); }
    catch (e) { rows = [msgRow(e.message === "range" ? rangeMsg : ERRORS[e.message] ?? ERRORS.positive)]; }
    resultBox.replaceChildren(...section(resultTitle, rows.filter(Boolean)));
  };
  const renderAll = () => {
    container.replaceChildren(...inputs(s, { field, set }), resultBox,
      ...(footer ? [h("div", { class: "footer" }, typeof footer === "function" ? footer(s) : footer)] : []));
    renderResult();
  };
  renderAll();
  return [container];
}
export const PREFIX_HINT = "Eingabe auch mit Präfix möglich, z. B. 4,7k · 100n · 2,2µ · 10m.";
