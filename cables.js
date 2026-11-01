// Kabel- und Klemmenbuch: Leitungen mit Kennzeichnung, Typ, Länge, Anfang/Ende mit Klemmstelle; Materialliste, Beschriftungsliste, CSV, PDF.
import { h, section, msgRow, resultRow } from "./ui.js";
import { sharePdf, safeFilename } from "./pdf.js";
import { uid, today, deDate, num, de, docStore, field, textArea, buttons, btn, cardList, docList, docFooter, shareText, csv } from "./docui.js";

const store = docStore("kabelbuecher");
export const newBook = () => ({ id: uid(), created: new Date().toISOString(), date: today(), title: "", address: "", prefix: "W", waste: "0", notes: "", cables: [] });

// ---------- Logik ----------
// Nächste freie Kennzeichnung: Präfix + (höchste vorhandene Nummer + 1)
export function nextLabel(b) {
  const pre = b.prefix ?? "", re = new RegExp(`^${pre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)$`);
  const max = b.cables.reduce((m, c) => { const x = re.exec(String(c.label ?? "").trim()); return x ? Math.max(m, Number(x[1])) : m; }, 0);
  return `${pre}${max + 1}`;
}
// Materialliste: Summe der Längen je Leitungstyp, optional mit Verschnittzuschlag
export function materials(b) {
  const w = 1 + (num(b.waste) ?? 0) / 100, m = new Map();
  for (const c of b.cables) { const t = (c.type || "ohne Typ").trim(), l = num(c.length) ?? 0; const e = m.get(t) ?? { type: t, n: 0, len: 0 }; e.n++; e.len += l; m.set(t, e); }
  return [...m.values()].map((e) => ({ ...e, withWaste: e.len * w })).sort((a, c) => a.type.localeCompare(c.type, "de"));
}
export function duplicateLabels(b) {
  const m = new Map(); b.cables.forEach((c) => { const k = String(c.label ?? "").trim(); if (k) m.set(k, (m.get(k) ?? 0) + 1); });
  return [...m].filter(([, n]) => n > 1).map(([k]) => k);
}
const endText = (where, term) => [where, term].filter((x) => String(x ?? "").trim()).join(" · ");
// natürliche Sortierung (W2 vor W10)
const natural = (a, b) => String(a.label ?? "").localeCompare(String(b.label ?? ""), "de", { numeric: true });

// ---------- Ansichten ----------
export function cableView(arg) {
  const b = arg && store.get(arg);
  if (b) return editView(b);
  return docList({ store, route: "cables", newLabel: "+ Neues Kabelbuch", create: newBook,
    emptyText: "Noch kein Kabelbuch. Leitungen mit Kennzeichnung, Typ, Länge und Klemmstellen erfassen – daraus entstehen Materialliste, Beschriftungsliste und PDF.",
    describe: (d) => [d.title || "Ohne Bezeichnung", `${deDate(d.date)} · ${d.cables.length} Leitung(en) · ${de(d.cables.reduce((a, c) => a + (num(c.length) ?? 0), 0), 1)} m`] });
}

