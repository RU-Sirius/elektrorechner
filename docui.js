// Gemeinsame Bausteine für Dokument-Werkzeuge (Kalkulation, KNX, Kabelbuch): lokaler Speicher, Eingabefelder,
// aufklappbare Kartenlisten, Projektliste, Datei-Export. Alles bleibt im Browser (Datensicherung über die Einstellungen).
import { h, section, msgRow } from "./ui.js";

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const today = () => new Date().toISOString().slice(0, 10);
export const deDate = (iso) => (iso ? new Date(iso + "T12:00:00").toLocaleDateString("de-DE") : "");
export const num = (v) => { const s = String(v ?? "").trim().replace(/\s/g, "").replace(",", "."); if (s === "") return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
export const de = (v, d = 2, min = 0) => (v === null || v === undefined || !Number.isFinite(v) ? "" : v.toLocaleString("de-DE", { minimumFractionDigits: min, maximumFractionDigits: d }));
export const eur = (v) => (Number.isFinite(v) ? `${v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : "–");

// Speicher mit verzögertem Schreiben
export function docStore(key) {
  const load = () => { try { return JSON.parse(localStorage.getItem(key)) ?? []; } catch { return []; } };
  const saveAll = (l) => localStorage.setItem(key, JSON.stringify(l));
  let timer = 0, pending = null;
  const write = (doc) => { const l = load(), i = l.findIndex((x) => x.id === doc.id); if (i >= 0) l[i] = doc; else l.push(doc); saveAll(l); };
  const st = {
    list: load,
    get: (id) => load().find((x) => x.id === id) ?? null,
    add: (doc) => { const l = load(); l.push(doc); saveAll(l); return doc; },
    remove: (id) => { clearTimeout(timer); pending = null; saveAll(load().filter((x) => x.id !== id)); },
    save: (doc) => { pending = doc; clearTimeout(timer); timer = setTimeout(st.flush, 250); },
    flush: () => { clearTimeout(timer); if (pending) { write(pending); pending = null; } },
  };
  return st;
}

// Eingabezeile, die direkt in obj[key] schreibt
export function field(label, obj, key, { unit = "", mode = "text", type = "text", placeholder = "–", onChange, save } = {}) {
  return h("label", { class: "row" + (mode === "text" ? " wide" : "") }, h("span", { class: "label" }, label),
    h("input", { type, inputmode: type === "text" ? mode : undefined, value: obj[key] ?? "", placeholder, autocomplete: "off", autocapitalize: mode === "text" ? "sentences" : "off",
      oninput: (e) => { obj[key] = e.target.value; save?.(); onChange?.(); } }),
    h("span", { class: "unit" }, unit));
}
export function selectField(label, obj, key, options, { save, onChange } = {}) {
  return h("label", { class: "row" }, h("span", { class: "label" }, label),
    h("select", { onchange: (e) => { obj[key] = e.target.value; save?.(); onChange?.(); } },
      ...options.map((o) => { const [v, t] = Array.isArray(o) ? o : [o, o]; return h("option", { value: v, selected: String(v) === String(obj[key] ?? "") }, t); })));
}
export function segField(obj, key, options, { save, onPick } = {}) {
  return h("div", { class: "row seg-row" }, h("div", { class: "seg" },
    ...options.map(([v, t]) => h("button", { class: obj[key] === v ? "on" : "", onclick: () => { obj[key] = v; save?.(); onPick?.(v); } }, t))));
}
export const textArea = (obj, key, placeholder, save) => h("label", { class: "row wide" },
  h("textarea", { class: "pp-text", rows: 3, placeholder, oninput: (e) => { obj[key] = e.target.value; save?.(); } }, obj[key] ?? ""));
export const buttons = (...btns) => h("div", { class: "btnrow" }, ...btns);
export const btn = (label, onclick, cls = "") => h("button", { class: "btn " + cls, onclick }, label);

// Aufklappbare Karten (wie die Stromkreise im Prüfprotokoll)
// opts: { items, open:Set, title(it), badge?(it) → [text, "ok"|"bad"|""], body(it, refresh) → [Zeilen], onDuplicate?(it), onDelete(it), deleteText(it) }
export function cardList({ items, open, title, badge, body, onDuplicate, onDelete, deleteText }) {
  return h("div", { class: "pp-list" }, ...items.map((it) => {
    const sum = h("span", { class: "pp-sum" }), bdg = h("span", { class: "pp-badge" });
    const refresh = () => { sum.textContent = title(it); if (badge) { const [t, c] = badge(it); bdg.textContent = t; bdg.className = "pp-badge " + (c || ""); bdg.hidden = !t; } else bdg.hidden = true; };
    const d = h("details", { class: "pp-circuit", ontoggle: (e) => { if (e.target.open) open.add(it.id); else open.delete(it.id); } },
      h("summary", {}, sum, bdg),
      h("div", { class: "group" }, ...body(it, refresh),
        buttons(...(onDuplicate ? [btn("Duplizieren", () => onDuplicate(it))] : []),
          btn("Löschen", () => { if (confirm(deleteText ? deleteText(it) : "Eintrag löschen?")) onDelete(it); }, "danger"))));
    if (open.has(it.id)) d.open = true;
    refresh();
    return d;
  }));
}

// Projektliste mit „Neu“
export function docList({ store, route, newLabel, emptyText, describe, create, footer }) {
  const list = [...store.list()].sort((a, b) => (b.date || b.created || "").localeCompare(a.date || a.created || ""));
  return [
    ...section("", [buttons(btn(newLabel, () => { const d = store.add(create()); location.hash = `${route}/${d.id}`; }))]),
    ...(list.length ? section("Gespeichert", list.map((d) => { const [t, sub] = describe(d);
      return h("a", { class: "row", href: `#${route}/${d.id}`, style: "color:inherit;text-decoration:none" }, h("span", { class: "label" }, h("div", {}, t), h("div", { class: "report-meta" }, sub))); }))
      : section("", [msgRow(emptyText)])),
    h("div", { class: "footer" }, footer ?? "Die Daten bleiben nur auf diesem Gerät. Sicherung über Einstellungen → Datensicherung."),
  ];
}

// Fußbereich eines Dokuments: Kopieren, Liste, Löschen
export function docFooter({ store, doc, route, copy, extra = [] }) {
  return section("Verwalten", [
    ...(extra.length ? [buttons(...extra)] : []),
    buttons(...(copy ? [btn("Kopie anlegen", () => { store.flush(); const c = store.add(copy(JSON.parse(JSON.stringify(doc)))); location.hash = `${route}/${c.id}`; })] : []),
      h("a", { class: "btn", href: `#${route}`, style: "text-align:center;text-decoration:none", onclick: () => store.flush() }, "Alle anzeigen"),
      btn("Löschen", () => { if (confirm("Endgültig löschen?")) { store.remove(doc.id); location.hash = route; } }, "danger"))]);
}

// Textdatei (z. B. CSV) teilen bzw. herunterladen
export function shareText(name, text, type = "text/csv") {
  const file = new File(["﻿" + text], name, { type: `${type};charset=utf-8` }); // BOM: Umlaute in Excel korrekt
  const download = () => { const url = URL.createObjectURL(file), a = h("a", { href: url, download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); };
  if (navigator.canShare?.({ files: [file] })) navigator.share({ files: [file], title: name }).catch((e) => { if (e.name !== "AbortError") download(); });
  else download();
}
// CSV mit Semikolon (deutsches Excel)
export const csv = (rows) => rows.map((r) => r.map((v) => { const s = String(v ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(";")).join("\r\n");
