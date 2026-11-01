// Automatisierung: Ansichten für Regelungs- und Steuerungstechnik.
import * as C from "./calc.js";
import * as AU from "./auto.js";
import { calcView, section, segmented, selectRow, resultRow, msgRow, h, PREFIX_HINT } from "./ui.js";
import { lineChart } from "./chart.js";

const fmt = C.fmt;
const sec = (v) => (v === null || v === undefined ? "–" : `${fmt(v, v < 10 ? 3 : 1)} s`);
const BLUE = "#0a84ff", ORANGE = "#ff9500", GRAY = "#8e8e93", GREEN = "#34c759";

// ---------- Regelkreis: gemeinsame Eingaben ----------
const loopInputs = (s, field, set, { withSim = true } = {}) => [
  ...section("Strecke (PTn mit Totzeit)", [field("ks", "Streckenverstärkung Ks", ""), field("t1", "Zeitkonstante T", "s"),
    selectRow("Ordnung n (gleiche PT1-Glieder)", [1, 2, 3, 4, 5, 6].map((n) => [String(n), `PT${n}`]), s.n, (e) => set("n", e.target.value)), field("tt", "Totzeit Tt", "s")]),
  ...section("Regler (ideale Form)", [
    selectRow("Typ", (withSim ? [["open", "ohne Regler (nur Strecke)"]] : []).concat([["P", "P"], ["PI", "PI"], ["PD", "PD"], ["PID", "PID"]]), s.type, (e) => set("type", e.target.value)),
    ...(s.type === "open" ? [] : [field("kp", "Verstärkung Kp", ""), ...(s.type.includes("I") ? [field("tn", "Nachstellzeit Tn", "s")] : []),
      ...(s.type.includes("D") ? [field("tv", "Vorhaltzeit Tv", "s")] : [])]),
    ...(withSim && s.type !== "open" ? [field("umax", "Stellgrößengrenze max. (optional)", ""), field("umin", "Stellgrößengrenze min. (optional)", "")] : []),
  ]),
  ...(withSim ? section("Simulation", [field("tend", "Dauer (leer = automatisch)", "s")]) : []),
];
const loopParams = (s, p) => ({ ks: p(s.ks), t1: p(s.t1), n: Number(s.n), tt: p(s.tt) ?? 0, type: s.type, kp: p(s.kp), tn: p(s.tn), tv: p(s.tv) });
const LOOP_INIT = { ks: "2", t1: "5", n: "2", tt: "1", type: "PI", kp: "0,8", tn: "8", tv: "2", umax: "", umin: "", tend: "" };

export function loopSim() {
  return calcView({
    init: { ...LOOP_INIT },
    inputs: (s, { field, set }) => loopInputs(s, field, set),
    compute: (s, p) => {
      const open = s.type === "open";
      const r = AU.simulateLoop({ ...loopParams(s, p), mode: open ? "open" : "closed", umax: p(s.umax), umin: p(s.umin), tEnd: p(s.tend) });
      const series = [{ x: r.t, y: r.y, color: BLUE, label: open ? "Ausgang y (Sprungantwort)" : "Regelgröße y" }];
      if (!open) series.unshift({ x: r.t, y: r.w, color: GRAY, dash: "6 4", width: 1.5, label: "Sollwert w" }, { x: r.t, y: r.u, color: ORANGE, width: 1.5, label: "Stellgröße u" });
      return [
        lineChart(series, { xLabel: "t in s" }),
        resultRow("Endwert y", fmt(r.yEnd, 4)),
        !open ? resultRow("Bleibende Regelabweichung", fmt(1 - r.yEnd, 4), Math.abs(1 - r.yEnd) < 0.01 ? "good" : "") : null,
        resultRow("Überschwingen", `${fmt(r.overshoot, 1)} %`, r.overshoot > 20 ? "bad" : ""),
        resultRow("Anstiegszeit (10 … 90 %)", sec(r.rise)),
        resultRow("Ausregelzeit (±2 %)", r.settled ? sec(r.settle) : "nicht erreicht", r.settled ? "good" : "bad"),
        r.overshoot > 60 || !r.settled ? msgRow("Hinweis: Der Kreis schwingt stark oder ist instabil – Kp verkleinern bzw. Tn vergrößern.", "warn") : null,
      ];
    },
    footer: "Strecke G(s) = Ks·e^(−s·Tt)/(1 + s·T)^n. Numerische Simulation (Runge-Kutta 4) eines Führungssprungs w = 1. Regler in idealer Form u = Kp·(e + 1/Tn·∫e dt + Tv·de/dt), D-Anteil mit Verzögerung Tv/10 gefiltert, " +
            "Anti-Windup durch Anhalten des Integrators bei Begrenzung. Modell-Ergebnis – reale Strecken weichen ab (Nichtlinearitäten, Störungen, Messrauschen).",
  });
}