function editView(b) {
  const save = () => store.save(b), open = new Set(), root = h("div"), matBox = h("div");
  let filter = "";
  const renderMat = () => {
    const mats = materials(b), dups = duplicateLabels(b);
    matBox.replaceChildren(...section("Materialliste", mats.length ? [...mats.map((m) => resultRow(`${m.type} (${m.n}×)`, `${de(m.withWaste, 1)} m`)),
      ...(dups.length ? [resultRow("Doppelte Kennzeichnung", dups.join(", "), "bad")] : [])] : [msgRow("Noch keine Leitungen.")],
      (num(b.waste) ?? 0) ? `Längen inkl. ${de(num(b.waste), 1)} % Verschnittzuschlag.` : "Summe der eingetragenen Längen je Leitungstyp."));
  };
  const render = () => {
    const f = filter.trim().toLowerCase();
    const shown = b.cables.filter((c) => !f || [c.label, c.type, c.from, c.to, c.termFrom, c.termTo, c.circuit, c.note].some((v) => String(v ?? "").toLowerCase().includes(f)));
    const types = [...new Set(b.cables.map((c) => c.type).filter(Boolean))];
    root.replaceChildren(
      ...section("Projekt", [field("Bezeichnung", b, "title", { save }), field("Anschrift", b, "address", { save }), field("Datum", b, "date", { type: "date", save }),
        field("Präfix Kennzeichnung", b, "prefix", { save, placeholder: "z. B. W" }), field("Verschnittzuschlag", b, "waste", { unit: "%", mode: "decimal", save, onChange: renderMat })]),
      h("div", { class: "search-wrap" }, h("input", { type: "search", class: "search-input", placeholder: "Leitungen filtern (Kennzeichnung, Typ, Ort, Klemme …)", value: filter,
        oninput: (e) => { filter = e.target.value; clearTimeout(render._t); render._t = setTimeout(() => { const pos = e.target.selectionStart; render(); const i = root.querySelector(".search-input"); i.focus(); i.setSelectionRange(pos, pos); }, 200); } })),
      ...section(`Leitungen${f ? ` (${shown.length} von ${b.cables.length})` : ` (${b.cables.length})`}`, shown.length ? [cardList({ items: [...shown].sort(natural), open,
        title: (c) => `${c.label || "?"} · ${c.type || "Typ?"}${num(c.length) !== null ? ` · ${de(num(c.length), 1)} m` : ""}`,
        badge: (c) => [duplicateLabels(b).includes(String(c.label ?? "").trim()) ? "doppelt" : `${c.from || "?"} → ${c.to || "?"}`, duplicateLabels(b).includes(String(c.label ?? "").trim()) ? "bad" : ""],
        body: (c, refresh) => { const upd = () => { refresh(); renderMat(); };
          return [field("Kennzeichnung", c, "label", { save, onChange: upd }), typeField(c, types, upd), field("Länge", c, "length", { unit: "m", mode: "decimal", save, onChange: upd }),
            field("Anfang (Ort)", c, "from", { save, onChange: upd, placeholder: "z. B. UV EG" }), field("Anfang Klemme", c, "termFrom", { save, placeholder: "z. B. X1:4–6" }),
            field("Ende (Ort)", c, "to", { save, onChange: upd, placeholder: "z. B. Küche Dose 3" }), field("Ende Klemme", c, "termTo", { save }),
            field("Stromkreis / Funktion", c, "circuit", { save, placeholder: "z. B. F3 Steckdosen Küche" }), field("Bemerkung", c, "note", { save })]; },
        onDuplicate: (c) => { const n = { ...c, id: uid(), label: nextLabel(b) }; b.cables.push(n); open.add(n.id); save(); render(); renderMat(); },
        onDelete: (c) => { b.cables.splice(b.cables.indexOf(c), 1); save(); render(); renderMat(); }, deleteText: (c) => `Leitung ${c.label} löschen?` })] : [msgRow(f ? "Keine Leitung passt zum Filter." : "Noch keine Leitungen.")]),
      buttons(btn("+ Leitung", () => { const last = b.cables.at(-1); const c = { id: uid(), label: nextLabel(b), type: last?.type ?? "", length: "", from: last?.from ?? "", termFrom: "", to: "", termTo: "", circuit: "", note: "" };
        b.cables.push(c); open.add(c.id); filter = ""; save(); render(); renderMat(); })),
      matBox,
      ...section("Notizen", [textArea(b, "notes", "Notizen zum Projekt", save)]),
      ...section("Ausgabe", [buttons(btn("Kabelliste PDF", () => { store.flush(); sharePdf(`Kabelbuch_${safeFilename(b.title || "Projekt")}.pdf`, pdfDoc(b)); }),
        btn("Beschriftungsliste PDF", () => { store.flush(); sharePdf(`Beschriftung_${safeFilename(b.title || "Projekt")}.pdf`, labelDoc(b)); })),
        buttons(btn("Kabelliste CSV", () => shareText(`Kabelbuch_${safeFilename(b.title || "Projekt")}.csv`, cableCsv(b))), btn("Beschriftung CSV", () => shareText(`Beschriftung_${safeFilename(b.title || "Projekt")}.csv`, labelCsv(b))))],
        "Beschriftungsliste: je Leitung ein Eintrag für Anfang und Ende – z. B. zum Übertragen in die Software eines Beschriftungsgeräts (CSV mit Semikolon)."),
      ...docFooter({ store, doc: b, route: "cables", copy: (c) => Object.assign(c, { id: uid(), created: new Date().toISOString(), date: today(), title: `${c.title} (Kopie)`, cables: c.cables.map((x) => ({ ...x, id: uid() })) }) }),
    );
    renderMat();
  };
  // Leitungstyp mit Vorschlägen aus bereits verwendeten Typen
  const typeField = (c, types, upd) => {
    const id = "types-" + b.id;
    const row = field("Leitungstyp", c, "type", { save, onChange: upd, placeholder: "z. B. NYM-J 3×1,5" });
    row.querySelector("input").setAttribute("list", id);
    row.append(h("datalist", { id }, ...types.map((t) => h("option", { value: t }))));
    return row;
  };
  window.addEventListener("hashchange", () => store.flush(), { once: true });
  render();
  return [root];
}

