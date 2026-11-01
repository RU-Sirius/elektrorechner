// Kalkulation & Aufmaß: eigener Leistungskatalog (Material €/Einheit, Zeit min/Einheit), Projekte mit Räumen/Verteilern
// und Positionen, Zuschläge, Rabatt, MwSt., PDF. Keine Herstellerpreise hinterlegt.
import { h, section, msgRow, resultRow } from "./ui.js";
import { sharePdf, safeFilename } from "./pdf.js";
import { uid, today, deDate, num, de, eur, docStore, field, selectField, segField, textArea, buttons, btn, cardList, docList, docFooter, shareText, csv } from "./docui.js";

const store = docStore("kalkProjekte");
const CAT_KEY = "kalkKatalog";
export const UNITS = ["Stk", "m", "m²", "h", "psch"];
const loadCat = () => { try { return JSON.parse(localStorage.getItem(CAT_KEY)) ?? []; } catch { return []; } };
const saveCat = (c) => localStorage.setItem(CAT_KEY, JSON.stringify(c));
// Beispielpositionen ohne Preise – Material und Zeit trägt der Anwender selbst ein
const EXAMPLES = [["Schalter-/Gerätedose setzen", "Stk"], ["Steckdose einbauen", "Stk"], ["Schalter einbauen", "Stk"], ["Leitung NYM-J 3×1,5 verlegen", "m"],
  ["Leitung NYM-J 5×2,5 verlegen", "m"], ["Leitungsschutzschalter einbauen", "Stk"], ["Fehlerstrom-Schutzschalter einbauen", "Stk"], ["Leuchte montieren und anschließen", "Stk"],
  ["Schlitz stemmen und verschließen", "m"], ["Prüfung und Dokumentation", "psch"], ["Arbeitsstunde", "h"]];

export const newProject = () => ({ id: uid(), created: new Date().toISOString(), date: today(), title: "", client: "", address: "", kind: "Angebot",
  wage: "", matSurcharge: "0", discount: "0", vat: "19", showPrices: "yes", intro: "", notes: "", rooms: [{ id: uid(), name: "Raum 1", items: [] }] });

// ---------- Berechnung ----------
export function position(it, p) {
  const qty = num(it.qty) ?? 0, mat = num(it.mat) ?? 0, time = num(it.time) ?? 0, wage = num(p.wage) ?? 0, ms = (num(p.matSurcharge) ?? 0) / 100;
  const epMat = mat * (1 + ms), epLab = (time / 60) * wage, ep = epMat + epLab;
  return { qty, epMat, epLab, ep, gp: qty * ep, mat: qty * epMat, lab: qty * epLab, hours: (qty * time) / 60 };
}
export function totals(p) {
  let mat = 0, lab = 0, hours = 0;
  const rooms = p.rooms.map((r) => { let sum = 0; for (const it of r.items) { const x = position(it, p); sum += x.gp; mat += x.mat; lab += x.lab; hours += x.hours; } return sum; });
  const net = mat + lab, discount = net * ((num(p.discount) ?? 0) / 100), netAfter = net - discount, vat = netAfter * ((num(p.vat) ?? 0) / 100);
  return { rooms, mat, lab, hours, net, discount, netAfter, vat, gross: netAfter + vat };
}

// ---------- Ansichten ----------
export function kalkView(arg) {
  if (arg === "katalog") return catalogView();
  const p = arg && store.get(arg);
  if (p) return editView(p);
  return [
    ...section("", [h("a", { class: "row", href: "#kalk/katalog", style: "color:inherit;text-decoration:none" }, h("span", { class: "label" }, h("div", {}, "Leistungskatalog (eigene Preise und Zeiten)"),
      h("div", { class: "report-meta" }, `${loadCat().length} Position(en)`)))]),
    ...docList({ store, route: "kalk", newLabel: "+ Neues Angebot / Aufmaß", create: newProject,
      emptyText: "Noch keine Kalkulation. Lege zuerst im Leistungskatalog deine Positionen mit Materialpreis und Zeitansatz an.",
      describe: (d) => [d.title || "Ohne Bezeichnung", `${deDate(d.date)} · ${d.kind} · ${eur(totals(d).gross)} brutto`] }),
  ];
}