export function bode() {
  return calcView({
    init: { ...LOOP_INIT },
    inputs: (s, { field, set }) => loopInputs(s, field, set, { withSim: false }),
    compute: (s, p) => {
      const r = AU.openLoopBode(loopParams(s, p));
      const pmOk = r.pm !== null && r.pm >= 30;
      return [
        lineChart([{ x: r.ws, y: r.mag, color: BLUE, label: "Betrag |L| in dB" }], { xLabel: "ω in 1/s", logX: true, height: 220, markers: r.wc ? [{ x: r.wc, color: GREEN }] : [] }),
        lineChart([{ x: r.ws, y: r.ph, color: ORANGE, label: "Phase φ in °" }], { xLabel: "ω in 1/s", logX: true, height: 220, yMin: Math.max(Math.min(...r.ph), -540) - 10, yMax: Math.max(...r.ph) + 10, markers: r.w180 ? [{ x: r.w180, color: "#ff3b30" }] : [] }),
        resultRow("Durchtrittsfrequenz ωc", r.wc ? `${fmt(r.wc, 4)} 1/s` : "–"),
        resultRow("Phasenreserve φR", r.pm !== null ? `${fmt(r.pm, 1)}°` : "–", r.pm === null ? "" : pmOk ? "good" : "bad"),
        resultRow("Phasenschnittfrequenz ω₁₈₀", r.w180 ? `${fmt(r.w180, 4)} 1/s` : "keine (Phase erreicht −180° nicht)"),
        resultRow("Amplitudenreserve", r.gm !== null ? `${fmt(r.gm, 1)} dB` : "–", r.gm === null ? "" : r.gm > 0 ? "good" : "bad"),
        r.pm !== null && r.pm <= 0 ? msgRow("Phasenreserve ≤ 0°: Der geschlossene Kreis ist instabil.", "error") : null,
      ];
    },
    footer: "Offener Kreis L(jω) = Regler · Strecke. Faustregel aus der Literatur: Phasenreserve etwa 30 … 60° für gut gedämpftes Verhalten. " +
            "Grüne Linie: Durchtrittsfrequenz, rote Linie: −180°-Schnitt.",
  });
}

