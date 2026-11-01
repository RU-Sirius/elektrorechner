// KNX-Planungshelfer: dreistufige Gruppenadressen, Linien mit Teilnehmern (physikalische Adressen), Busstrombilanz, CSV und PDF.
// Feste Werte nur aus dem Adressformat: physikalische Adresse 4/4/8 Bit (Bereich 0–15, Linie 0–15, Teilnehmer 0–255),
// dreistufige Gruppenadresse 5/3/8 Bit (0–31 / 0–7 / 0–255). Stromaufnahmen, Netzteilstrom und Teilnehmergrenzen gibt der Anwender ein.
import { h, section, msgRow, resultRow } from "./ui.js";
import { sharePdf, safeFilename } from "./pdf.js";
import { uid, today, deDate, num, de, docStore, field, segField, textArea, buttons, btn, cardList, docList, docFooter, shareText, csv } from "./docui.js";

const store = docStore("knxProjekte");
export const newProject = () => ({ id: uid(), created: new Date().toISOString(), date: today(), title: "", address: "", notes: "",
  lines: [{ id: uid(), area: "1", line: "1", name: "Linie 1.1", supply: "", maxDevices: "", devices: [] }],
  ga: [{ id: uid(), main: "0", name: "Beleuchtung", middles: [{ id: uid(), mid: "0", name: "Schalten", groups: [] }] }] });

// ---------- Logik ----------
const int = (v) => { const n = num(v); return n !== null && Number.isInteger(n) ? n : null; };
export const inRange = (v, max) => { const n = int(v); return n !== null && n >= 0 && n <= max; };
export const paStr = (l, d) => `${l.area}.${l.line}.${d.nr}`;
export const gaStr = (m, mi, g) => `${m.main}/${mi.mid}/${g.sub}`;
export const paValid = (l, d) => inRange(l.area, 15) && inRange(l.line, 15) && inRange(d.nr, 255);
export const gaValid = (m, mi, g) => inRange(m.main, 31) && inRange(mi.mid, 7) && inRange(g.sub, 255);
// Doppelte Adressen (Schlüssel → Anzahl)
export function duplicates(p) {
  const pa = new Map(), ga = new Map(), inc = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);
  for (const l of p.lines) for (const d of l.devices) inc(pa, paStr(l, d));
  for (const m of p.ga) for (const mi of m.middles) for (const g of mi.groups) inc(ga, gaStr(m, mi, g));
  return { pa, ga };
}
// Busstrombilanz einer Linie (mA)
export function busBalance(l) {
  const sum = l.devices.reduce((a, d) => a + (num(d.current) ?? 0), 0), supply = num(l.supply), max = int(l.maxDevices);
  const missing = l.devices.filter((d) => num(d.current) === null).length;
  return { n: l.devices.length, sum, supply, reserve: supply !== null ? supply - sum : null, load: supply ? sum / supply : null,
    currentOk: supply === null ? null : sum <= supply, countOk: max === null ? null : l.devices.length <= max, missing };
}
const nextFree = (used, max, start = 1) => { for (let i = start; i <= max; i++) if (!used.has(i)) return i; return null; };

// ---------- Ansichten ----------
let tab = "ga";
export function knxView(arg) {
  const p = arg && store.get(arg);
  if (p) return editView(p);
  return docList({ store, route: "knx", newLabel: "+ Neues KNX-Projekt", create: newProject,
    emptyText: "Noch kein KNX-Projekt. Gruppenadressen und Linien mit Teilnehmern anlegen, Busstrom bilanzieren, als CSV oder PDF ausgeben.",
    describe: (d) => { const n = d.lines.reduce((a, l) => a + l.devices.length, 0), g = d.ga.reduce((a, m) => a + m.middles.reduce((b, mi) => b + mi.groups.length, 0), 0);
      return [d.title || "Ohne Bezeichnung", `${deDate(d.date)} · ${d.lines.length} Linie(n) · ${n} Teilnehmer · ${g} Gruppenadressen`]; } });
}

