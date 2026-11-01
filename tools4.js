// Beleuchtung, Motoranlauf, Messprotokoll.
import * as C from "./calc.js";
import * as C4 from "./calc4.js";
import { calcView, section, segmented, resultRow, msgRow, h, PREFIX_HINT } from "./ui.js";

const fmt = C.fmt, si = C.si;
const ok = (b) => (b ? "good" : "bad");

export function lighting() {
  return calcView({
    init: { a: "8", b: "6", h: "2,05", em: "500", phi: "4000", etaB: "0,6", mf: "0,8", pLum: "30" },
    inputs: (s, { field }) => [
      ...section("Raum", [field("a", "Länge a", "m"), field("b", "Breite b", "m"), field("h", "Höhe Leuchte über Nutzebene", "m")]),
      ...section("Anforderung & Leuchte", [field("em", "Wartungswert Beleuchtungsstärke Ēm", "lx"), field("phi", "Lichtstrom je Leuchte", "lm"),
        field("etaB", "Beleuchtungswirkungsgrad η_B", ""), field("mf", "Wartungsfaktor MF", ""), field("pLum", "Leistung je Leuchte (optional)", "W")]),
    ],
    compute: (s, p) => {
      const r = C4.lighting({ a: p(s.a), b: p(s.b), h: p(s.h), em: p(s.em), phi: p(s.phi), etaB: p(s.etaB), mf: p(s.mf), pLum: p(s.pLum) });
      return [resultRow("Grundfläche", `${fmt(r.area, 2)} m²`), resultRow("Raumindex k", fmt(r.k, 2)),
        resultRow("Rechnerische Leuchtenanzahl", fmt(r.nExact, 2)), resultRow("Leuchten (aufgerundet)", String(r.n), "good"),
        resultRow("Erreichte Beleuchtungsstärke", `${fmt(r.emReached, 0)} lx`),
        r.pTotal !== undefined && resultRow("Anschlussleistung", si(r.pTotal, "W")),
        r.wPerM2 !== undefined && resultRow("Spezifische Leistung", `${fmt(r.wPerM2, 1)} W/m² · ${fmt(r.wPerM2_100lx, 2)} W/(m²·100 lx)`)];
    },
    footer: "Wirkungsgradverfahren: N = Ēm · A / (Φ · η_B · MF). η_B = Raumwirkungsgrad (aus Tabelle über den Raumindex k und die Reflexionsgrade) × " +
      "Leuchtenbetriebswirkungsgrad; bei LED-Leuchten mit Angabe des Leuchtenlichtstroms ist der Leuchtenbetriebswirkungsgrad bereits enthalten. " +
      "Ēm, η_B und MF aus Norm/Arbeitsstättenregel, Herstellerunterlagen bzw. Wartungsplan einsetzen – die Vorgaben sind Beispiele. " +
      "Liefert nur die mittlere Beleuchtungsstärke; Gleichmäßigkeit und Blendung erfordern eine Lichtplanung (z. B. mit Planungssoftware).",
  });
}

export function motorStart() {
  return calcView({
    init: { p: "11k", u: "400", cos: "0,85", eta: "0,9", kI: "7", kM: "2,2", method: "direct", uStart: "50" },
    inputs: (s, { field, set }) => [
      ...section("Motor (Typenschild / Datenblatt)", [field("p", "Bemessungsleistung (Welle)", "W"), field("u", "Bemessungsspannung", "V"), field("cos", "cos φ", ""),
        field("eta", "Wirkungsgrad η", ""), field("kI", "Anzugsstromverhältnis I_A / I_N", ""), field("kM", "Anzugsmomentverhältnis M_A / M_N", "")]),
      ...section("Anlaufverfahren", [segmented([["direct", "Direkt"], ["stardelta", "Stern-Dreieck"], ["soft", "Sanftanlauf"]], s.method, (v) => set("method", v)),
        ...(s.method === "soft" ? [field("uStart", "Startspannung", "% U_N")] : [])]),
    ],
    compute: (s, p) => {
      const r = C4.motorStart({ p: p(s.p), u: p(s.u), cos: p(s.cos), eta: p(s.eta), kI: p(s.kI), kM: p(s.kM), method: s.method, uStart: s.method === "soft" ? p(s.uStart) / 100 : null });
      return [resultRow("Bemessungsstrom I_N", si(r.iN, "A")), resultRow("Anlaufstrom (Netz)", `${si(r.iA, "A")} (${fmt(r.ratioI, 2)} · I_N)`, "good"),
        resultRow("Anlaufmoment", r.kMStart !== undefined ? `${fmt(r.kMStart, 2)} · M_N` : `${fmt(r.fM * 100, 0)} % von M_A`),
        resultRow(s.method === "stardelta" ? "Motorschutz (in den Strängen)" : "Einstellwert Motorschutz", si(r.relay, "A"))];
    },
    footer: (s) => (s.method === "stardelta" ? "Stern-Dreieck: Strom und Moment im Stern etwa ⅓ des Direktanlaufs. Liegt das Motorschutzrelais in den Motorsträngen (übliche Schaltung), wird es auf I_N/√3 ≈ 0,58·I_N eingestellt; liegt es in der Zuleitung, auf I_N. "
      : s.method === "soft" ? "Sanftanlauf (Näherung): Strom ~ Startspannung, Moment ~ Startspannung². Das Anlaufmoment muss das Lastmoment sicher übersteigen. "
      : "Direktanlauf: Anlaufstrom = I_A/I_N · I_N. ") +
      "I = P / (√3 · U · cos φ · η). Für den Einstellwert gilt der Bemessungsstrom vom Typenschild, wenn bekannt. I_A/I_N und M_A/M_N aus dem Datenblatt. " + PREFIX_HINT,
  });
}

