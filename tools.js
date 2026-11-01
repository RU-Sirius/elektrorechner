// Zusätzliche Rechner für Elektroniker und Elektroingenieure.
import * as C from "./calc.js";
import { calcView, section, segmented, selectRow, resultRow, msgRow, PREFIX_HINT } from "./ui.js";

const si = C.si;
const seriesSelect = (s, set, key = "series") =>
  selectRow("Normreihe", Object.keys(C.E_SERIES).map((k) => [k, k]), s[key], (e) => set(key, e.target.value));

// ---------- Grundlagen ----------

export function combine() {
  const UNITS = { r: ["Widerstand", "Ω"], l: ["Induktivität", "H"], c: ["Kapazität", "F"] };
  return calcView({
    init: { kind: "r", v1: "100", v2: "220", v3: "470", v4: "", v5: "", v6: "" },
    inputs: (s, { field, set }) => [
      ...section("Bauteil", [segmented([["r", "R"], ["l", "L"], ["c", "C"]], s.kind, (v) => set("kind", v))]),
      ...section(`Werte (leere Felder werden ignoriert)`,
        [1, 2, 3, 4, 5, 6].map((n) => field("v" + n, `${UNITS[s.kind][0]} ${n}`, UNITS[s.kind][1]))),
    ],
    compute: (s, p) => {
      const vals = [1, 2, 3, 4, 5, 6].map((n) => p(s["v" + n])).filter((v) => v !== null);
      if (vals.length < 2) return [msgRow("Mindestens zwei Werte eingeben.")];
      const unit = UNITS[s.kind][1];
      // Bei Kondensatoren addieren sich Kapazitäten parallel, in Reihe die Kehrwerte.
      const ser = s.kind === "c" ? C.parallel(vals) : C.series(vals);
      const par = s.kind === "c" ? C.series(vals) : C.parallel(vals);
      return [resultRow("Reihenschaltung", si(ser, unit)), resultRow("Parallelschaltung", si(par, unit))];
    },
    footer: "Ideale Bauteile, ohne Gegeninduktivität bei L. " + PREFIX_HINT,
  });
}

export function voltageDivider() {
  return calcView({
    init: { mode: "uout", uin: "12", r1: "10k", r2: "4,7k", uout: "5", series: "E24" },
    inputs: (s, { field, set }) => [
      ...section("Gesucht", [segmented([["uout", "U aus"], ["r1", "R1"]], s.mode, (v) => set("mode", v))]),
      ...section("Werte", [
        field("uin", "Eingangsspannung", "V"),
        s.mode === "uout" ? field("r1", "R1 (oben)", "Ω") : field("uout", "Gewünschte U aus", "V"),
        field("r2", "R2 (unten)", "Ω"),
        s.mode === "r1" ? seriesSelect(s, set) : null,
      ].filter(Boolean)),
    ],
    compute: (s, p) => {
      if (s.mode === "uout") {
        const r = C.divider({ uin: p(s.uin), r1: p(s.r1), r2: p(s.r2) });
        return [resultRow("Ausgangsspannung", si(r.uout, "V")), resultRow("Querstrom", si(r.i, "A")),
                resultRow("Leistung R1", si(r.p1, "W")), resultRow("Leistung R2", si(r.p2, "W"))];
      }
      const r1 = C.dividerR1({ uin: p(s.uin), uout: p(s.uout), r2: p(s.r2) });
      const e = C.eSeries(r1, s.series).nearest;
      const real = C.divider({ uin: p(s.uin), r1: e, r2: p(s.r2) }).uout;
      return [resultRow("R1 rechnerisch", si(r1, "Ω")), resultRow(`R1 nach ${s.series}`, si(e, "Ω"), "good"),
              resultRow("U aus mit Normwert", si(real, "V"))];
    },
    rangeMsg: "Die Ausgangsspannung muss kleiner als die Eingangsspannung sein.",
    footer: "Unbelasteter Teiler: Ein Lastwiderstand am Ausgang wirkt parallel zu R2 und senkt U aus. " + PREFIX_HINT,
  });
}