export function zieglerNichols() {
  const rows = (r) => [["P", r.P], ["PI", r.PI], ["PID", r.PID]].map(([n, v]) =>
    resultRow(`${n}-Regler`, [`Kp = ${fmt(v.kp, 3)}`, v.tn !== undefined ? `Tn = ${fmt(v.tn, 3)} s` : null, v.tv !== undefined ? `Tv = ${fmt(v.tv, 3)} s` : null].filter(Boolean).join(" · ")));
  return calcView({
    init: { mode: "osc", kkrit: "5", tkrit: "10", tu: "2", tg: "20", ks: "1,5" },
    inputs: (s, { field, set }) => [
      ...section("Verfahren", [segmented([["osc", "Schwingungsversuch"], ["step", "Sprungantwort"]], s.mode, (v) => set("mode", v))]),
      ...section("Messwerte", s.mode === "osc" ? [field("kkrit", "Kritische Verstärkung Kp,krit", ""), field("tkrit", "Schwingungsdauer Tkrit", "s")]
        : [field("tu", "Verzugszeit Tu", "s"), field("tg", "Ausgleichszeit Tg", "s"), field("ks", "Streckenverstärkung Ks", "")]),
    ],
    compute: (s, p) => {
      if (s.mode === "osc") return rows(AU.znOscillation({ kkrit: p(s.kkrit), tkrit: p(s.tkrit) }));
      const r = AU.znStep({ tu: p(s.tu), tg: p(s.tg), ks: p(s.ks) });
      return [resultRow("Regelbarkeit Tg/Tu", `${fmt(r.ratio, 2)} – ${r.rating}`, r.ratio > 10 ? "good" : r.ratio < 3 ? "bad" : ""), ...rows(r)];
    },
    footer: (s) => (s.mode === "osc"
      ? "Schwingungsversuch: Strecke mit P-Regler an die Stabilitätsgrenze bringen (Dauerschwingung), Kp,krit und Periodendauer ablesen. "
      : "Sprungantwort: Tu und Tg über die Wendetangente ermitteln. Regelbarkeit nach verbreiteter Faustregel (> 10 gut, 3 … 10 noch, < 3 schwer). ") +
      "Ziegler-Nichols liefert Startwerte mit eher aggressivem Verhalten – Feinabstimmung an der Anlage bzw. mit der Regelkreis-Simulation.",
  });
}

export function pt2View() {
  return calcView({
    init: { k: "1", w0: "2", d: "0,5" },
    inputs: (s, { field }) => [...section("PT2-Glied", [field("k", "Verstärkung K", ""), field("w0", "Kennkreisfrequenz ω₀", "1/s"), field("d", "Dämpfung D", "")])],
    compute: (s, p) => {
      const r = AU.pt2({ k: p(s.k) ?? 1, w0: p(s.w0), d: p(s.d) });
      return [
        lineChart([{ x: r.t, y: r.t.map(() => p(s.k) ?? 1), color: GRAY, dash: "6 4", width: 1.5 }, { x: r.t, y: r.y, color: BLUE, label: "Sprungantwort" }], { xLabel: "t in s" }),
        resultRow("Überschwingweite", `${fmt(r.overshoot, 2)} %`), resultRow("Zeit bis Maximum", r.analytic ? sec(r.analytic.tPeak) : "– (kein Überschwingen)"),
        resultRow("Anstiegszeit (10 … 90 %)", sec(r.rise)), resultRow("Einschwingzeit (±2 %)", sec(r.settle)),
        r.analytic ? resultRow("Eigenkreisfrequenz ωd", `${fmt(r.analytic.wd, 4)} 1/s`) : null,
        resultRow("Verhalten", p(s.d) === 0 ? "ungedämpft (Dauerschwingung)" : p(s.d) < 1 ? "schwingend (unterkritisch gedämpft)" : p(s.d) === 1 ? "aperiodischer Grenzfall" : "aperiodisch (überkritisch gedämpft)"),
      ];
    },
    rangeMsg: "Die Dämpfung darf nicht negativ sein.",
    footer: "G(s) = K/(1 + 2D·s/ω₀ + s²/ω₀²). Überschwingweite und Zeit bis Maximum analytisch (D < 1), Anstiegs- und Einschwingzeit aus der numerisch berechneten Sprungantwort.",
  });
}