// Messprotokoll-Hilfe: mehrere Stromkreise, Grenzwerte vom Anwender.
export function measurement() {
  const MAX = 12;
  return calcView({
    init: { n: "3", u0: "230", zsFactor: "1", risoMin: "1", tMax: "300", idn: "30", c1_name: "Licht Küche", c1_dev: "B10", c2_name: "Steckdosen Küche", c2_dev: "B16", c3_name: "Herd", c3_dev: "B16" },
    inputs: (s, { field, set }) => {
      const n = Math.max(1, Math.min(MAX, Number(s.n) || 1));
      const circuit = (i) => section(`Stromkreis ${i}`, [
        field(`c${i}_name`, "Bezeichnung", "", "text"), field(`c${i}_dev`, "Schutzorgan (z. B. B16)", "", "text"),
        field(`c${i}_zs`, "Zs gemessen", "Ω"), field(`c${i}_riso`, "R_iso gemessen", "MΩ"), field(`c${i}_t`, "RCD-Auslösezeit bei IΔn", "ms"), field(`c${i}_i`, "RCD-Auslösestrom", "mA")]);
      return [
        ...section("Grenzwerte (vom Anwender festzulegen)", [field("u0", "U₀", "V"), field("zsFactor", "Faktor für Zs,max", ""), field("risoMin", "R_iso Mindestwert", "MΩ"),
          field("tMax", "RCD max. Auslösezeit", "ms"), field("idn", "RCD-Bemessungsfehlerstrom IΔn", "mA")],
          "Zs,max = U₀ / Ia · Faktor mit Ia = 5·In (B), 10·In (C), 20·In (D). Ein Faktor < 1 (z. B. ⅔) berücksichtigt die Erwärmung der Leiter bei Messung im kalten Zustand – ob und welcher Faktor anzuwenden ist, nach geltender Norm festlegen. " +
          "Mindestwert R_iso und Auslösezeit ebenfalls nach Norm bzw. Prüfvorschrift eintragen."),
        ...Array.from({ length: n }, (_, k) => circuit(k + 1)).flat(),
        h("div", { class: "btnrow noprint" },
          h("button", { class: "btn", disabled: n >= MAX ? "" : undefined, onclick: () => set("n", String(n + 1)) }, "+ Stromkreis"),
          h("button", { class: "btn", disabled: n <= 1 ? "" : undefined, onclick: () => set("n", String(n - 1)) }, "− Letzten entfernen")),
      ];
    },
    resultTitle: "Bewertung",
    compute: (s, p) => {
      const n = Math.max(1, Math.min(MAX, Number(s.n) || 1)), lim = { u0: p(s.u0), zsFactor: p(s.zsFactor) ?? 1, risoMin: p(s.risoMin), tMax: p(s.tMax), idn: p(s.idn) };
      if (!(lim.u0 > 0)) throw new Error("positive");
      const rows = [];
      let all = true, any = false;
      for (let i = 1; i <= n; i++) {
        const r = C4.checkCircuit({ device: s[`c${i}_dev`], zs: p(s[`c${i}_zs`]), riso: p(s[`c${i}_riso`]), trcd: p(s[`c${i}_t`]), ircd: p(s[`c${i}_i`]) }, lim);
        const parts = [];
        if (r.zsOk !== undefined) parts.push(`Zs ${r.zsOk ? "✓" : "✗"} (max ${fmt(r.zsMax, 2)} Ω)`);
        if (r.risoOk !== undefined) parts.push(`R_iso ${r.risoOk ? "✓" : "✗"}`);
        if (r.tOk !== undefined) parts.push(`t ${r.tOk ? "✓" : "✗"}`);
        if (r.iOk !== undefined) parts.push(`IΔ ${r.iOk ? "✓" : "✗"}`);
        if (!r.dev && p(s[`c${i}_zs`]) !== null) parts.push("Schutzorgan nicht erkannt");
        const name = `${i}: ${s[`c${i}_name`] || "Stromkreis"}`;
        rows.push(resultRow(name, parts.length ? parts.join(" · ") : "keine Messwerte", r.status === null ? "" : ok(r.status)));
        if (r.status !== null) { any = true; all &&= r.status; }
      }
      if (any) rows.push(resultRow("Gesamt", all ? "alle bewerteten Werte eingehalten ✓" : "Grenzwert verletzt ✗", ok(all)));
      else rows.push(msgRow("Messwerte eintragen, um sie zu bewerten."));
      return rows;
    },
    footer: "Hilfe zur Bewertung von Messwerten – ersetzt kein Prüfprotokoll nach den geltenden Normen und keine Bewertung durch eine Elektrofachkraft. " +
      "Über „In Projekt speichern“ und „PDF teilen / sichern“ lässt sich die Liste dokumentieren.",
  });
}