export function decibel() {
  return calcView({
    init: { kind: "u", dir: "todb", x: "10" },
    inputs: (s, { field, set }) => [
      ...section("Größe", [segmented([["u", "Spannung/Strom"], ["p", "Leistung"]], s.kind, (v) => set("kind", v))]),
      ...section("Richtung", [segmented([["todb", "Verhältnis → dB"], ["fromdb", "dB → Verhältnis"]], s.dir, (v) => set("dir", v))]),
      ...section("Eingabe", [field("x", s.dir === "todb" ? "Verhältnis" : "Pegel", s.dir === "todb" ? "" : "dB")]),
    ],
    compute: (s, p) => {
      const x = p(s.x);
      if (x === null) throw new Error("positive");
      if (s.dir === "todb") {
        const d = s.kind === "u" ? C.db.fromVoltageRatio(x) : C.db.fromPowerRatio(x);
        return [resultRow("Pegel", `${C.fmt(d, 3)} dB`)];
      }
      const r = s.kind === "u" ? C.db.toVoltageRatio(x) : C.db.toPowerRatio(x);
      return [resultRow("Verhältnis", C.fmt(r, 6))];
    },
    footer: "Spannung/Strom: 20·log₁₀(x). Leistung: 10·log₁₀(x).",
  });
}

// ---------- Energietechnik ----------

export function acPower() {
  return calcView({
    init: { system: "ac3", mode: "fromI", u: "400", i: "16", cos: "0,85", p: "11k", eta: "0,9" },
    inputs: (s, { field, set }) => [
      ...section("Netz", [
        segmented([["ac1", "1~ AC"], ["ac3", "3~ AC"]], s.system, (v) => { s.u = v === "ac3" ? "400" : "230"; set("system", v); }),
        segmented([["fromI", "Leistung aus Strom"], ["fromP", "Strom aus Leistung"]], s.mode, (v) => set("mode", v)),
      ]),
      ...section("Werte", [
        field("u", s.system === "ac3" ? "Außenleiterspannung" : "Spannung", "V"),
        s.mode === "fromI" ? field("i", "Strom", "A") : field("p", "Wirkleistung (Abgabe)", "W"),
        field("cos", "cos φ", ""),
        s.mode === "fromP" ? field("eta", "Wirkungsgrad η", "") : null,
      ].filter(Boolean)),
    ],
    compute: (s, p) => {
      if (s.mode === "fromI") {
        const r = C.acPower({ system: s.system, u: p(s.u), i: p(s.i), cos: p(s.cos) });
        return [resultRow("Wirkleistung P", si(r.p, "W")), resultRow("Blindleistung Q", si(r.q, "var")),
                resultRow("Scheinleistung S", si(r.s, "VA")), resultRow("Phasenwinkel φ", `${C.fmt(r.phiDeg, 1)}°`)];
      }
      const r = C.currentFromPower({ system: s.system, p: p(s.p), u: p(s.u), cos: p(s.cos), eta: p(s.eta) ?? 1 });
      return [resultRow("Strom", si(r.i, "A"), "good"), resultRow("Aufgenommene Wirkleistung", si(r.pel, "W")),
              resultRow("Scheinleistung", si(r.s, "VA"))];
    },
    footer: (s) => s.mode === "fromP"
      ? "Für Motoren: Bemessungsleistung (Wellenleistung), cos φ und η vom Typenschild verwenden. " + PREFIX_HINT
      : "Sinusförmige Größen, symmetrische Last bei 3~. " + PREFIX_HINT,
  });
}

export function wireResistance() {
  return calcView({
    init: { material: "cu", length: "50", section: "2,5", kappa: "56", alpha: "0,00393", temp: "70", loop: "yes" },
    inputs: (s, { field, set }) => [
      ...section("Leitung", [
        field("length", "Einfache Länge", "m"),
        field("section", "Querschnitt", "mm²"),
        selectRow("Material", Object.entries(C.MATERIALS).map(([k, v]) => [k, v.name]), s.material, (e) => {
          const m = e.target.value;
          s.kappa = String(C.MATERIALS[m].kappa).replace(".", ",");
          s.alpha = String(C.ALPHA[m]).replace(".", ",");
          set("material", m);
        }),
        field("kappa", "Leitfähigkeit κ (20 °C)", "m/Ωmm²"),
        field("alpha", "Temperaturkoeff. α", "1/K"),
        field("temp", "Leitertemperatur", "°C"),
        segmented([["no", "Ein Leiter"], ["yes", "Hin + Rück"]], s.loop, (v) => set("loop", v)),
      ]),
    ],
    compute: (s, p) => {
      const temp = p(s.temp);
      const r = C.wireResistance({ length: p(s.length), section: p(s.section), kappa: p(s.kappa),
                                   alpha: p(s.alpha) ?? 0, temp: temp ?? 20, loop: s.loop === "yes" });
      return [resultRow("Widerstand bei 20 °C", si(r.r20, "Ω")),
              resultRow(`Widerstand bei ${C.fmt(temp ?? 20, 1)} °C`, si(r.rT, "Ω"), "good")];
    },
    footer: "R(ϑ) = R₂₀ · (1 + α·(ϑ − 20 °C)), lineare Näherung. κ- und α-Vorgaben sind übliche Literatur- bzw. Praxiswerte (Annahme) und änderbar.",
  });
}