// ---------- Export ----------
const sorted = (b) => [...b.cables].sort(natural);
export const cableCsv = (b) => csv([["Kennzeichnung", "Leitungstyp", "Länge m", "Anfang", "Klemme Anfang", "Ende", "Klemme Ende", "Stromkreis/Funktion", "Bemerkung"],
  ...sorted(b).map((c) => [c.label, c.type, c.length, c.from, c.termFrom, c.to, c.termTo, c.circuit, c.note])]);
export const labelCsv = (b) => csv([["Kennzeichnung", "Ende", "Text"],
  ...sorted(b).flatMap((c) => [[c.label, "Anfang", `${c.label} → ${endText(c.to, c.termTo)}`], [c.label, "Ende", `${c.label} ← ${endText(c.from, c.termFrom)}`]])]);
export function pdfDoc(b) {
  const mats = materials(b);
  return { title: `Kabelbuch${b.title ? `: ${b.title}` : ""}`, subtitle: [deDate(b.date), b.address].filter(Boolean).join(" · "), landscape: true,
    blocks: [{ table: { cols: [{ title: "Kennz.", w: 7 }, { title: "Leitungstyp", w: 14 }, { title: "Länge m", w: 7, align: "right" }, { title: "Anfang", w: 15 }, { title: "Klemme", w: 9 },
      { title: "Ende", w: 15 }, { title: "Klemme", w: 9 }, { title: "Stromkreis / Funktion", w: 14 }, { title: "Bemerkung", w: 12 }],
      rows: sorted(b).map((c) => [c.label, c.type, de(num(c.length), 1), c.from, c.termFrom, c.to, c.termTo, c.circuit, c.note]) } },
    { heading: "Materialliste", rows: mats.map((m) => [`${m.type} (${m.n} Leitung(en))`, `${de(m.withWaste, 1)} m`]) },
    ...(b.notes?.trim() ? [{ heading: "Notizen", text: b.notes.trim() }] : [])],
    footer: `Erstellt mit ElektroRechner (Built by R. U. Sirius?).${(num(b.waste) ?? 0) ? ` Materialliste inkl. ${de(num(b.waste), 1)} % Verschnittzuschlag.` : ""}` };
}
export function labelDoc(b) {
  return { title: `Beschriftungsliste${b.title ? `: ${b.title}` : ""}`, subtitle: deDate(b.date),
    blocks: [{ table: { cols: [{ title: "Kennz.", w: 12 }, { title: "Typ", w: 22 }, { title: "Schild am Anfang", w: 33 }, { title: "Schild am Ende", w: 33 }],
      rows: sorted(b).map((c) => [c.label, c.type, `${c.label} → ${endText(c.to, c.termTo)}`, `${c.label} ← ${endText(c.from, c.termFrom)}`]) } }],
    footer: "Erstellt mit ElektroRechner (Built by R. U. Sirius?)." };
}
