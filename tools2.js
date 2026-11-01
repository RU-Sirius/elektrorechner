// Schutztechnik, Installation, Sicherheitstechnik, Nachschlagewerte.
import * as C from "./calc.js";
import { calcView, section, segmented, selectRow, resultRow, msgRow, h, PREFIX_HINT } from "./ui.js";

const si = C.si;
const ok = (b) => (b ? "good" : "bad");
const yes = (b) => (b ? "erfüllt ✓" : "nicht erfüllt ✗");
const ratedOpts = C.RATED_CURRENTS.map((r) => [String(r), `${r} A`]);
const materialRow = (s, set) =>
  selectRow("Material", Object.entries(C.MATERIALS).map(([k, v]) => [k, v.name]), s.material, (e) => {
    const m = e.target.value;
    s.kappa = String(C.MATERIALS[m].kappa);
    s.alpha = String(C.ALPHA[m]).replace(".", ",");
    set("material", m);
  });
// Auslösestrom Ia: LS-Schalter aus Charakteristik, sonst Eingabe (z. B. aus Sicherungskennlinie).
const iaOf = (s, p) => (s.dev === "manual" ? p(s.ia) : (p(s.inn) ?? 0) * C.MCB_TRIP[s.dev]);
const deviceRows = (s, set, field) => [
  selectRow("Schutzorgan", [["B", "LS-Schalter B"], ["C", "LS-Schalter C"], ["D", "LS-Schalter D"], ["manual", "Sonstiges (Ia eingeben)"]],
    s.dev, (e) => set("dev", e.target.value)),
  s.dev === "manual" ? field("ia", "Abschaltstrom Ia", "A") : selectRow("Bemessungsstrom In", ratedOpts, s.inn, (e) => set("inn", e.target.value)),
];
const LOOP_NOTE = "Vereinfachung: Leitungswiderstand bei Betriebstemperatur (PVC: 70 °C), Reaktanz vernachlässigt, Zvor als Betrag addiert, " +
  "Spannungsfaktor c = 0,95 (Annahme, änderbar). LS-Schalter: Ia = obere Grenze der magnetischen Auslösung (B 5·In, C 10·In, D 20·In). " +
  "Für Sicherungen Ia für die geforderte Abschaltzeit aus der Herstellerkennlinie eintragen (TN, U₀ = 230 V: Endstromkreise 0,4 s, Verteilerstromkreise 5 s; Geltungsbereich nach aktueller Normausgabe prüfen). " +
  "Messung nach Errichtung bleibt erforderlich.";

// ---------- Leitungen & Schutz ----------

export function loop() {
  return calcView({
    init: { zPre: "0,3", length: "30", section: "2,5", material: "cu", kappa: "56", alpha: "0,00393", temp: "70", u0: "230", c: "0,95", dev: "B", inn: "16", ia: "" },
    inputs: (s, { field, set }) => [
      ...section("Netz", [field("u0", "U₀ (Leiter–Erde)", "V"), field("zPre", "Vorgelagerte Impedanz Zvor", "Ω"), field("c", "Spannungsfaktor c", "")]),
      ...section("Leitung", [field("length", "Einfache Länge", "m"), field("section", "Querschnitt", "mm²"), materialRow(s, set),
        field("kappa", "Leitfähigkeit κ (20 °C)", "m/Ωmm²"), field("alpha", "Temp.-Koeff. α", "1/K"), field("temp", "Leitertemperatur", "°C")]),
      ...section("Schutzorgan", deviceRows(s, set, field)),
    ],
    compute: (s, p) => {
      const ia = iaOf(s, p);
      const r = C.loopImpedance({ zPre: p(s.zPre), length: p(s.length), section: p(s.section), kappa: p(s.kappa), alpha: p(s.alpha),
                                  temp: p(s.temp), u0: p(s.u0), c: p(s.c), ia });
      return [resultRow("Leitungswiderstand (Hin + Rück)", si(r.rLine, "Ω")), resultRow("Schleifenimpedanz Zs", si(r.zs, "Ω")),
              resultRow("Zs max. zulässig", si(r.zsMax, "Ω")), resultRow("Kurzschlussstrom Ik1 min", si(r.ik, "A")),
              resultRow("Abschaltstrom Ia", si(ia, "A")), resultRow("Abschaltbedingung", yes(r.ok), ok(r.ok)),
              resultRow("Max. Länge (Abschaltung)", `${C.fmt(r.lMax, 0)} m`)];
    },
    footer: LOOP_NOTE,
  });
}