export function compensation() {
  return calcView({
    init: { system: "ac3", p: "50k", cos1: "0,7", cos2: "0,95", u: "400", f: "50" },
    inputs: (s, { field, set }) => [
      ...section("Netz", [
        segmented([["ac1", "1~ AC"], ["ac3", "3~ AC"]], s.system, (v) => { s.u = v === "ac3" ? "400" : "230"; set("system", v); }),
        field("u", s.system === "ac3" ? "Außenleiterspannung" : "Spannung", "V"),
        field("f", "Frequenz", "Hz"),
      ]),
      ...section("Last", [field("p", "Wirkleistung P", "W"), field("cos1", "cos φ vorher", ""), field("cos2", "cos φ Ziel", "")]),
    ],
    compute: (s, p) => {
      const r = C.compensation({ system: s.system, p: p(s.p), cos1: p(s.cos1), cos2: p(s.cos2), u: p(s.u), f: p(s.f) });
      return [resultRow("Kompensationsleistung Qc", si(r.qc, "var"), "good"),
              ...(s.system === "ac3"
                ? [resultRow("C je Kondensator, Dreieck", si(r.cDelta, "F")), resultRow("C je Kondensator, Stern", si(r.cStar, "F"))]
                : [resultRow("Kapazität C", si(r.c, "F"))])];
    },
    rangeMsg: "Der Ziel-cos φ muss größer als der Ausgangswert sein.",
    footer: "Qc = P · (tan φ₁ − tan φ₂). Ideale Kondensatoren, sinusförmige Spannung, ohne Oberschwingungen. " + PREFIX_HINT,
  });
}

export function starDelta() {
  return calcView({
    init: { dir: "d2y", a: "10", b: "30", c: "20" },
    inputs: (s, { field, set }) => [
      ...section("Richtung", [segmented([["d2y", "Dreieck → Stern"], ["y2d", "Stern → Dreieck"]], s.dir, (v) => set("dir", v))]),
      ...section("Werte", s.dir === "d2y"
        ? [field("a", "R₁₂", "Ω"), field("b", "R₂₃", "Ω"), field("c", "R₃₁", "Ω")]
        : [field("a", "R₁", "Ω"), field("b", "R₂", "Ω"), field("c", "R₃", "Ω")]),
    ],
    compute: (s, p) => {
      if (s.dir === "d2y") {
        const r = C.deltaToStar(p(s.a), p(s.b), p(s.c));
        return [resultRow("R₁", si(r.r1, "Ω")), resultRow("R₂", si(r.r2, "Ω")), resultRow("R₃", si(r.r3, "Ω"))];
      }
      const r = C.starToDelta(p(s.a), p(s.b), p(s.c));
      return [resultRow("R₁₂", si(r.r12, "Ω")), resultRow("R₂₃", si(r.r23, "Ω")), resultRow("R₃₁", si(r.r31, "Ω"))];
    },
    footer: "Rᵢ ist der Sternwiderstand an Knoten i; Rᵢⱼ der Dreieckswiderstand zwischen den Knoten i und j. Für reine Widerstände. " + PREFIX_HINT,
  });
}

// ---------- Elektronik ----------

