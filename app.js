import * as C from "./calc.js";

const view = document.getElementById("view");
const header = document.querySelector("header");
const titleEl = document.getElementById("title");
const back = document.getElementById("back");
back.onclick = () => (location.hash = "");

const DISCLAIMER = "Vereinfachte Berechnung ohne Leitungsreaktanz und ohne Temperaturkorrektur. " +
  "Strombelastbarkeit, Verlegeart, Häufung, Kurzschluss- und Abschaltbedingungen werden nicht geprüft. " +
  "Das Ergebnis ersetzt keine normgerechte Bemessung durch eine Elektrofachkraft.";

const settings = {
  get maxPercent() { return Number(localStorage.getItem("maxPercent")) || 3; },
  set maxPercent(v) { localStorage.setItem("maxPercent", String(v)); },
};

// ---------- kleine DOM-Helfer ----------
const h = (tag, attrs = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (v !== undefined && v !== null && v !== false) el.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null) el.append(c);
  return el;
};
const section = (title, rows, footer) => [
  title ? h("div", { class: "section-title" }, title) : null,
  h("div", { class: "group" }, rows),
  footer ? h("div", { class: "footer" }, footer) : null,
].filter(Boolean);
const inputRow = (label, unit, value, oninput, id) =>
  h("label", { class: "row" }, h("span", { class: "label" }, label),
    h("input", { type: "text", inputmode: "decimal", value, placeholder: "–", id, oninput, autocomplete: "off" }),
    h("span", { class: "unit" }, unit));
const resultRow = (label, value, cls = "") =>
  h("div", { class: "row" }, h("span", { class: "label" }, label), h("span", { class: "value " + cls }, value));
const msgRow = (text, cls = "hint") => h("div", { class: "row" }, h("span", { class: cls }, text));
const selectRow = (label, options, value, onchange) =>
  h("label", { class: "row" }, h("span", { class: "label" }, label),
    h("select", { onchange }, options.map(([v, t]) => h("option", { value: v, selected: v === value }, t))));
const segmented = (options, value, onpick) =>
  h("div", { class: "row seg-row" }, h("div", { class: "seg" },
    options.map(([v, t]) => h("button", { class: v === value ? "on" : "", onclick: () => onpick(v) }, t))));
const navRow = (hash, label, color, icon) =>
  h("a", { class: "row", href: "#" + hash },
    h("span", { class: "icon", style: `background:${color}` }, icon), h("span", { class: "label" }, label));

// ---------- Ansichten ----------
function home() {
  return [
    ...section("Grundlagen", [navRow("ohm", "Ohmsches Gesetz & Leistung", "#ff9500", "Ω")]),
    ...section("Leitungen", [
      navRow("drop", "Spannungsfall", "#34c759", "↘"),
      navRow("section", "Mindestquerschnitt", "#ff9500", "⌀"),
    ]),
    ...section("Bauteile", [navRow("resistor", "Widerstands-Farbcode", "#5856d6", "▥")]),
    ...section("", [navRow("settings", "Einstellungen", "#8e8e93", "⚙")]),
  ];
}

function ohmView() {
  const s = { u: "", i: "", r: "", p: "" };
  const result = h("div", { class: "group" });
  const update = () => {
    const vals = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, C.parse(v)]));
    let rows;
    if (Object.values(vals).every((v) => v === null)) {
      rows = [msgRow("U = R · I    P = U · I")];
    } else {
      try {
        const r = C.ohm(vals);
        rows = [resultRow("U", C.si(r.u, "V")), resultRow("I", C.si(r.i, "A")),
                resultRow("R", C.si(r.r, "Ω")), resultRow("P", C.si(r.p, "W"))];
      } catch (e) {
        rows = [e.message === "two" ? msgRow("Bitte genau zwei Felder ausfüllen.")
                                    : msgRow("Alle Werte müssen größer als 0 sein.", "error")];
      }
    }
    result.replaceChildren(...rows);
  };
  const field = (k, label, unit) => inputRow(label, unit, "", (e) => { s[k] = e.target.value; update(); }, "ohm-" + k);
  const fields = [field("u", "Spannung U", "V"), field("i", "Strom I", "A"),
                  field("r", "Widerstand R", "Ω"), field("p", "Leistung P", "W")];
  update();
  return [
    ...section("Genau zwei Werte eingeben", fields),
    h("div", { class: "section-title" }, "Ergebnis"), result,
    h("div", { class: "section-title" }),
    h("div", { class: "group" }, h("button", { class: "action", onclick: () => {
      for (const k in s) s[k] = "";
      fields.forEach((f) => (f.querySelector("input").value = ""));
      update();
    } }, "Zurücksetzen")),
  ];
}