export function maxLength() {
  return calcView({
    init: { system: "ac1", u: "230", i: "16", cos: "1", section: "2,5", material: "cu", kappa: "56", alpha: "0,00393", temp: "70", pct: "3",
            u0: "230", zPre: "0,3", c: "0,95", dev: "B", inn: "16", ia: "" },
    inputs: (s, { field, set }) => [
      ...section("Netz & Last", [segmented([["ac1", "1~ AC"], ["ac3", "3~ AC"]], s.system, (v) => { s.u = v === "ac3" ? "400" : "230"; set("system", v); }),
        field("u", s.system === "ac3" ? "Außenleiterspannung" : "Spannung", "V"), field("i", "Betriebsstrom Ib", "A"), field("cos", "cos φ", ""),
        field("pct", "Zul. Spannungsfall", "%")]),
      ...section("Leitung", [field("section", "Querschnitt", "mm²"), materialRow(s, set), field("kappa", "Leitfähigkeit κ (20 °C)", "m/Ωmm²"),
        field("alpha", "Temp.-Koeff. α", "1/K"), field("temp", "Leitertemperatur", "°C")]),
      ...section("Abschaltung", [field("u0", "U₀", "V"), field("zPre", "Zvor", "Ω"), field("c", "Spannungsfaktor c", ""), ...deviceRows(s, set, field)]),
    ],
    compute: (s, p) => {
      const lDrop = C.maxLengthDrop({ system: s.system, current: p(s.i), voltage: p(s.u), maxPercent: p(s.pct), cos: p(s.cos), kappa: p(s.kappa), section: p(s.section) });
      const lp = C.loopImpedance({ zPre: p(s.zPre), length: 1, section: p(s.section), kappa: p(s.kappa), alpha: p(s.alpha), temp: p(s.temp),
                                   u0: p(s.u0), c: p(s.c), ia: iaOf(s, p) });
      const lMax = Math.min(lDrop, lp.lMax);
      return [resultRow("Max. Länge nach Spannungsfall", `${C.fmt(lDrop, 0)} m`), resultRow("Max. Länge nach Abschaltbedingung", `${C.fmt(lp.lMax, 0)} m`),
              resultRow("Zulässige Leitungslänge", `${C.fmt(lMax, 0)} m`, "good"),
              msgRow(lDrop <= lp.lMax ? "Begrenzend: Spannungsfall" : "Begrenzend: Abschaltbedingung")];
    },
    footer: "Spannungsfall bei 20 °C wie im Spannungsfall-Rechner. " + LOOP_NOTE,
  });
}

export function overload() {
  return calcView({
    init: { ib: "14", inn: "16", iz: "20", type: "mcb", k2: "1,45" },
    inputs: (s, { field, set }) => [
      ...section("Ströme", [field("ib", "Betriebsstrom Ib", "A"), selectRow("Bemessungsstrom In", ratedOpts, s.inn, (e) => set("inn", e.target.value)),
        field("iz", "Strombelastbarkeit Iz (aus Tabelle)", "A")]),
      ...section("Schutzorgan", [selectRow("Typ", [["mcb", "LS-Schalter (I₂ = 1,45·In)"], ["gg", "Sicherung gG ab 16 A (I₂ = 1,6·In)"], ["manual", "Faktor I₂/In eingeben"]], s.type, (e) => {
        const t = e.target.value; s.k2 = t === "gg" ? "1,6" : t === "mcb" ? "1,45" : s.k2; set("type", t);
      }), s.type === "manual" ? field("k2", "I₂ / In", "") : null].filter(Boolean)),
    ],
    compute: (s, p) => {
      const r = C.overloadCheck({ ib: p(s.ib), inn: p(s.inn), iz: p(s.iz), k2: p(s.k2) });
      return [resultRow("Ib ≤ In", yes(r.c1), ok(r.c1)), resultRow("In ≤ Iz", yes(r.c2), ok(r.c2)),
              resultRow(`I₂ = ${C.fmt(r.i2, 1)} A ≤ 1,45·Iz = ${C.fmt(r.i2max, 1)} A`, yes(r.c3), ok(r.c3)),
              r.c1 && r.c2 && r.c3 ? msgRow("Überlastschutz nach den Bedingungen erfüllt.") : msgRow("Mindestens eine Bedingung ist nicht erfüllt.", "error")];
    },
    footer: "Iz mit allen Umrechnungsfaktoren (Verlegeart, Häufung, Umgebungstemperatur) aus den Tabellen der geltenden Norm ermitteln; die App enthält diese Tabellen nicht. " +
            "Kurzschlussschutz separat mit dem Rechner „Schleifenimpedanz“ prüfen.",
  });
}