function catalogView() {
  const cat = loadCat(), open = new Set();
  const root = h("div");
  const save = () => saveCat(cat);
  const render = () => root.replaceChildren(
    ...section("Positionen", cat.length ? [cardList({ items: cat, open,
      title: (it) => `${it.nr ? it.nr + " · " : ""}${it.text || "Neue Position"} (${it.unit})`,
      badge: (it) => [num(it.mat) !== null || num(it.time) !== null ? `${de(num(it.mat) ?? 0, 2, 2)} € · ${de(num(it.time) ?? 0, 1)} min` : "ohne Preis", ""],
      body: (it, refresh) => [field("Nr.", it, "nr", { save, onChange: refresh }), field("Bezeichnung", it, "text", { save, onChange: refresh }), selectField("Einheit", it, "unit", UNITS, { save, onChange: refresh }),
        field("Materialpreis netto", it, "mat", { unit: "€/Einh.", mode: "decimal", save, onChange: refresh }), field("Zeitansatz", it, "time", { unit: "min/Einh.", mode: "decimal", save, onChange: refresh })],
      onDuplicate: (it) => { const c = { ...it, id: uid() }; cat.splice(cat.indexOf(it) + 1, 0, c); open.add(c.id); save(); render(); },
      onDelete: (it) => { cat.splice(cat.indexOf(it), 1); save(); render(); }, deleteText: (it) => `„${it.text}“ aus dem Katalog löschen?` })] : [msgRow("Noch keine Positionen.")],
      "Materialpreis = dein Einkaufs- bzw. Listenpreis je Einheit, Zeitansatz = Arbeitszeit je Einheit. Lohn, Materialzuschlag, Rabatt und MwSt. stellst du je Kalkulation ein. Es sind keine Herstellerpreise hinterlegt."),
    buttons(btn("+ Position", () => { const it = { id: uid(), nr: "", text: "", unit: "Stk", mat: "", time: "" }; cat.push(it); open.add(it.id); save(); render(); }),
      ...(cat.length ? [] : [btn("Beispiele einfügen (ohne Preise)", () => { EXAMPLES.forEach(([t, u], i) => cat.push({ id: uid(), nr: String(i + 1), text: t, unit: u, mat: "", time: "" })); save(); render(); })])),
    buttons(btn("Katalog als CSV", () => shareText("Leistungskatalog.csv", csv([["Nr", "Bezeichnung", "Einheit", "Material €", "Zeit min"], ...cat.map((c) => [c.nr, c.text, c.unit, c.mat, c.time])]))),
      h("a", { class: "btn", href: "#kalk", style: "text-align:center;text-decoration:none" }, "Zu den Kalkulationen")),
  );
  render();
  return [root];
}

