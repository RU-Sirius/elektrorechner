import * as C from "./calc.js";
import { LEGAL, DISCLAIMER, settings, h, section, inputRow, resultRow, msgRow, selectRow, segmented, navRow } from "./ui.js";
import * as T from "./tools.js";
import * as T2 from "./tools2.js";
import * as T3 from "./tools3.js";
import { installView } from "./install.js";
import * as AT from "./autotools.js";
import { speedtestView } from "./speedtest.js";
import { favorites, saveBar, projectsView, reportView, saves } from "./projects.js";
import { clearCurrentState, setPreset } from "./ui.js";

const view = document.getElementById("view");
const header = document.querySelector("header");
const titleEl = document.getElementById("title");
const back = document.getElementById("back");
back.onclick = () => (location.hash = "");
const favBtn = document.getElementById("fav");

// ---------- Ansichten ----------
// Alle Rechner: Schlüssel → [Listenname, Kurztitel, Farbe, Symbol, Ansicht]
const G = "#ff9500", E = "#34c759", S = "#ff3b30", P = "#ffcc00", L = "#5856d6", N = "#007aff";
const TOOLS = {
  ohm: ["Ohmsches Gesetz & Widerstand", "Ohmsches Gesetz", G, "Ω", ohmView],
  combine: ["Reihen- & Parallelschaltung", "Reihe & Parallel", G, "⫴", T.combine],
  divider: ["Spannungsteiler", "Spannungsteiler", G, "÷", T.voltageDivider],
  db: ["Dezibel-Rechner", "Dezibel", G, "dB", T.decibel],
  power: ["Strom aus Leistung / Leistung aus Strom", "Leistung", E, "P", T.acPower],
  section: ["Leitungsberechnung (Querschnitt)", "Mindestquerschnitt", E, "⌀", () => cableView("section")],
  drop: ["Spannungsfall", "Spannungsfall", E, "↘", () => cableView("drop")],
  maxlen: ["Max. Leitungslänge (ΔU & Abschaltung)", "Max. Leitungslänge", E, "↔", T2.maxLength],
  wire: ["Leitungswiderstand & Temperatur", "Leitungswiderstand", E, "ϑ", T.wireResistance],
  comp: ["Blindleistungskompensation", "Kompensation", E, "C", T.compensation],
  stardelta: ["Stern-Dreieck-Umrechnung", "Stern-Dreieck", E, "Y", T.starDelta],
  overload: ["Schutzorgan / Absicherung", "Schutzorgan", S, "⚡", T2.overload],
  loop: ["Schleifenimpedanz & Abschaltbedingung", "Schleifenimpedanz", S, "Zs", T2.loop],
  ik: ["Kurzschlussstrom", "Kurzschlussstrom", S, "Ik", T2.shortCircuit],
  selectivity: ["Selektivität (gG-Sicherungen)", "Selektivität", S, "≥", T2.selectivity],
  feeder: ["UVT-Zuleitung (Gesamtprüfung)", "UVT-Zuleitung", S, "UV", T2.feeder],
  trafo: ["Trafo- & Einspeiseberechnung", "Transformator", S, "T", T2.transformerView],
  site: ["Baustromanschluss", "Baustrom", N, "⚒", T2.constructionSite],
  ev: ["Ladeinfrastruktur (E-Mobilität)", "Ladeinfrastruktur", N, "🔌", T2.evCharging],
  pvstring: ["PV-Stringauslegung", "PV-Stringauslegung", P, "☀", T.pvString],
  pvyield: ["PV-Ertrag & Amortisation", "PV-Ertrag", P, "€", T.pvYield],
  battery: ["Energiespeicher", "Energiespeicher", P, "▮", T.battery],
  emlight: ["Batterie Sicherheitsbeleuchtung", "Sicherheitsbeleuchtung", S, "⚠", T2.emergencyLight],
  alarm: ["BMA / EMA Notstrombatterie", "BMA / EMA", S, "🔔", T2.alarmSystem],
  saa: ["SAA / ELA Leistungsprüfung", "SAA-Leistung", S, "📢", T2.speakerSystem],
  led: ["LED-Vorwiderstand", "LED-Vorwiderstand", L, "◐", T.led],
  resistor: ["Widerstands-Farbcode", "Farbcode", L, "▥", resistorView],
  eseries: ["E-Reihen-Normwerte", "E-Reihen", L, "E", T.eSeriesView],
  reactance: ["Blindwiderstand & Resonanz", "Blindwiderstand", L, "X", T.reactance],
  tau: ["RC/RL-Zeitkonstante", "Zeitkonstante", L, "τ", T.timeConstant],
  loopsim: ["Regelkreis-Simulation (Sprungantwort)", "Regelkreis-Simulation", "#af52de", "⟿", AT.loopSim],
  bode: ["Frequenzgang & Stabilität (Bode)", "Bode-Diagramm", "#af52de", "∿", AT.bode],
  zn: ["Reglereinstellung (Ziegler-Nichols)", "Ziegler-Nichols", "#af52de", "ZN", AT.zieglerNichols],
  pt2: ["PT2-Glied (Dämpfung, Überschwingen)", "PT2-Glied", "#af52de", "D", AT.pt2View],
  pidforms: ["PID-Parameter umrechnen", "PID-Formen", "#af52de", "Kp", AT.pidFormsView],
  analog: ["Analogwert-Skalierung (4–20 mA, SPS)", "Analogwert", "#af52de", "mA", AT.analog],
  numbers: ["Zahlensysteme (Hex, Bin, BCD, REAL)", "Zahlensysteme", "#af52de", "16#", AT.numbers],
  logic: ["Logik: Wahrheitstabelle & Minimierung", "Logik", "#af52de", "∧", AT.logic],
  encoder: ["Inkrementalgeber", "Drehgeber", "#af52de", "◴", AT.encoderView],
  vfd: ["Frequenzumrichter & Motordrehzahl", "Frequenzumrichter", "#af52de", "f", AT.vfdView],
  rtd: ["Pt100 / Pt1000", "Pt100/Pt1000", "#af52de", "ϑ", AT.rtd],
  speed: ["Speedtest (Download, Ping)", "Speedtest", "#30b0c7", "⏱", speedtestView],
  ipv4: ["IPv4-Subnetzrechner", "IPv4-Subnetz", "#30b0c7", "v4", T3.ipv4],
  subnetting: ["IPv4-Subnetting (Netz aufteilen)", "Subnetting", "#30b0c7", "⊞", T3.ipv4Subnetting],
  ipv6: ["IPv6-Adressen & Präfixe", "IPv6", "#30b0c7", "v6", T3.ipv6],
  transfer: ["Datenübertragung & Bandbreite", "Datenübertragung", "#30b0c7", "⇅", T3.transfer],
  poe: ["PoE-Leistungsbudget", "PoE-Budget", "#30b0c7", "PoE", T3.poe],
  fiber: ["LWL-Dämpfungsbudget", "LWL-Budget", "#30b0c7", "◎", T3.fiber],
  nettables: ["Netzwerk-Tabellen", "Netzwerk-Tabellen", "#30b0c7", "☰", T3.networkTables],
  ip: ["IP-Schutzarten", "IP-Schutzart", N, "IP", T2.ipCode],
  tables: ["Tabellen & Praxiswerte (inkl. IK)", "Tabellen", N, "☰", T2.tables],
};
const nav = (key) => navRow(key, TOOLS[key][0], TOOLS[key][2], TOOLS[key][3]);
const GROUPS = [
  ["Grundlagen", ["ohm", "combine", "divider", "db"]],
  ["Leitungen & Energietechnik", ["power", "section", "drop", "maxlen", "wire", "comp", "stardelta"]],
  ["Schutztechnik & Einspeisung", ["overload", "loop", "ik", "selectivity", "feeder", "trafo"]],
  ["Anschlüsse", ["site", "ev"]],
  ["Photovoltaik & Speicher", ["pvstring", "pvyield", "battery"]],
  ["Sicherheitstechnik", ["emlight", "alarm", "saa"]],
  ["Elektronik", ["led", "resistor", "eseries", "reactance", "tau"]],
  ["Automatisierung: Regelungstechnik", ["loopsim", "bode", "zn", "pt2", "pidforms"]],
  ["Automatisierung: Steuerungstechnik", ["analog", "numbers", "logic", "encoder", "vfd", "rtd"]],
  ["Netzwerktechnik", ["speed", "ipv4", "subnetting", "ipv6", "transfer", "poe", "fiber", "nettables"]],
  ["Nachschlagen", ["ip", "tables"]],
];