export function feeder() {
  return calcView({
    init: { u: "400", p: "20k", cos: "0,9", length: "25", section: "10", material: "cu", kappa: "56", alpha: "0,00393", temp: "70", iz: "50",
            pct: "1", inn: "35", dev: "manual", ia: "", zPre: "0,2", c: "0,95", u0: "230", k2: "1,6" },
    inputs: (s, { field, set }) => [
      ...section("Unterverteilung (3~)", [field("u", "Außenleiterspannung", "V"), field("p", "Leistung nach Gleichzeitigkeit", "W"), field("cos", "cos φ", "")]),
      ...section("Zuleitung", [field("length", "Einfache Länge", "m"), field("section", "Querschnitt", "mm²"), materialRow(s, set),
        field("kappa", "Leitfähigkeit κ (20 °C)", "m/Ωmm²"), field("alpha", "Temp.-Koeff. α", "1/K"), field("temp", "Leitertemperatur", "°C"),
        field("iz", "Strombelastbarkeit Iz (aus Tabelle)", "A"), field("pct", "Zul. Spannungsfall", "%")]),
      ...section("Vorsicherung", [selectRow("Bemessungsstrom In", ratedOpts, s.inn, (e) => set("inn", e.target.value)), field("k2", "I₂ / In (gG ab 16 A: 1,6; LS: 1,45)", ""),
        selectRow("Abschaltstrom", [["B", "LS-Schalter B"], ["C", "LS-Schalter C"], ["D", "LS-Schalter D"], ["manual", "Ia eingeben (Sicherung)"]], s.dev, (e) => set("dev", e.target.value)),
        s.dev === "manual" ? field("ia", "Abschaltstrom Ia (5 s)", "A") : null, field("u0", "U₀", "V"), field("zPre", "Zvor am Einspeisepunkt", "Ω"), field("c", "Spannungsfaktor c", "")].filter(Boolean)),
    ],
    compute: (s, p) => {
      const ib = C.currentFromPower({ system: "ac3", p: p(s.p), u: p(s.u), cos: p(s.cos) }).i;
      const ov = C.overloadCheck({ ib, inn: p(s.inn), iz: p(s.iz), k2: p(s.k2) });
      const dr = C.voltageDrop({ system: "ac3", length: p(s.length), current: ib, section: p(s.section), voltage: p(s.u), cos: p(s.cos), kappa: p(s.kappa) });
      const dOk = dr.percent <= p(s.pct);
      const rows = [resultRow("Betriebsstrom Ib", si(ib, "A")), resultRow("Ib ≤ In ≤ Iz", yes(ov.c1 && ov.c2), ok(ov.c1 && ov.c2)),
              resultRow("I₂ ≤ 1,45·Iz", yes(ov.c3), ok(ov.c3)), resultRow("Spannungsfall", `${C.fmt(dr.percent)} %`, ok(dOk))];
      const ia = iaOf(s, p);
      if (!ia) return [...rows, msgRow("Abschaltbedingung: Abschaltstrom Ia aus der Kennlinie der Vorsicherung eintragen.", "warn")];
      const lp = C.loopImpedance({ zPre: p(s.zPre), length: p(s.length), section: p(s.section), kappa: p(s.kappa), alpha: p(s.alpha), temp: p(s.temp), u0: p(s.u0), c: p(s.c), ia });
      const all = ov.c1 && ov.c2 && ov.c3 && dOk && lp.ok;
      return [...rows, resultRow("Ik1 min am Verteiler", si(lp.ik, "A")), resultRow("Abschaltbedingung", yes(lp.ok), ok(lp.ok)),
              all ? msgRow("Alle geprüften Bedingungen erfüllt.") : msgRow("Mindestens eine Bedingung ist nicht erfüllt.", "error")];
    },
    footer: "Kombinierte Prüfung von Überlast, Spannungsfall (3~, 20 °C) und Abschaltbedingung. " + LOOP_NOTE + " " + PREFIX_HINT,
  });
}