function editView(p) {
  const save = () => store.save(p), open = new Set(), totalBox = h("div"), root = h("div");
  let updaters = []; // Anzeigen, die sich bei Satzänderungen aktualisieren
  const cat = loadCat();
  const renderTotals = () => {
    const t = totals(p);
    totalBox.replaceChildren(...section("Summen", [resultRow("Material (inkl. Zuschlag)", eur(t.mat)), resultRow("Lohn", `${eur(t.lab)} · ${de(t.hours, 2)} h`), resultRow("Summe netto", eur(t.net)),
      ...(t.discount ? [resultRow(`Rabatt ${de(num(p.discount), 2)} %`, `− ${eur(t.discount)}`), resultRow("Netto nach Rabatt", eur(t.netAfter))] : []),
      resultRow(`MwSt. ${de(num(p.vat) ?? 0, 2)} %`, eur(t.vat)), resultRow("Gesamt brutto", eur(t.gross), "good")],
      !(num(p.wage) > 0) ? "Hinweis: Stundensatz eintragen, sonst wird der Lohnanteil mit 0 € gerechnet." : ""));
  };
  const render = () => {
    updaters = [];
    root.replaceChildren(
      ...section("Kopf", [segField(p, "kind", [["Angebot", "Angebot"], ["Aufmaß", "Aufmaß"]], { save, onPick: render }), field("Bezeichnung / Bauvorhaben", p, "title", { save }),
        field("Kunde", p, "client", { save }), field("Anschrift", p, "address", { save }), field("Datum", p, "date", { type: "date", save })]),
      ...section("Sätze", [field("Stundensatz (Lohn)", p, "wage", { unit: "€/h", mode: "decimal", save, onChange: render2 }), field("Materialzuschlag", p, "matSurcharge", { unit: "%", mode: "decimal", save, onChange: render2 }),
        field("Rabatt", p, "discount", { unit: "%", mode: "decimal", save, onChange: render2 }), field("MwSt.", p, "vat", { unit: "%", mode: "decimal", save, onChange: render2 }),
        segField(p, "showPrices", [["yes", "Preise im PDF"], ["no", "Nur Mengen im PDF"]], { save, onPick: render })], "Alle Sätze trägst du selbst ein. Den MwSt.-Satz prüfst du für den jeweiligen Auftrag."),
      ...p.rooms.flatMap((r, ri) => roomNodes(r, ri)),
      buttons(btn("+ Raum / Verteiler", () => { p.rooms.push({ id: uid(), name: `Raum ${p.rooms.length + 1}`, items: [] }); save(); render(); })),
      totalBox,
      ...section("Texte", [textArea(p, "intro", "Vorbemerkung (z. B. Leistungsbeschreibung, Gültigkeit des Angebots)", save), textArea(p, "notes", "Schlussbemerkung (z. B. Zahlungsbedingungen)", save)]),
      ...section("Ausgabe", [buttons(btn("PDF erstellen", () => { store.flush(); exportPdf(p); }), btn("CSV", () => exportCsv(p)))]),
      ...docFooter({ store, doc: p, route: "kalk", copy: (c) => Object.assign(c, { id: uid(), created: new Date().toISOString(), date: today(), title: `${c.title} (Kopie)`,
        rooms: c.rooms.map((r) => ({ ...r, id: uid(), items: r.items.map((it) => ({ ...it, id: uid() })) })) }) }),
    );
    renderTotals();
  };
  const render2 = () => { updaters.forEach((f) => f()); renderTotals(); };
  function roomNodes(r, ri) {
    const title = h("div", { class: "section-title" }, `${ri + 1}. ${r.name}`), sub = h("span", { class: "value" });
    const updSub = () => { sub.textContent = eur(totals(p).rooms[ri]); };
    const pick = h("select", {}, h("option", { value: "" }, "Freie Position"), ...cat.map((c) => h("option", { value: c.id }, `${c.nr ? c.nr + " " : ""}${c.text} (${c.unit})`)));
    const list = cardList({ items: r.items, open,
      title: (it) => `${de(num(it.qty) ?? 0, 3)} ${it.unit} · ${it.text || "Position"}`,
      badge: (it) => [p.kind === "Aufmaß" && p.showPrices === "no" ? "" : eur(position(it, p).gp), ""],
      body: (it, refresh) => {
        const info = h("div", { class: "pp-detail" });
        const upd = () => { const x = position(it, p); info.textContent = `EP ${eur(x.ep)} (Material ${eur(x.epMat)} + Lohn ${eur(x.epLab)}) · GP ${eur(x.gp)} · ${de(x.hours, 2)} h`; refresh(); updSub(); renderTotals(); };
        setTimeout(upd, 0); updaters.push(upd);
        return [field("Menge", it, "qty", { mode: "decimal", save, onChange: upd }), selectField("Einheit", it, "unit", UNITS, { save, onChange: upd }), field("Bezeichnung", it, "text", { save, onChange: upd }),
          field("Material netto", it, "mat", { unit: "€/Einh.", mode: "decimal", save, onChange: upd }), field("Zeitansatz", it, "time", { unit: "min/Einh.", mode: "decimal", save, onChange: upd }),
          h("div", { class: "row pp-info" }, info)];
      },
      onDuplicate: (it) => { const c = { ...it, id: uid() }; r.items.splice(r.items.indexOf(it) + 1, 0, c); open.add(c.id); save(); render(); },
      onDelete: (it) => { r.items.splice(r.items.indexOf(it), 1); save(); render(); }, deleteText: (it) => `Position „${it.text}“ löschen?` });
    updSub(); updaters.push(updSub);
    return [title,
      h("div", { class: "group" }, field("Bezeichnung", r, "name", { save, onChange: () => (title.textContent = `${ri + 1}. ${r.name}`) }), h("div", { class: "row" }, h("span", { class: "label" }, "Zwischensumme netto"), sub)),
      list,
      h("div", { class: "group", style: "margin-top:8px" }, h("label", { class: "row" }, h("span", { class: "label" }, "Aus Katalog"), pick),
        buttons(btn("+ Position", () => { const c = cat.find((x) => x.id === pick.value); const it = { id: uid(), text: c?.text ?? "", unit: c?.unit ?? "Stk", qty: "1", mat: c?.mat ?? "", time: c?.time ?? "" };
          r.items.push(it); open.add(it.id); save(); render(); }),
          btn("Raum löschen", () => { if (confirm(`„${r.name}“ mit ${r.items.length} Position(en) löschen?`)) { p.rooms.splice(ri, 1); save(); render(); } }, "danger")))];
  }
  window.addEventListener("hashchange", () => store.flush(), { once: true });
  render();
  return [root];
}