export function pidFormsView() {
  return calcView({
    init: { dir: "ideal", kp: "2", tn: "4", tv: "0,5", ki: "0,5", kd: "1", ts: "0,1" },
    inputs: (s, { field, set }) => [
      ...section("Umrechnung", [segmented([["ideal", "Kp, Tn, Tv → Ki, Kd"], ["par", "Kp, Ki, Kd → Tn, Tv"]], s.dir, (v) => set("dir", v))]),
      ...section("Parameter", s.dir === "ideal" ? [field("kp", "Kp", ""), field("tn", "Nachstellzeit Tn", "s"), field("tv", "Vorhaltzeit Tv", "s"), field("ts", "Abtastzeit Ts (optional)", "s")]
        : [field("kp", "Kp", ""), field("ki", "Ki", "1/s"), field("kd", "Kd", "s")]),
    ],
    compute: (s, p) => {
      if (s.dir === "par") { const r = AU.pidFromParallel({ kp: p(s.kp), ki: p(s.ki) ?? 0, kd: p(s.kd) ?? 0 });
        return [resultRow("Nachstellzeit Tn = Kp/Ki", r.tn ? `${fmt(r.tn, 4)} s` : "– (kein I-Anteil)"), resultRow("Vorhaltzeit Tv = Kd/Kp", r.tv ? `${fmt(r.tv, 4)} s` : "– (kein D-Anteil)")]; }
      const r = AU.pidForms({ kp: p(s.kp), tn: p(s.tn), tv: p(s.tv), ts: p(s.ts) });
      return [resultRow("Ki = Kp/Tn", `${fmt(r.ki, 5)} 1/s`), resultRow("Kd = Kp·Tv", `${fmt(r.kd, 5)} s`),
              ...(r.q0 !== undefined ? [resultRow("q₀", fmt(r.q0, 5)), resultRow("q₁", fmt(r.q1, 5)), resultRow("q₂", fmt(r.q2, 5))] : [])];
    },
    footer: "Parallelform u = Kp·e + Ki·∫e dt + Kd·de/dt. Digital (Geschwindigkeitsalgorithmus, Rechteck-Integration): Δu(k) = q₀·e(k) + q₁·e(k−1) + q₂·e(k−2). " +
            "Welche Form ein SPS-Baustein verwendet, steht in dessen Dokumentation.",
  });
}

// ---------- Steuerungstechnik ----------

const RAW_PRESETS = [["s7", "Siemens S7: 0 … 27648", 0, 27648], ["s7pm", "Siemens S7 bipolar: −27648 … 27648", -27648, 27648],
  ["12bit", "12 Bit: 0 … 4095", 0, 4095], ["16bit", "16 Bit: 0 … 65535", 0, 65535], ["pct", "Prozent: 0 … 100", 0, 100], ["custom", "eigener Bereich", null, null]];