// Gemeinsamer Aufbau für Spannungsfall und Mindestquerschnitt.
function cableView(mode) {
  const s = { system: "ac1", material: "cu", voltage: "230", current: "16",
              length: mode === "drop" ? "20" : "30", section: "1,5", cos: "1", kappa: "56", maxPercent: "" };
  const container = h("div");
  const render = () => {
    const bind = (k) => (e) => { s[k] = e.target.value; renderResult(); };
    const netRows = [
      segmented(Object.entries(C.SYSTEMS).map(([k, v]) => [k, v.name]), s.system, (v) => {
        s.system = v; s.voltage = String(C.SYSTEMS[v].voltage); render();
      }),
      inputRow(s.system === "ac3" ? "Außenleiterspannung" : "Spannung", "V", s.voltage, bind("voltage")),
      inputRow("Strom", "A", s.current, bind("current")),
      s.system !== "dc" ? inputRow("cos φ", "", s.cos, bind("cos")) : null,
    ];
    const lineRows = [
      inputRow("Einfache Länge", "m", s.length, bind("length")),
      mode === "drop" ? inputRow("Querschnitt", "mm²", s.section, bind("section")) : null,
      selectRow("Material", Object.entries(C.MATERIALS).map(([k, v]) => [k, v.name]), s.material, (e) => {
        s.material = e.target.value; s.kappa = String(C.MATERIALS[s.material].kappa); render();
      }),
      inputRow("Leitfähigkeit κ", "m/Ωmm²", s.kappa, bind("kappa")),
      mode === "section"
        ? (() => { const r = inputRow("Max. Spannungsfall", "%", s.maxPercent, bind("maxPercent"));
                   r.querySelector("input").placeholder = C.fmt(settings.maxPercent); return r; })()
        : null,
    ];
    container.replaceChildren(...section("Netz", netRows), ...section("Leitung", lineRows), resultBox, ...resultFooter());
    renderResult();
  };
  const resultBox = h("div");
  const resultFooter = () => [h("div", { class: "footer" }, mode === "drop"
    ? `Grenzwert für die Farbmarkierung: ${C.fmt(settings.maxPercent)} % (in den Einstellungen änderbar).\n\n${DISCLAIMER}`
    : `Der Querschnitt muss zusätzlich nach Strombelastbarkeit und Schutzorgan bemessen werden; maßgeblich ist der größere Wert.\n\n${DISCLAIMER}`)];
  const renderResult = () => {
    const p = {
      system: s.system, voltage: C.parse(s.voltage), current: C.parse(s.current), length: C.parse(s.length),
      section: C.parse(s.section), cos: C.parse(s.cos), kappa: C.parse(s.kappa),
      maxPercent: C.parse(s.maxPercent) ?? settings.maxPercent,
    };
    let rows;
    try {
      if (mode === "drop") {
        const r = C.voltageDrop(p);
        rows = [resultRow("Spannungsfall ΔU", C.fmt(r.drop) + " V"),
                resultRow("Relativ", C.fmt(r.percent) + " %", r.percent > settings.maxPercent ? "bad" : "good"),
                resultRow("Spannung am Verbraucher", C.fmt(r.atLoad) + " V"),
                resultRow("Verlustleistung", C.fmt(r.loss, 1) + " W")];
      } else {
        const r = C.minSection(p);
        rows = [resultRow("Rechnerisch", C.fmt(r.required) + " mm²"),
                r.standard !== null ? resultRow("Nächster Normquerschnitt", C.fmt(r.standard) + " mm²", "good")
                                    : msgRow("Größer als 300 mm²: Parallelleiter oder höhere Spannung prüfen.", "warn")];
      }
    } catch {
      rows = [msgRow("Bitte gültige Werte > 0 eingeben (cos φ: 0 … 1).")];
    }
    resultBox.replaceChildren(...section(mode === "drop" ? "Ergebnis" : "Ergebnis (nur nach Spannungsfall)", rows));
  };
  render();
  return [container];
}