export function led() {
  return calcView({
    init: { ub: "12", uf: "2,1", i: "20m", n: "2", series: "E24" },
    inputs: (s, { field, set }) => [
      ...section("Schaltung", [
        field("ub", "Betriebsspannung", "V"),
        field("uf", "Flussspannung je LED", "V"),
        field("i", "LED-Strom", "A"),
        field("n", "LEDs in Reihe", "Stk."),
        seriesSelect(s, set),
      ]),
    ],
    compute: (s, p) => {
      const r = C.ledResistor({ ub: p(s.ub), uf: p(s.uf), i: p(s.i), n: Math.round(p(s.n) ?? 1), series: s.series });
      return [resultRow("Vorwiderstand rechnerisch", si(r.r, "Ω")),
              resultRow(`Gewählt (${s.series}, aufgerundet)`, si(r.chosen, "Ω"), "good"),
              resultRow("Tatsächlicher Strom", si(r.iReal, "A")),
              resultRow("Verlustleistung im Widerstand", si(r.pR, "W"))];
    },
    rangeMsg: "Die Betriebsspannung muss größer sein als die Summe der Flussspannungen.",
    footer: "Flussspannung und zulässigen Strom aus dem Datenblatt der LED entnehmen. Die Belastbarkeit des Widerstands mit Reserve wählen. " + PREFIX_HINT,
  });
}

export function reactance() {
  return calcView({
    init: { f: "50", l: "100m", c: "10µ" },
    inputs: (s, { field }) => [
      ...section("Werte (L und/oder C)", [field("f", "Frequenz", "Hz"), field("l", "Induktivität L", "H"), field("c", "Kapazität C", "F")]),
    ],
    compute: (s, p) => {
      const r = C.reactance({ f: p(s.f), l: p(s.l), c: p(s.c) });
      const rows = [];
      if (r.xl !== undefined) rows.push(resultRow("X_L = 2πfL", si(r.xl, "Ω")));
      if (r.xc !== undefined) rows.push(resultRow("X_C = 1/(2πfC)", si(r.xc, "Ω")));
      if (r.f0 !== undefined) rows.push(resultRow("Resonanzfrequenz f₀", si(r.f0, "Hz"), "good"));
      if (!rows.length) rows.push(msgRow("L und/oder C eingeben."));
      return rows;
    },
    footer: "Ideale Bauteile; f₀ = 1/(2π√(LC)). " + PREFIX_HINT,
  });
}

export function timeConstant() {
  return calcView({
    init: { kind: "rc", r: "10k", x: "100n" },
    inputs: (s, { field, set }) => [
      ...section("Glied", [segmented([["rc", "RC"], ["rl", "RL"]], s.kind, (v) => { s.x = v === "rc" ? "100n" : "10m"; set("kind", v); })]),
      ...section("Werte", [field("r", "Widerstand R", "Ω"), s.kind === "rc" ? field("x", "Kapazität C", "F") : field("x", "Induktivität L", "H")]),
    ],
    compute: (s, p) => {
      const r = C.timeConstant({ kind: s.kind, r: p(s.r), x: p(s.x) });
      return [resultRow("Zeitkonstante τ", si(r.tau, "s"), "good"), resultRow("5 τ (≈ 99,3 %)", si(r.t99, "s")),
              resultRow("Grenzfrequenz f_g (−3 dB)", si(r.fg, "Hz"))];
    },
    footer: "τ = R·C bzw. L/R; f_g = 1/(2πτ). Nach τ sind ≈ 63,2 %, nach 5τ ≈ 99,3 % des Endwerts erreicht. " + PREFIX_HINT,
  });
}

export function eSeriesView() {
  return calcView({
    init: { v: "14k", series: "E12" },
    inputs: (s, { field, set }) => [...section("Wert", [field("v", "Gesuchter Wert", ""), seriesSelect(s, set)])],
    compute: (s, p) => {
      const v = p(s.v);
      const r = C.eSeries(v, s.series);
      const dev = (x) => `${x >= v ? "+" : ""}${C.fmt(((x - v) / v) * 100, 1)} %`;
      return [resultRow("Nächstkleiner", `${si(r.lower, "")} (${dev(r.lower)})`),
              resultRow("Nächstgrößer", `${si(r.upper, "")} (${dev(r.upper)})`),
              resultRow("Nächstliegend", si(r.nearest, ""), "good")];
    },
    footer: "Normreihen nach IEC 60063. Gilt für Widerstände, Kondensatoren und Induktivitäten. " + PREFIX_HINT,
  });
}