export function analog() {
  return calcView({
    init: { signal: "4-20mA", from: "signal", value: "12", pmin: "0", pmax: "10", punit: "bar", preset: "s7", rmin: "0", rmax: "27648", supply: "24", umin: "" },
    inputs: (s, { field, set }) => [
      ...section("Signal & Messbereich", [selectRow("Signal", Object.entries(AU.SIGNALS).map(([k, v]) => [k, v.name]), s.signal, (e) => set("signal", e.target.value)),
        field("pmin", "Messbereich Anfang", s.punit), field("pmax", "Messbereich Ende", s.punit), field("punit", "Einheit", "", "text")]),
      ...section("SPS-Rohwert", [selectRow("Bereich", RAW_PRESETS.map(([k, n]) => [k, n]), s.preset, (e) => {
        const pr = RAW_PRESETS.find(([k]) => k === e.target.value); if (pr[2] !== null) { s.rmin = String(pr[2]); s.rmax = String(pr[3]); } set("preset", e.target.value); }),
        ...(s.preset === "custom" ? [field("rmin", "Rohwert Anfang", ""), field("rmax", "Rohwert Ende", "")] : [])]),
      ...section("Umrechnen", [selectRow("Gegeben ist", [["signal", "Signalwert"], ["phys", "Messwert"], ["raw", "Rohwert"]], s.from, (e) => set("from", e.target.value)),
        field("value", "Wert", s.from === "signal" ? AU.SIGNALS[s.signal].unit : s.from === "phys" ? s.punit : "")]),
      ...section("Bürde der Stromschleife (optional)", [field("supply", "Versorgungsspannung", "V"), field("umin", "Mindestspannung Messumformer", "V")]),
    ],
    compute: (s, p) => {
      const r = AU.analogScale({ signal: s.signal, from: s.from, value: p(s.value), pMin: p(s.pmin), pMax: p(s.pmax), rMin: p(s.rmin), rMax: p(s.rmax) });
      const sig = AU.SIGNALS[s.signal];
      const rows = [resultRow("Signal", `${fmt(r.signal, 3)} ${sig.unit}`), resultRow("Messwert", `${fmt(r.phys, 4)} ${s.punit}`), resultRow("Rohwert", fmt(Math.round(r.raw), 0), "good"),
                    resultRow("Anteil am Bereich", `${fmt(r.frac * 100, 2)} %`), r.outOfRange ? msgRow("Wert liegt außerhalb des Nennbereichs (Über-/Unterlauf, ggf. Drahtbruch).", "warn") : null];
      if (sig.unit === "mA" && p(s.supply) && p(s.umin) !== null) rows.push(resultRow("Max. Bürde (bei 20 mA)", `${fmt(AU.loopBurden({ supply: p(s.supply), uMin: p(s.umin) }), 0)} Ω`));
      return rows;
    },
    rangeMsg: "Bereich ungültig (Anfang = Ende) bzw. Versorgung ≤ Mindestspannung.",
    footer: "Lineare Skalierung. Rohwertbereiche sind Beispiele (Siemens S7: Nennbereich 0 … 27648 bzw. ±27648); maßgeblich ist die Dokumentation der verwendeten Analogbaugruppe. " +
            "Bürde: Summe aller Widerstände in der Schleife (Eingang, Leitung, Anzeigen) – Mindestspannung aus dem Datenblatt des Messumformers.",
  });
}

export function numbers() {
  return calcView({
    init: { text: "1234", base: "16", bits: "16", real: "1,5", realHex: "3FC00000" },
    inputs: (s, { field, set }) => [
      ...section("Ganzzahl", [field("text", "Wert", "", "text"), selectRow("Eingabe als", [["10", "Dezimal"], ["16", "Hexadezimal"], ["2", "Binär"]], s.base, (e) => set("base", e.target.value)),
        selectRow("Datentyp", [["8", "BYTE / SINT (8 Bit)"], ["16", "WORD / INT (16 Bit)"], ["32", "DWORD / DINT (32 Bit)"]], s.bits, (e) => set("bits", e.target.value))]),
      ...section("Gleitkomma REAL (IEEE 754, 32 Bit)", [field("real", "Dezimal → Hex", ""), field("realHex", "Hex → Dezimal", "", "text")]),
    ],
    compute: (s, p) => {
      const rows = [];
      try {
        const r = AU.numberSystems({ text: s.text, base: Number(s.base), bits: Number(s.bits) });
        rows.push(resultRow("Dezimal (vorzeichenlos)", r.unsigned.toString()), resultRow("Dezimal (mit Vorzeichen)", r.signed.toString()),
          resultRow("Hexadezimal", `16#${r.hex}`, "good"), resultRow("Binär", r.bin), resultRow("Gray-Code", r.gray),
          resultRow("Als BCD gelesen", r.bcdDecoded !== null ? String(r.bcdDecoded) : "– (kein gültiger BCD-Wert)"),
          resultRow("Dezimal als BCD kodiert", r.bcdEncoded !== null ? `16#${r.bcdEncoded}` : "– (zu groß)"));
      } catch { rows.push(msgRow("Ganzzahl: ungültige Eingabe oder Wert passt nicht in den Datentyp.", "error")); }
      const x = p(s.real); if (x !== null) rows.push(resultRow(`REAL ${fmt(x, 7)} →`, `16#${AU.realToHex(x)}`));
      try { if (s.realHex.trim()) rows.push(resultRow(`16#${s.realHex.trim().toUpperCase()} →`, String(AU.hexToReal(s.realHex)).replace(".", ","))); }
      catch { rows.push(msgRow("REAL-Hex: 1 bis 8 Hex-Ziffern eingeben.", "error")); }
      return rows;
    },
    footer: "Vorzeichenbehaftete Werte im Zweierkomplement. Präfixe 16#, 2#, 0x und 0b werden akzeptiert. REAL in einfacher Genauigkeit (Rundung auf 24 Bit Mantisse).",
  });
}