function home() {
  const favs = favorites.list().filter((k) => k in TOOLS);
  const nSaved = saves.list().length;
  return [
    ...(favs.length ? section("★ Favoriten", favs.map(nav)) : []),
    ...section("", [navRow("projects", `Projekte & gespeicherte Berechnungen${nSaved ? ` (${nSaved})` : ""}`, "#8e8e93", "📁")]),
    ...GROUPS.flatMap(([title, keys]) => section(title, keys.map(nav))),
    ...section("", [navRow("install", "App installieren (iPhone, iPad, Mac)", "#8e8e93", "⤓"), navRow("settings", "Einstellungen", "#8e8e93", "⚙")]),
    h("div", { class: "credit" }, "Built by R. U. Sirius?"),
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
    ...section("Haftungshinweis", [h("div", { class: "row" }, h("span", { class: "hint" }, LEGAL))]),
    ...section("Hinweis zu Leitungsberechnungen", [h("div", { class: "row" }, h("span", { class: "hint" }, DISCLAIMER))]),
    ...section("", [resultRow("Version", "1.6.0 (Web)"), resultRow("Entwickelt von", "R. U. Sirius?"), resultRow("Lizenz", "MIT")]),
  ];
}

// ---------- Routing ----------
const PAGES = { settings: ["Einstellungen", settingsView], projects: ["Projekte", projectsView], install: ["App installieren", installView] };
function route() {
  const [key, arg] = location.hash.slice(1).split("/");
  clearCurrentState();
  let title, nodes, isTool = false;
  if (key in TOOLS) { title = TOOLS[key][1]; nodes = TOOLS[key][4](); isTool = true; }
  else if (key in PAGES) { title = PAGES[key][0]; nodes = PAGES[key][1](); }
  else if (key === "report" && arg) { title = "Projektbericht"; nodes = reportView(decodeURIComponent(arg)); }
  else { title = "ElektroRechner"; nodes = home(); }
  const isHome = title === "ElektroRechner";
  titleEl.textContent = title;
  header.classList.toggle("sub", !isHome);
  back.hidden = isHome;
  favBtn.hidden = !isTool;
  if (isTool) {
    const set = () => { favBtn.textContent = favorites.has(key) ? "★" : "☆"; };
    set();
    favBtn.onclick = () => { favorites.toggle(key); set(); };
  }
  view.replaceChildren(...nodes);
  setPreset(null); // nicht verbrauchte Voreinstellung verwerfen
  if (isTool && !["tables", "nettables"].includes(key)) {
    view.append(saveBar(key, title, view), h("div", { class: "print-only" }, `ElektroRechner – Built by R. U. Sirius? · ${LEGAL}`));
  }
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);
route();

// Haftungshinweis beim ersten Start bestätigen lassen.
if (localStorage.getItem("legalAccepted") !== "1") {
  const overlay = h("div", { class: "modal", role: "dialog", "aria-modal": "true" },
    h("div", { class: "modal-box" },
      h("h2", {}, "Bitte beachten"),
      h("p", {}, LEGAL),
      h("button", { class: "modal-btn", onclick: () => { localStorage.setItem("legalAccepted", "1"); overlay.remove(); } }, "Verstanden")));
  document.body.append(overlay);
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((reg) => {
  // Bei jedem Zurückkehren in die App nach Updates schauen.
  document.addEventListener("visibilitychange", () => { if (!document.hidden) reg.update(); });
});
// Sobald eine neue Version aktiv ist: einmal neu laden, damit sie sofort sichtbar wird.
// (Nicht beim allerersten Start, da gibt es noch keine alte Version.)
let reloaded = false;
const hadController = !!navigator.serviceWorker?.controller;
navigator.serviceWorker?.addEventListener("controllerchange", () => {
  if (hadController && !reloaded) { reloaded = true; location.reload(); }
});