function editView(p) {
  const save = () => store.save(p), open = new Set(), root = h("div");
  const render = () => {
    const dup = duplicates(p);
    const content = tab === "ga" ? gaNodes(dup) : tab === "lines" ? lineNodes(dup) : generalNodes();
    root.replaceChildren(
      h("div", { class: "group", style: "margin-top:12px" }, segField({ t: tab }, "t", [["ga", "Gruppenadressen"], ["lines", "Linien & Teilnehmer"], ["info", "Projekt & Export"]], { onPick: (v) => { tab = v; render(); } })),
      ...content);
  };

  // ----- Gruppenadressen -----
  function gaNodes(dup) {
    const badgeGA = (m, mi, g) => { const a = gaStr(m, mi, g); return !gaValid(m, mi, g) ? [`${a} ungültig`, "bad"] : duplicates(p).ga.get(a) > 1 ? [`${a} doppelt`, "bad"] : [a, "ok"]; };
    const mains = cardList({ items: p.ga, open,
      title: (m) => `${m.main} · ${m.name || "Hauptgruppe"}`,
      badge: (m) => [!inRange(m.main, 31) ? "0–31!" : `${m.middles.reduce((a, mi) => a + mi.groups.length, 0)} GA`, inRange(m.main, 31) ? "" : "bad"],
      body: (m, refM) => [
        field("Hauptgruppe (0–31)", m, "main", { mode: "numeric", save, onChange: refM }), field("Name", m, "name", { save, onChange: refM }),
        cardList({ items: m.middles, open,
          title: (mi) => `${m.main}/${mi.mid} · ${mi.name || "Mittelgruppe"}`,
          badge: (mi) => [!inRange(mi.mid, 7) ? "0–7!" : `${mi.groups.length} GA`, inRange(mi.mid, 7) ? "" : "bad"],
          body: (mi, refMi) => [
            field("Mittelgruppe (0–7)", mi, "mid", { mode: "numeric", save, onChange: refMi }), field("Name", mi, "name", { save, onChange: refMi }),
            cardList({ items: mi.groups, open,
              title: (g) => `${g.name || "Gruppenadresse"}`, badge: (g) => badgeGA(m, mi, g),
              body: (g, refG) => [field("Untergruppe (0–255)", g, "sub", { mode: "numeric", save, onChange: refG }), field("Name", g, "name", { save, onChange: refG, placeholder: "z. B. Küche Licht schalten" }),
                field("Datenpunkttyp (DPT)", g, "dpt", { save, placeholder: "z. B. 1.001" }), field("Bemerkung", g, "note", { save })],
              onDuplicate: (g) => { const used = new Set(mi.groups.map((x) => int(x.sub))); const c = { ...g, id: uid(), sub: String(nextFree(used, 255, (int(g.sub) ?? 0) + 1) ?? "") };
                mi.groups.splice(mi.groups.indexOf(g) + 1, 0, c); open.add(c.id); save(); render(); },
              onDelete: (g) => { mi.groups.splice(mi.groups.indexOf(g), 1); save(); render(); }, deleteText: (g) => `Gruppenadresse „${g.name}“ löschen?` }),
            buttons(btn("+ Gruppenadresse", () => { const used = new Set(mi.groups.map((x) => int(x.sub))); const g = { id: uid(), sub: String(nextFree(used, 255) ?? ""), name: "", dpt: "", note: "" };
              mi.groups.push(g); open.add(g.id); save(); render(); }))],
          onDelete: (mi) => { m.middles.splice(m.middles.indexOf(mi), 1); save(); render(); }, deleteText: (mi) => `Mittelgruppe „${mi.name}“ mit ${mi.groups.length} Gruppenadresse(n) löschen?` }),
        buttons(btn("+ Mittelgruppe", () => { const used = new Set(m.middles.map((x) => int(x.mid))); const mi = { id: uid(), mid: String(nextFree(used, 7, 0) ?? ""), name: "", groups: [] };
          m.middles.push(mi); open.add(mi.id); save(); render(); }))],
      onDelete: (m) => { p.ga.splice(p.ga.indexOf(m), 1); save(); render(); }, deleteText: (m) => `Hauptgruppe „${m.name}“ komplett löschen?` });
    const nDup = [...dup.ga.values()].filter((v) => v > 1).length;
    return [...section("Gruppenadressen (dreistufig)", [mains], nDup ? `${nDup} Adresse(n) mehrfach vergeben.` : "Hauptgruppe/Mittelgruppe/Untergruppe = 0–31 / 0–7 / 0–255. Neue Adressen erhalten die nächste freie Nummer."),
      buttons(btn("+ Hauptgruppe", () => { const used = new Set(p.ga.map((x) => int(x.main))); const m = { id: uid(), main: String(nextFree(used, 31, 0) ?? ""), name: "", middles: [] };
        p.ga.push(m); open.add(m.id); save(); render(); }))];
  }

  // ----- Linien & Teilnehmer -----
  function lineNodes(dup) {
    const lineBadge = (l) => { const b = busBalance(l); const bad = b.currentOk === false || b.countOk === false;
      return [`${b.n} TN · ${de(b.sum, 0)}${b.supply !== null ? ` / ${de(b.supply, 0)}` : ""} mA`, bad ? "bad" : b.currentOk ? "ok" : ""]; };
    const lines = cardList({ items: p.lines, open,
      title: (l) => `${l.area}.${l.line} · ${l.name || "Linie"}`, badge: lineBadge,
      body: (l, refL) => {
        const info = h("div", { class: "pp-detail" });
        const upd = () => { const b = busBalance(l); refL();
          info.replaceChildren(...[b.supply !== null ? `Busstrom ${de(b.sum, 1)} mA von ${de(b.supply, 0)} mA (${de(b.load * 100, 0)} %) · Reserve ${de(b.reserve, 1)} mA` : `Busstrom ${de(b.sum, 1)} mA – Nennstrom der Spannungsversorgung eintragen`,
            b.missing ? `${b.missing} Teilnehmer ohne Stromangabe` : "", b.countOk === false ? `Mehr Teilnehmer (${b.n}) als festgelegt (${l.maxDevices})` : "",
            b.currentOk === false ? "Stromaufnahme größer als die Spannungsversorgung!" : ""].filter(Boolean).map((t) => h("div", {}, t))); };
        setTimeout(upd, 0);
        return [field("Bereich (0–15)", l, "area", { mode: "numeric", save, onChange: upd }), field("Linie (0–15)", l, "line", { mode: "numeric", save, onChange: upd }), field("Bezeichnung", l, "name", { save, onChange: upd }),
          field("Nennstrom Spannungsversorgung", l, "supply", { unit: "mA", mode: "decimal", save, onChange: upd, placeholder: "laut Datenblatt" }),
          field("Max. Teilnehmer (optional)", l, "maxDevices", { mode: "numeric", save, onChange: upd }), h("div", { class: "row pp-info" }, info),
          cardList({ items: l.devices, open,
            title: (d) => `${d.name || "Teilnehmer"}${d.room ? ` · ${d.room}` : ""}`,
            badge: (d) => { const a = paStr(l, d); return !paValid(l, d) ? [`${a} ungültig`, "bad"] : duplicates(p).pa.get(a) > 1 ? [`${a} doppelt`, "bad"] : [a, "ok"]; },
            body: (d, refD) => [field("Teilnehmer-Nr. (0–255)", d, "nr", { mode: "numeric", save, onChange: () => { refD(); upd(); } }), field("Bezeichnung", d, "name", { save, onChange: refD, placeholder: "z. B. Schaltaktor 8-fach" }),
              field("Hersteller / Typ", d, "type", { save }), field("Einbauort", d, "room", { save, onChange: refD }), field("Stromaufnahme Bus", d, "current", { unit: "mA", mode: "decimal", save, onChange: upd, placeholder: "laut Datenblatt" }),
              field("Bemerkung", d, "note", { save })],
            onDuplicate: (d) => { const used = new Set(l.devices.map((x) => int(x.nr))); const c = { ...d, id: uid(), nr: String(nextFree(used, 255) ?? "") };
              l.devices.splice(l.devices.indexOf(d) + 1, 0, c); open.add(c.id); save(); render(); },
            onDelete: (d) => { l.devices.splice(l.devices.indexOf(d), 1); save(); render(); }, deleteText: (d) => `Teilnehmer „${d.name}“ löschen?` }),
          buttons(btn("+ Teilnehmer", () => { const used = new Set(l.devices.map((x) => int(x.nr))); const d = { id: uid(), nr: String(nextFree(used, 255) ?? ""), name: "", type: "", room: "", current: "", note: "" };
            l.devices.push(d); open.add(d.id); save(); render(); }))];
      },
      onDuplicate: null, onDelete: (l) => { p.lines.splice(p.lines.indexOf(l), 1); save(); render(); }, deleteText: (l) => `Linie ${l.area}.${l.line} mit ${l.devices.length} Teilnehmer(n) löschen?` });
    return [...section("Linien", [lines], "Physikalische Adresse = Bereich.Linie.Teilnehmer. Neue Teilnehmer erhalten die nächste freie Nummer ab 1 (die 0 ist üblicherweise dem Linien-/Bereichskoppler vorbehalten). " +
      "Stromaufnahmen und Nennstrom der Spannungsversorgung aus den Datenblättern eintragen."),
      buttons(btn("+ Linie", () => { const l = { id: uid(), area: p.lines.at(-1)?.area ?? "1", line: String((int(p.lines.at(-1)?.line) ?? 0) + 1), name: "", supply: "", maxDevices: "", devices: [] };
        l.name = `Linie ${l.area}.${l.line}`; p.lines.push(l); open.add(l.id); save(); render(); }))];
  }

  // ----- Projekt & Export -----
  function generalNodes() {
    const nPA = p.lines.reduce((a, l) => a + l.devices.length, 0), nGA = p.ga.reduce((a, m) => a + m.middles.reduce((b, mi) => b + mi.groups.length, 0), 0), dup = duplicates(p);
    const dPA = [...dup.pa].filter(([, v]) => v > 1).map(([k]) => k), dGA = [...dup.ga].filter(([, v]) => v > 1).map(([k]) => k);
    return [
      ...section("Projekt", [field("Bezeichnung", p, "title", { save }), field("Anschrift", p, "address", { save }), field("Datum", p, "date", { type: "date", save }), textArea(p, "notes", "Notizen", save)]),
      ...section("Übersicht", [resultRow("Linien", String(p.lines.length)), resultRow("Teilnehmer", String(nPA)), resultRow("Gruppenadressen", String(nGA)),
        resultRow("Doppelte physikalische Adressen", dPA.length ? dPA.join(", ") : "keine", dPA.length ? "bad" : "good"), resultRow("Doppelte Gruppenadressen", dGA.length ? dGA.join(", ") : "keine", dGA.length ? "bad" : "good")]),
      ...section("Export", [buttons(btn("PDF erstellen", () => { store.flush(); sharePdf(`KNX_${safeFilename(p.title || "Projekt")}.pdf`, pdfDoc(p)); })),
        buttons(btn("Gruppenadressen CSV", () => shareText(`KNX_Gruppenadressen_${safeFilename(p.title || "Projekt")}.csv`, gaCsv(p))),
          btn("Teilnehmer CSV", () => shareText(`KNX_Teilnehmer_${safeFilename(p.title || "Projekt")}.csv`, devCsv(p))))],
        "CSV mit Semikolon für Tabellenkalkulationen. Das Format ist nicht das ETS-Importformat – für die Übernahme in die ETS die Spalten ggf. anpassen."),
      ...docFooter({ store, doc: p, route: "knx", copy: (c) => Object.assign(c, { id: uid(), created: new Date().toISOString(), date: today(), title: `${c.title} (Kopie)` }) }),
    ];
  }
  window.addEventListener("hashchange", () => store.flush(), { once: true });
  render();
  return [root];
}