export function logic() {
  return calcView({
    init: { expr: "A & B | A & !B | !A & B & C" },
    inputs: (s, { field }) => [...section("Logischer Ausdruck", [field("expr", "Ausdruck", "", "text")],
      "Operatoren: & (UND), | (ODER), ! (NICHT), ^ (XOR), Klammern. Auch UND/ODER/NICHT, AND/OR/NOT sowie * und + sind erlaubt. Variablen: A, B, … oder z. B. S1, K2 (max. 8).")],
    compute: (s) => {
      const t = AU.truthTable(s.expr);
      const min = AU.minimize(t.vars, t.minterms);
      const table = h("table", { class: "ttable" },
        h("tr", {}, ...t.vars.map((v) => h("th", {}, v)), h("th", {}, "Q")),
        ...t.rows.map((r) => h("tr", {}, ...r.inputs.map((b) => h("td", {}, String(b))), h("td", { class: r.out ? "on" : "" }, String(r.out)))));
      return [resultRow("Minimierte Form (DNF)", min.replace(/&/g, " ∧ ").replace(/\|/g, "∨").replace(/!/g, "¬"), "good"),
              resultRow("Variablen", t.vars.join(", ")), resultRow("Minterme (Q = 1)", t.minterms.length ? t.minterms.join(", ") : "keine"),
              h("div", { class: "row chart-row" }, table)];
    },
    rangeMsg: "Ausdruck nicht lesbar – Klammern und Operatoren prüfen (max. 8 Variablen).",
    footer: "Minimierung nach Quine-McCluskey; bei mehreren gleichwertigen Lösungen wird eine davon angezeigt. Ergebnis als disjunktive Normalform (ODER von UND-Termen).",
  });
}

export function encoderView() {
  return calcView({
    init: { mode: "rpm", ppr: "1024", rpm: "1500", freq: "", factor: "4", lead: "5" },
    inputs: (s, { field, set }) => [
      ...section("Gegeben", [segmented([["rpm", "Drehzahl"], ["freq", "Frequenz"]], s.mode, (v) => set("mode", v))]),
      ...section("Inkrementalgeber", [field("ppr", "Impulse je Umdrehung", ""), s.mode === "rpm" ? field("rpm", "Drehzahl", "1/min") : field("freq", "Spurfrequenz (A)", "Hz"),
        selectRow("Auswertung", [["1", "einfach"], ["2", "zweifach"], ["4", "vierfach (Flanken A und B)"]], s.factor, (e) => set("factor", e.target.value)),
        field("lead", "Vorschub je Umdrehung (optional)", "mm")]),
    ],
    compute: (s, p) => { const r = AU.encoder({ ppr: p(s.ppr), rpm: s.mode === "rpm" ? p(s.rpm) : null, freq: s.mode === "freq" ? p(s.freq) : null, factor: Number(s.factor), lead: p(s.lead) });
      return [resultRow("Drehzahl", `${fmt(r.rpm, 2)} 1/min`), resultRow("Spurfrequenz", C.si(r.freq, "Hz"), "good"), resultRow("Zählfrequenz (mit Auswertung)", C.si(r.edges, "Hz")),
              resultRow("Winkelauflösung", `${fmt(r.resolutionDeg, 5)}°`), r.mmPerCount ? resultRow("Weg je Zählschritt", `${fmt(r.mmPerCount * 1000, 3)} µm`) : null]; },
    footer: "Maximale Eingangsfrequenz der Zählbaugruppe bzw. des Gebers laut Datenblatt beachten. " + PREFIX_HINT,
  });
}