export function shortCircuit() {
  return calcView({
    init: { mode: "trafo", sn: "630k", un: "400", uk: "6", u0: "230", zs: "0,8", c: "0,95" },
    inputs: (s, { field, set }) => [
      ...section("Berechnung", [segmented([["trafo", "Trafo-Klemmen"], ["zs", "Aus Schleifenimpedanz"]], s.mode, (v) => set("mode", v))]),
      ...section("Werte", s.mode === "trafo"
        ? [field("sn", "Bemessungsleistung Sn", "VA"), field("un", "Sekundärspannung (Außenleiter)", "V"), field("uk", "Kurzschlussspannung uk", "%")]
        : [field("u0", "U₀", "V"), field("zs", "Schleifenimpedanz Zs", "Ω"), field("c", "Spannungsfaktor c", "")]),
    ],
    compute: (s, p) => {
      if (s.mode === "trafo") {
        const r = C.transformer({ sn: p(s.sn), un: p(s.un), uk: p(s.uk) });
        return [resultRow("Bemessungsstrom In", si(r.inn, "A")), resultRow("Ik3 an den Klemmen", si(r.ik3, "A"), "good"), resultRow("Kurzschlussimpedanz Zk", si(r.zk, "Ω"))];
      }
      const zs = p(s.zs), u0 = p(s.u0), c = p(s.c);
      if (!(zs > 0 && u0 > 0 && c > 0)) throw new Error("positive");
      return [resultRow("Ik1 = c · U₀ / Zs", si((c * u0) / zs, "A"), "good")];
    },
    footer: (s) => s.mode === "trafo"
      ? "Ik3 = In · 100 / uk bei starrem (unendlich starkem) Vornetz und ohne Spannungsfaktor – Obergrenze an den Trafoklemmen. " + PREFIX_HINT
      : "Minimaler einpoliger Kurzschlussstrom; c = 0,95 als Annahme für den kleinsten Strom.",
  });
}

export function transformerView() {
  return calcView({
    init: { sn: "400k", un: "400", uk: "4", cos: "0,9", load: "75" },
    inputs: (s, { field }) => [...section("Transformator", [field("sn", "Bemessungsleistung Sn", "VA"), field("un", "Sekundärspannung", "V"),
      field("uk", "Kurzschlussspannung uk", "%")]), ...section("Belastung", [field("load", "Auslastung", "%"), field("cos", "cos φ der Last", "")])],
    compute: (s, p) => {
      const r = C.transformer({ sn: p(s.sn), un: p(s.un), uk: p(s.uk) });
      const ld = (p(s.load) ?? 0) / 100;
      return [resultRow("Bemessungsstrom In", si(r.inn, "A")), resultRow("Ik3 an den Klemmen", si(r.ik3, "A")), resultRow("Kurzschlussimpedanz Zk", si(r.zk, "Ω")),
              resultRow("Strom bei Auslastung", si(r.inn * ld, "A")), resultRow("Wirkleistung bei Auslastung", si(p(s.sn) * ld * (p(s.cos) ?? 1), "W"))];
    },
    footer: "Ik3 bei starrem Vornetz (Obergrenze). Für die Einspeisung zusätzlich Hausanschluss-/NH-Sicherung und Zuleitung mit „UVT-Zuleitung“ prüfen. " + PREFIX_HINT,
  });
}