// ---------- Ausgabe ----------
export function pdfDoc(p) {
  const t = totals(p), prices = p.showPrices !== "no";
  const cols = prices ? [{ title: "Pos.", w: 7 }, { title: "Menge", w: 8, align: "right" }, { title: "Einh.", w: 6 }, { title: "Bezeichnung", w: 49 }, { title: "EP €", w: 13, align: "right" }, { title: "GP €", w: 14, align: "right" }]
    : [{ title: "Pos.", w: 8 }, { title: "Menge", w: 12, align: "right" }, { title: "Einh.", w: 8 }, { title: "Bezeichnung", w: 72 }];
  const blocks = [{ rows: [["Kunde", p.client || "–"], ["Anschrift", p.address || "–"], ["Datum", deDate(p.date)]] }];
  if (p.intro?.trim()) blocks.push({ text: p.intro.trim() });
  p.rooms.forEach((r, ri) => {
    const rows = r.items.map((it, k) => { const x = position(it, p), pos = `${ri + 1}.${String(k + 1).padStart(2, "0")}`;
      return prices ? [pos, de(x.qty, 3), it.unit, it.text, de(x.ep, 2, 2), de(x.gp, 2, 2)] : [pos, de(x.qty, 3), it.unit, it.text]; });
    blocks.push({ heading: `${ri + 1}. ${r.name}`, table: { cols, rows } });
    if (prices) blocks.push({ rows: [[`Summe ${r.name}`, eur(t.rooms[ri])]] });
  });
  if (prices) blocks.push({ heading: "Zusammenstellung", rows: [...p.rooms.map((r, ri) => [`${ri + 1}. ${r.name}`, eur(t.rooms[ri])]), ["Summe netto", eur(t.net)],
    ...(t.discount ? [[`Rabatt ${de(num(p.discount), 2)} %`, `− ${eur(t.discount)}`], ["Netto nach Rabatt", eur(t.netAfter)]] : []),
    [`MwSt. ${de(num(p.vat) ?? 0, 2)} %`, eur(t.vat)], ["Gesamtbetrag brutto", eur(t.gross)]] });
  if (p.notes?.trim()) blocks.push({ heading: "Hinweise", text: p.notes.trim() });
  return { title: `${p.kind}${p.title ? `: ${p.title}` : ""}`, subtitle: `${deDate(p.date)}${p.client ? ` · ${p.client}` : ""}`, blocks, footer: "Erstellt mit ElektroRechner (Built by R. U. Sirius?)." };
}
function exportPdf(p) { sharePdf(`${p.kind}_${safeFilename(p.title || "Projekt")}_${p.date}.pdf`, pdfDoc(p)); }
function exportCsv(p) {
  const rows = [["Pos", "Raum", "Menge", "Einheit", "Bezeichnung", "Material €/Einh.", "Zeit min/Einh.", "EP €", "GP €"]];
  p.rooms.forEach((r, ri) => r.items.forEach((it, k) => { const x = position(it, p); rows.push([`${ri + 1}.${String(k + 1).padStart(2, "0")}`, r.name, de(x.qty, 3), it.unit, it.text, it.mat, it.time, de(x.ep, 2, 2), de(x.gp, 2, 2)]); }));
  shareText(`${p.kind}_${safeFilename(p.title || "Projekt")}.csv`, csv(rows));
}