export function vfdView() {
  return calcView({
    init: { mode: "speed", f: "50", p: "2", slip: "3", un: "400", fn: "50", boost: "0", nRated: "1455" },
    inputs: (s, { field, set }) => [
      ...section("Berechnung", [segmented([["speed", "Drehzahl & U/f"], ["slip", "Schlupf aus Typenschild"]], s.mode, (v) => set("mode", v))]),
      ...section("Motor", s.mode === "speed"
        ? [field("f", "Ausgangsfrequenz f", "Hz"), field("p", "Polpaarzahl p", ""), field("slip", "Schlupf", "%"), field("un", "Motornennspannung", "V"), field("fn", "Nennfrequenz (Eckfrequenz)", "Hz"), field("boost", "Spannungsanhebung (Boost) bei 0 Hz", "V")]
        : [field("f", "Netzfrequenz", "Hz"), field("p", "Polpaarzahl p", ""), field("nRated", "Bemessungsdrehzahl", "1/min")]),
    ],
    compute: (s, p) => {
      if (s.mode === "slip") { const r = AU.slipFromNameplate({ f: p(s.f), p: p(s.p), nRated: p(s.nRated) });
        return [resultRow("Synchrondrehzahl", `${fmt(r.nSync, 1)} 1/min`), resultRow("Bemessungsschlupf", `${fmt(r.slip, 2)} %`, "good")]; }
      const r = AU.vfd({ f: p(s.f), p: p(s.p), slip: p(s.slip) ?? 0, un: p(s.un), fn: p(s.fn), boost: p(s.boost) ?? 0 });
      return [resultRow("Synchrondrehzahl n₀ = 60·f/p", `${fmt(r.nSync, 1)} 1/min`), resultRow("Drehzahl mit Schlupf", `${fmt(r.n, 1)} 1/min`, "good"),
              r.u !== undefined ? resultRow("Ausgangsspannung (lineare U/f)", `${fmt(r.u, 1)} V`) : null,
              p(s.f) > p(s.fn) ? msgRow("Oberhalb der Eckfrequenz: Feldschwächbereich (Spannung bleibt konstant, Drehmoment sinkt).", "warn") : null];
    },
    footer: "Polpaarzahl p: 2-polig → 1, 4-polig → 2, 6-polig → 3. Schlupf lastabhängig; lineare U/f-Kennlinie als Vereinfachung (Umrichter bieten oft weitere Kennlinien).",
  });
}

export function rtd() {
  return calcView({
    init: { type: "100", dir: "t2r", t: "100", r: "138,51" },
    inputs: (s, { field, set }) => [
      ...section("Sensor", [segmented([["100", "Pt100"], ["1000", "Pt1000"]], s.type, (v) => set("type", v)),
        segmented([["t2r", "Temperatur → Widerstand"], ["r2t", "Widerstand → Temperatur"]], s.dir, (v) => set("dir", v))]),
      ...section("Wert", [s.dir === "t2r" ? field("t", "Temperatur", "°C") : field("r", "Widerstand", "Ω")]),
    ],
    compute: (s, p) => {
      const r0 = Number(s.type);
      if (s.dir === "t2r") { const t = p(s.t); if (t === null) throw new Error("positive"); return [resultRow("Widerstand", `${fmt(AU.rtdResistance(t, r0), 3)} Ω`, "good")]; }
      return [resultRow("Temperatur", `${fmt(AU.rtdTemperature(p(s.r), r0), 2)} °C`, "good")];
    },
    rangeMsg: "Außerhalb des Gültigkeitsbereichs −200 … 850 °C.",
    footer: "Callendar-Van-Dusen-Gleichung nach IEC 60751 (A = 3,9083·10⁻³, B = −5,775·10⁻⁷, C = −4,183·10⁻¹² für t < 0 °C). Leitungswiderstand bei 2-Leiter-Anschluss nicht berücksichtigt.",
  });
}