export function selectivity() {
  return calcView({
    init: { up: "63", down: "35" },
    inputs: (s, { set }) => [...section("gG-Sicherungen (NH/D)", [
      selectRow("Vorgeschaltet", ratedOpts, s.up, (e) => set("up", e.target.value)), selectRow("Nachgeschaltet", ratedOpts, s.down, (e) => set("down", e.target.value))])],
    compute: (s, p) => {
      const r = C.fuseSelectivity(p(s.up), p(s.down));
      return [resultRow("Nennstromverhältnis", `${C.fmt(r.ratio, 2)} : 1`), resultRow("Verhältnis ≥ 1,6 : 1", yes(r.ok), ok(r.ok))];
    },
    footer: "Verbreitete Regel für gG-Sicherungen gleicher Bauart und Hersteller. Für LS-Schalter, Leistungsschalter und gemischte Kombinationen " +
            "sind die Selektivitätstabellen des Herstellers maßgeblich – diese kann die App nicht ersetzen.",
  });
}

// ---------- Anschluss & Versorgung ----------

const loadRows = (s, field, names) => names.map((n, k) => [field(`p${k}`, `${n} – Leistung je Gerät`, "W"), field(`n${k}`, `${n} – Anzahl`, "Stk.")]).flat();
const sumLoads = (s, p, count) => Array.from({ length: count }, (_, k) => ({ p: p(s[`p${k}`]), n: p(s[`n${k}`]) }));

export function constructionSite() {
  const names = ["Steckdosen 1~", "Kran / Aufzug", "Heizung/Trocknung", "Sonstiges"];
  return calcView({
    init: { u: "400", cos: "0,9", g: "0,7", p0: "3,7k", n0: "4", p1: "11k", n1: "1", p2: "2k", n2: "3", p3: "", n3: "" },
    inputs: (s, { field }) => [...section("Verbraucher", loadRows(s, field, names)),
      ...section("Anschluss (3~)", [field("u", "Außenleiterspannung", "V"), field("cos", "cos φ (Mittelwert)", ""), field("g", "Gleichzeitigkeitsfaktor g", "")])],
    compute: (s, p) => {
      const r = C.demand({ loads: sumLoads(s, p, names.length), g: p(s.g), u: p(s.u), system: "ac3", cos: p(s.cos) });
      return [resultRow("Installierte Leistung", si(r.sum, "W")), resultRow("Leistung mit g", si(r.p, "W")), resultRow("Strom je Außenleiter", si(r.i, "A")),
              resultRow("Nächster Bemessungsstrom", r.rated ? `${r.rated} A` : "> 630 A", "good")];
    },
    footer: "Gleichzeitigkeitsfaktor aus Erfahrung bzw. Vorgabe des Netzbetreibers einsetzen. Ungleiche Aufteilung von 1~-Lasten auf die Außenleiter ist nicht berücksichtigt; " +
            "Anschlussbedingungen (TAB) und Baustromverteiler-Ausführung separat prüfen. " + PREFIX_HINT,
  });
}

export function evCharging() {
  return calcView({
    init: { n: "4", p: "11k", g: "0,8", u: "400", cos: "1", cap: "60", from: "20", to: "80", eta: "90", pc: "11k" },
    inputs: (s, { field }) => [
      ...section("Ladepunkte (3~)", [field("n", "Anzahl Ladepunkte", "Stk."), field("p", "Leistung je Ladepunkt", "W"), field("g", "Gleichzeitigkeitsfaktor g", ""),
        field("u", "Außenleiterspannung", "V"), field("cos", "cos φ", "")]),
      ...section("Ladezeit Fahrzeug", [field("cap", "Akkukapazität", "kWh"), field("from", "Ladezustand von", "%"), field("to", "Ladezustand bis", "%"),
        field("pc", "Ladeleistung", "W"), field("eta", "Ladewirkungsgrad", "%")]),
    ],
    compute: (s, p) => {
      const r = C.demand({ loads: [{ p: p(s.p), n: p(s.n) }], g: p(s.g), u: p(s.u), system: "ac3", cos: p(s.cos) });
      const rows = [resultRow("Gesamtleistung mit g", si(r.p, "W")), resultRow("Strom je Außenleiter", si(r.i, "A")),
                    resultRow("Nächster Bemessungsstrom", r.rated ? `${r.rated} A` : "> 630 A", "good")];
      try {
        const t = C.chargeTime({ capacity: p(s.cap), socFrom: p(s.from) / 100, socTo: p(s.to) / 100, power: p(s.pc) / 1000, eta: p(s.eta) / 100 });
        rows.push(resultRow("Ladezeit", `${C.fmt(t.hours, 1)} h`));
      } catch { rows.push(msgRow("Ladezeit: Eingaben prüfen.")); }
      return rows;
    },
    footer: "Ohne Lastmanagement ist g = 1 anzusetzen. Fehlerschutz (RCD-Typ), Anmelde-/Genehmigungspflichten beim Netzbetreiber und " +
            "Herstellerangaben der Wallbox separat beachten. Ladezeit vereinfacht mit konstanter Leistung. " + PREFIX_HINT,
  });
}