// ---------- Export ----------
const sortN = (a, b) => (int(a) ?? 999) - (int(b) ?? 999);
export function gaRows(p) {
  const out = [];
  for (const m of [...p.ga].sort((a, b) => sortN(a.main, b.main))) for (const mi of [...m.middles].sort((a, b) => sortN(a.mid, b.mid)))
    for (const g of [...mi.groups].sort((a, b) => sortN(a.sub, b.sub))) out.push([gaStr(m, mi, g), m.name, mi.name, g.name, g.dpt, g.note]);
  return out;
}
export const gaCsv = (p) => csv([["Adresse", "Hauptgruppe", "Mittelgruppe", "Gruppenadresse", "DPT", "Bemerkung"], ...gaRows(p)]);
export const devCsv = (p) => csv([["Physikalische Adresse", "Linie", "Bezeichnung", "Hersteller/Typ", "Einbauort", "Busstrom mA", "Bemerkung"],
  ...p.lines.flatMap((l) => [...l.devices].sort((a, b) => sortN(a.nr, b.nr)).map((d) => [paStr(l, d), l.name, d.name, d.type, d.room, d.current, d.note]))]);
export function pdfDoc(p) {
  const blocks = [{ rows: [["Anschrift", p.address || "–"], ["Datum", deDate(p.date)]] }];
  if (p.notes?.trim()) blocks.push({ text: p.notes.trim() });
  blocks.push({ heading: "Gruppenadressen", table: { cols: [{ title: "Adresse", w: 10 }, { title: "Hauptgruppe", w: 16 }, { title: "Mittelgruppe", w: 16 }, { title: "Gruppenadresse", w: 30 }, { title: "DPT", w: 8 }, { title: "Bemerkung", w: 20 }], rows: gaRows(p) } });
  for (const l of p.lines) {
    const b = busBalance(l);
    blocks.push({ heading: `Linie ${l.area}.${l.line}${l.name ? ` – ${l.name}` : ""}`, table: { cols: [{ title: "Adresse", w: 10 }, { title: "Bezeichnung", w: 28 }, { title: "Hersteller / Typ", w: 22 }, { title: "Einbauort", w: 18 }, { title: "Busstrom mA", w: 10, align: "right" }, { title: "Bemerkung", w: 12 }],
      rows: [...l.devices].sort((a, c) => sortN(a.nr, c.nr)).map((d) => [paStr(l, d), d.name, d.type, d.room, d.current, d.note]) } });
    blocks.push({ rows: [["Teilnehmer", String(b.n)], ["Busstrom gesamt", `${de(b.sum, 1)} mA`], ["Spannungsversorgung", b.supply !== null ? `${de(b.supply, 0)} mA (Auslastung ${de(b.load * 100, 0)} %, Reserve ${de(b.reserve, 1)} mA)` : "nicht angegeben"]] });
  }
  return { title: `KNX-Projekt${p.title ? `: ${p.title}` : ""}`, subtitle: deDate(p.date), blocks,
    footer: "Erstellt mit ElektroRechner (Built by R. U. Sirius?). Stromaufnahmen und Nennströme laut Angaben des Anwenders; ersetzt keine Projektierung in der ETS." };
}