function resistorView() {
  const s = { five: false, d: ["yellow", "violet", "black"], mult: "red", tol: "gold" };
  const container = h("div");
  const digitOpts = C.BANDS.filter((b) => b.digit !== undefined);
  const tolOpts = C.BANDS.filter((b) => b.tol !== undefined);
  const bandSelect = (label, opts, value, set) => {
    const row = selectRow(label, opts.map((b) => [b.id, b.name]), value, (e) => { set(e.target.value); render(); });
    row.querySelector(".label").prepend(h("span", { class: "swatch", style: `background:${C.band(value).css}` }), " ");
    return row;
  };
  const drawing = (ids) => {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 300 80"); svg.setAttribute("class", "resistor"); svg.setAttribute("aria-hidden", "true");
    const add = (tag, a) => { const e = document.createElementNS(ns, tag); for (const k in a) e.setAttribute(k, a[k]); svg.append(e); };
    add("rect", { x: 0, y: 38, width: 300, height: 4, fill: "#999" });
    add("rect", { x: 55, y: 14, width: 190, height: 52, rx: 16, fill: "#dcc294" });
    ids.forEach((id, n) => {
      const last = n === ids.length - 1;
      add("rect", { x: last ? 215 : 80 + n * 26, y: 14, width: 12, height: 52, fill: C.band(id).css });
    });
    return svg;
  };
  const render = () => {
    const digits = s.five ? s.d : s.d.slice(0, 2);
    const value = C.resistor(digits, s.mult);
    const tol = C.band(s.tol).tol;
    container.replaceChildren(
      drawing([...digits, s.mult, s.tol]),
      ...section("", [
        resultRow("Widerstand", C.si(value, "Ω")),
        resultRow("Toleranz", `± ${C.fmt(tol)} %`),
        resultRow("Bereich", `${C.si(value * (1 - tol / 100), "Ω")} … ${C.si(value * (1 + tol / 100), "Ω")}`),
      ]),
      ...section("Ringe", [
        segmented([["4", "4 Ringe"], ["5", "5 Ringe"]], s.five ? "5" : "4", (v) => { s.five = v === "5"; render(); }),
        bandSelect("1. Ziffer", digitOpts, s.d[0], (v) => (s.d[0] = v)),
        bandSelect("2. Ziffer", digitOpts, s.d[1], (v) => (s.d[1] = v)),
        s.five ? bandSelect("3. Ziffer", digitOpts, s.d[2], (v) => (s.d[2] = v)) : null,
        bandSelect("Multiplikator", C.BANDS, s.mult, (v) => (s.mult = v)),
        bandSelect("Toleranz", tolOpts, s.tol, (v) => (s.tol = v)),
      ]),
    );
  };
  render();
  return [container];
}

function settingsView() {
  const opts = [];
  for (let v = 0.5; v <= 10; v += 0.5) opts.push([String(v), C.fmt(v) + " %"]);
  return [
    ...section("Berechnung", [
      selectRow("Grenzwert Spannungsfall", opts, String(settings.maxPercent), (e) => (settings.maxPercent = Number(e.target.value))),
    ], "Wird für die Farbmarkierung und als Vorgabe beim Mindestquerschnitt verwendet. Welcher Grenzwert gilt, hängt von der Anlage und den anzuwendenden Regeln ab."),
    ...section("Hinweis", [h("div", { class: "row" }, h("span", { class: "hint" }, DISCLAIMER))]),
    ...section("", [resultRow("Version", "1.0.0 (Web)")]),
  ];
}

// ---------- Routing ----------
const routes = {
  "": ["ElektroRechner", home],
  ohm: ["Ohmsches Gesetz", ohmView],
  drop: ["Spannungsfall", () => cableView("drop")],
  section: ["Mindestquerschnitt", () => cableView("section")],
  resistor: ["Farbcode", resistorView],
  settings: ["Einstellungen", settingsView],
};
function route() {
  const key = location.hash.slice(1);
  const [title, render] = routes[key] ?? routes[""];
  const isHome = !(key in routes) || key === "";
  titleEl.textContent = title;
  header.classList.toggle("sub", !isHome);
  back.hidden = isHome;
  view.replaceChildren(...render());
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);
route();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