// ---------- Sicherheitstechnik ----------

export function emergencyLight() {
  return calcView({
    init: { p: "1,5k", hours: "3", u: "216", eta: "90", reserve: "1,25" },
    inputs: (s, { field }) => [...section("Sicherheitsbeleuchtung / Zentralbatterie", [field("p", "Anschlussleistung der Leuchten", "W"),
      field("hours", "Bemessungsbetriebsdauer", "h"), field("u", "Batterienennspannung", "V"), field("eta", "Wirkungsgrad (Wechselrichter/Leitung)", "%"),
      field("reserve", "Reservefaktor (Alterung)", "")])],
    compute: (s, p) => {
      const r = C.emergencyBattery({ p: p(s.p), hours: p(s.hours), u: p(s.u), eta: p(s.eta) / 100, reserve: p(s.reserve) });
      return [resultRow("Erforderliche Kapazität", `${C.fmt(r.ah, 1)} Ah`, "good"), resultRow("Energie", si(r.wh, "Wh"))];
    },
    footer: "Vereinfacht mit konstanter Leistung. Betriebsdauer, Reservefaktor und Entladekennlinie (Kapazität hängt vom Entladestrom ab) " +
            "nach Sicherheitskonzept, geltender Norm und Batteriehersteller festlegen – die Werte hier sind Beispiele. " + PREFIX_HINT,
  });
}

export function alarmSystem() {
  return calcView({
    init: { iq: "250m", tq: "72", ia: "1,2", ta: "0,5", reserve: "1,25" },
    inputs: (s, { field }) => [...section("BMA / EMA – Notstrombatterie", [field("iq", "Ruhestrom", "A"), field("tq", "Überbrückungszeit Ruhe", "h"),
      field("ia", "Alarmstrom", "A"), field("ta", "Alarmdauer", "h"), field("reserve", "Reservefaktor (Alterung)", "")])],
    compute: (s, p) => {
      const r = C.alarmBattery({ iq: p(s.iq), tq: p(s.tq), ia: p(s.ia), ta: p(s.ta), reserve: p(s.reserve) });
      return [resultRow("Ruhebetrieb", `${C.fmt(p(s.iq) * p(s.tq), 2)} Ah`), resultRow("Alarmbetrieb", `${C.fmt(p(s.ia) * p(s.ta), 2)} Ah`),
              resultRow("Erforderliche Kapazität", `${C.fmt(r.ah, 1)} Ah`, "good")];
    },
    footer: "C = (I_Ruhe·t_Ruhe + I_Alarm·t_Alarm) · Reservefaktor. Überbrückungs- und Alarmzeiten sowie Reservefaktor nach Anlagenkonzept, " +
            "geltender Norm und Zentralenhersteller einsetzen – die Werte hier sind Beispiele. " + PREFIX_HINT,
  });
}

export function speakerSystem() {
  return calcView({
    init: { taps: "240", reserve: "1,2", amp: "360", u: "100", length: "200", section: "1,5", kappa: "56" },
    inputs: (s, { field }) => [
      ...section("Verstärker", [field("taps", "Summe der Lautsprecher-Anzapfungen", "W"), field("reserve", "Reservefaktor", ""), field("amp", "Verstärker-Nennleistung", "W")]),
      ...section("Lautsprecherlinie", [field("u", "Liniennennspannung", "V"), field("length", "Einfache Länge (bis Linienende)", "m"),
        field("section", "Querschnitt", "mm²"), field("kappa", "Leitfähigkeit κ", "m/Ωmm²")]),
    ],
    compute: (s, p) => {
      const r = C.speakerLine({ taps: p(s.taps), reserve: p(s.reserve), amp: p(s.amp), u: p(s.u), length: p(s.length), section: p(s.section), kappa: p(s.kappa) });
      return [resultRow("Benötigte Leistung inkl. Reserve", si(r.needed, "W")), resultRow("Verstärker ausreichend", yes(r.ok), ok(r.ok)),
              resultRow("Lastimpedanz der Linie", si(r.z, "Ω")), resultRow("Leitungswiderstand", si(r.r, "Ω")),
              resultRow("Pegelverlust (Last am Linienende)", `${C.fmt(r.lossDb, 2)} dB`), resultRow("Leistung an den Lautsprechern", si(r.pLoad, "W"))];
    },
    footer: "Worst Case: gesamte Last am Linienende. Zulässiger Pegelverlust, Reservefaktor und Funktionserhalt nach Anlagenkonzept, " +
            "geltender Norm und Herstellerangaben festlegen. " + PREFIX_HINT,
  });
}

// ---------- Nachschlagen ----------

export function ipCode() {
  return calcView({
    init: { code: "IP54" },
    inputs: (s, { field }) => [...section("Schutzart", [field("code", "IP-Code (z. B. IP54, IPX7)", "")])],
    compute: (s) => {
      const r = C.decodeIP(s.code);
      return [resultRow(`1. Ziffer (${r.d1})`, ""), msgRow(r.first ?? "nicht angegeben (X)", "hint"),
              resultRow(`2. Ziffer (${r.d2})`, ""), msgRow(r.second ?? "nicht angegeben (X)", "hint")];
    },
    rangeMsg: "Ungültiger Code. Format: IP + Ziffer 0–6 oder X + Ziffer 0–9 oder X, z. B. IP65.",
    footer: "Nach IEC 60529 (DIN EN 60529). Zusatzbuchstaben werden akzeptiert, aber nicht erläutert.",
  });
}

export function tables() {
  const tbl = (title, rows, footer) => section(title, rows.map(([a, b]) => resultRow(a, b)), footer);
  return [
    ...tbl("IK-Stoßfestigkeit (IEC 62262)", C.IK_ENERGY.map(([k, v]) => [`IK${k}`, v === null ? "kein Schutz" : `${C.fmt(v, 2)} J`])),
    ...tbl("IP – 1. Kennziffer (IEC 60529)", Object.entries(C.IP_FIRST).map(([k, v]) => [`IP${k}X`, v])),
    ...tbl("IP – 2. Kennziffer (IEC 60529)", Object.entries(C.IP_SECOND).map(([k, v]) => [`IPX${k}`, v])),
    ...tbl("LS-Schalter: unverzögerte Auslösung (IEC 60898-1)", [["B", "3 … 5 × In"], ["C", "5 … 10 × In"], ["D", "10 … 20 × In"]]),
    ...tbl("Großer Prüfstrom I₂", [["LS-Schalter", "1,45 × In"], ["Sicherung gG (In ≥ 16 A)", "1,6 × In"], ["Bedingung", "I₂ ≤ 1,45 × Iz"]]),
    ...tbl("Abschaltzeiten TN-System, U₀ = 230 V AC", [["Endstromkreise", "0,4 s"], ["Verteilerstromkreise", "5 s"]], "Welche Stromkreise als Endstromkreise gelten, ist in der aktuellen Ausgabe von DIN VDE 0100-410 geregelt – dort prüfen."),
    ...tbl("Nennquerschnitte (IEC 60228)", [["mm²", C.STANDARD_SECTIONS.map((x) => C.fmt(x, 2)).join(" · ")]]),
    ...tbl("Bemessungsströme (gebräuchlich)", [["A", C.RATED_CURRENTS.join(" · ")]]),
    ...tbl("Leitfähigkeit & Temperaturkoeffizient (Annahme)", [["Kupfer", "κ = 56 m/(Ω·mm²), α = 0,00393 1/K"], ["Aluminium", "κ = 35 m/(Ω·mm²), α = 0,00403 1/K"]],
      "Praxis- bzw. Literaturwerte. Strombelastbarkeit und Umrechnungsfaktoren sind nicht enthalten – bitte die Tabellen der geltenden Norm verwenden."),
    ...tbl("Normreihen (IEC 60063)", Object.entries(C.E_SERIES).map(([k, v]) => [k, v.map((x) => C.fmt(x, 1)).join(" · ")])),
  ];
}
