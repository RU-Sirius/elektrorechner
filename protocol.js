// Prüf- und Messprotokoll: Anlagen mit Verteilern und Stromkreisen, Messwerte, selbst festgelegte Grenzwerte, PDF.
// Alles bleibt lokal im Browser (Datensicherung über die Einstellungen).
import * as C from "./calc.js";
import * as C4 from "./calc4.js";
import { h, section, msgRow, resultRow } from "./ui.js";
import { sharePdf, safeFilename } from "./pdf.js";

const KEY = "pruefprotokolle";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? []; } catch { return []; } };
const saveAll = (l) => localStorage.setItem(KEY, JSON.stringify(l));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const today = () => new Date().toISOString().slice(0, 10);
const deDate = (iso) => (iso ? new Date(iso + "T12:00:00").toLocaleDateString("de-DE") : "");
const fmt = (v, d = 2) => (v === null || v === undefined || !Number.isFinite(v) ? "" : C.fmt(v, d));

const KINDS = ["Erstprüfung", "Wiederholungsprüfung", "Prüfung nach Änderung/Erweiterung"];
const NETS = ["TN-S", "TN-C-S", "TN-C", "TT", "IT"];
const VISUAL = [["ok", "ohne Mängel"], ["bad", "Mängel"], ["", "nicht geprüft"]];

const newCircuit = (prev, nr) => ({ id: uid(), nr: String(nr), name: "", device: prev?.device ?? "B16", cable: prev?.cable ?? "NYM-J 3×1,5", rcd: prev?.rcd ?? "", zs: "", riso: "", rpe: "", t: "", i: "", note: "" });
const newBoard = (n) => ({ id: uid(), name: `UV ${n}`, location: "", circuits: [newCircuit(null, 1)] });
function newProtocol() {
  return { id: uid(), created: new Date().toISOString(),
    head: { object: "", address: "", client: "", company: "", inspector: "", date: today(), next: "", kind: KINDS[0], basis: "", meter: "", net: "TN-C-S", u0: "230" },
    limits: { zsFactor: "1", risoMin: "", rpeMax: "", tMax: "", idn: "30" },
    boards: [newBoard(1)], visual: "", trial: "", defects: "", verdict: "" };
}

// ---------- Bewertung ----------
function limitsOf(p) {
  const L = p.limits, n = (v) => C.parse(v);
  return { u0: n(p.head.u0) ?? 230, zsFactor: n(L.zsFactor) ?? 1, risoMin: n(L.risoMin), rpeMax: n(L.rpeMax), tMax: n(L.tMax), idn: n(L.idn) };
}
export function evalCircuit(c, lim) {
  // „>500“ bzw. „≥ 999“ (Messbereichsende) als Mindestwert lesen
  const n = (v) => C.parse(String(v ?? "").replace(/^\s*[>≥]\s*/, ""));
  const r = C4.checkCircuit({ device: c.device, zs: n(c.zs), riso: lim.risoMin === null ? null : n(c.riso), trcd: lim.tMax === null ? null : n(c.t), ircd: n(c.i) },
    { u0: lim.u0, zsFactor: lim.zsFactor, risoMin: lim.risoMin, tMax: lim.tMax, idn: lim.idn });
  const rpe = n(c.rpe);
  if (rpe !== null && lim.rpeMax !== null) r.rpeOk = rpe <= lim.rpeMax;
  const checks = [r.zsOk, r.risoOk, r.tOk, r.iOk, r.rpeOk].filter((v) => v !== undefined);
  r.status = checks.length ? checks.every(Boolean) : null;
  r.measured = [c.zs, c.riso, c.rpe, c.t, c.i].some((v) => String(v ?? "").trim() !== "");
  return r;
}
export function summary(p) {
  const lim = limitsOf(p);
  let total = 0, rated = 0, bad = 0;
  for (const b of p.boards) for (const c of b.circuits) { total++; const r = evalCircuit(c, lim); if (r.status !== null) { rated++; if (!r.status) bad++; } }
  return { total, rated, bad };
}
const statusText = (r) => (r.status === null ? (r.measured ? "nicht bewertet" : "–") : r.status ? "i. O." : "n. i. O.");

// ---------- Ansichten ----------
export function protocolView(arg) {
  const list = load();
  if (arg) { const p = list.find((x) => x.id === arg); if (p) return editView(p); }
  return listView(list);
}

function listView(list) {
  const sorted = [...list].sort((a, b) => (b.head.date || "").localeCompare(a.head.date || ""));
  const rows = sorted.map((p) => {
    const s = summary(p);
    return h("a", { class: "row", href: `#protocol/${p.id}`, style: "color:inherit;text-decoration:none" },
      h("span", { class: "label" }, h("div", {}, p.head.object || "Ohne Bezeichnung"),
        h("div", { class: "report-meta" }, `${deDate(p.head.date)} · ${p.head.kind} · ${s.total} Stromkreis(e)${s.bad ? ` · ${s.bad} n. i. O.` : ""}`)));
  });
  return [
    ...section("", [h("div", { class: "btnrow" }, h("button", { class: "btn", onclick: () => { const l = load(), p = newProtocol(); l.push(p); saveAll(l); location.hash = `protocol/${p.id}`; } }, "+ Neues Prüfprotokoll"))]),
    ...(rows.length ? section("Prüfprotokolle", rows) : section("", [msgRow("Noch keine Protokolle. Lege ein neues an: Anlagendaten, Verteiler und Stromkreise eintragen, messen, als PDF ausgeben.")])),
    h("div", { class: "footer" }, "Die Protokolle bleiben nur auf diesem Gerät. Sicherung über Einstellungen → Datensicherung. " +
      "Hilfsmittel zur Dokumentation – Prüfumfang, Grenzwerte und Bewertung verantwortet die prüfende Elektrofachkraft nach den geltenden Normen."),
  ];
}

function editView(p) {
  let timer = 0;
  const persist = () => { clearTimeout(timer); timer = setTimeout(() => { const l = load(), i = l.findIndex((x) => x.id === p.id); if (i >= 0) { l[i] = p; saveAll(l); } }, 250); };
  const flush = () => { clearTimeout(timer); const l = load(), i = l.findIndex((x) => x.id === p.id); if (i >= 0) { l[i] = p; saveAll(l); } };
  const root = h("div"), resultBox = h("div");
  const open = new Set([p.boards[0]?.circuits[0]?.id]);

  // Eingabezeile, die direkt ins Protokoll schreibt
  const inp = (label, obj, key, { unit = "", mode = "text", placeholder = "–", type = "text", onChange } = {}) =>
    h("label", { class: "row" + (mode === "text" ? " wide" : "") }, h("span", { class: "label" }, label),
      h("input", { type, inputmode: type === "text" ? mode : undefined, value: obj[key] ?? "", placeholder, autocomplete: "off", autocapitalize: mode === "text" ? "sentences" : "off",
        oninput: (e) => { obj[key] = e.target.value; persist(); onChange?.(); } }),
      h("span", { class: "unit" }, unit));
  const seg = (obj, key, opts, onPick) => h("div", { class: "row seg-row" }, h("div", { class: "seg" },
    ...opts.map(([v, t]) => h("button", { class: obj[key] === v ? "on" : "", onclick: () => { obj[key] = v; persist(); onPick ? onPick() : render(); } }, t))));
  const sel = (label, obj, key, opts) => h("label", { class: "row" }, h("span", { class: "label" }, label),
    h("select", { onchange: (e) => { obj[key] = e.target.value; persist(); } }, ...opts.map((o) => h("option", { value: o, selected: o === obj[key] }, o))));

  function circuitNode(b, c, lim) {
    const badge = h("span", { class: "pp-badge" }), sumTxt = h("span", { class: "pp-sum" });
    const refresh = () => {
      const r = evalCircuit(c, lim()); const st = statusText(r);
      badge.textContent = st; badge.className = "pp-badge " + (r.status === null ? "" : r.status ? "ok" : "bad");
      sumTxt.textContent = `${c.nr || "?"} · ${c.name || "Stromkreis"} · ${c.device || "–"}`;
      detail.replaceChildren(...detailRows(r));
      renderResult();
    };
    const detailRows = (r) => {
      const out = [];
      if (r.dev && r.zsMax !== undefined) out.push(`Zs,max ${fmt(r.zsMax)} Ω (Ia = ${fmt(r.dev.ia, 0)} A) · Ik ≈ ${fmt(r.ik, 0)} A`);
      else if (c.zs && !r.dev) out.push("Schutzorgan nicht erkannt – Form z. B. B16, C10, D20 (für Zs,max).");
      const fl = [r.zsOk === false && "Zs", r.risoOk === false && "R_iso", r.rpeOk === false && "R_PE", r.tOk === false && "Auslösezeit", r.iOk === false && "Auslösestrom"].filter(Boolean);
      if (fl.length) out.push(`Grenzwert überschritten: ${fl.join(", ")}`);
      return out.map((t) => h("div", {}, t));
    };
    const detail = h("div", { class: "pp-detail" });
    const on = refresh;
    const d = h("details", { class: "pp-circuit", ontoggle: (e) => { if (e.target.open) open.add(c.id); else open.delete(c.id); } },
      h("summary", {}, sumTxt, badge),
      h("div", { class: "group" },
        inp("Nr.", c, "nr", { onChange: on }), inp("Bezeichnung", c, "name", { placeholder: "z. B. Steckdosen Küche", onChange: on }),
        inp("Schutzorgan", c, "device", { placeholder: "z. B. B16", onChange: on }), inp("Leitung", c, "cable", { placeholder: "z. B. NYM-J 3×1,5" }),
        inp("RCD", c, "rcd", { placeholder: "z. B. 30 mA Typ A" }),
        inp("Zs (Schleifenimpedanz)", c, "zs", { unit: "Ω", mode: "decimal", onChange: on }), inp("R_iso", c, "riso", { unit: "MΩ", mode: "decimal", onChange: on }),
        inp("R_PE (Schutzleiter)", c, "rpe", { unit: "Ω", mode: "decimal", onChange: on }), inp("RCD-Auslösezeit", c, "t", { unit: "ms", mode: "decimal", onChange: on }),
        inp("RCD-Auslösestrom", c, "i", { unit: "mA", mode: "decimal", onChange: on }), inp("Bemerkung", c, "note"),
        h("div", { class: "row pp-info" }, detail),
        h("div", { class: "btnrow" },
          h("button", { class: "btn", onclick: () => { const k = b.circuits.indexOf(c), cp = { ...c, id: uid(), nr: String(b.circuits.length + 1), zs: "", riso: "", rpe: "", t: "", i: "", note: "" }; b.circuits.splice(k + 1, 0, cp); open.add(cp.id); persist(); render(); } }, "Duplizieren"),
          h("button", { class: "btn danger", onclick: () => { if (confirm(`Stromkreis „${c.name || c.nr}“ löschen?`)) { b.circuits.splice(b.circuits.indexOf(c), 1); persist(); render(); } } }, "Löschen"))));
    if (open.has(c.id)) d.open = true;
    refreshLater.push(refresh);
    return d;
  }
  let refreshLater = [];

  function renderResult() {
    const s = summary(p);
    resultBox.replaceChildren(...section("Ergebnis", [
      resultRow("Stromkreise", String(s.total)), resultRow("Mit Messwerten bewertet", String(s.rated)),
      resultRow("Grenzwert verletzt", String(s.bad), s.bad ? "bad" : s.rated ? "good" : ""),
      seg(p, "verdict", [["ok", "Keine Mängel festgestellt"], ["bad", "Mängel festgestellt"]], () => render()),
      inp("Nächster Prüftermin", p.head, "next", { type: "date" }),
    ], s.bad && p.verdict === "ok" ? "Hinweis: Es gibt Stromkreise mit überschrittenem Grenzwert." : "Das Gesamturteil legt die prüfende Elektrofachkraft fest."));
  }

  function render() {
    refreshLater = [];
    const lim = () => limitsOf(p);
    const boards = p.boards.flatMap((b, bi) => { const title = h("div", { class: "section-title" }, `Verteiler: ${b.name || bi + 1}`); return [
      title,
      h("div", { class: "group" }, inp("Bezeichnung", b, "name", { onChange: () => (title.textContent = `Verteiler: ${b.name || bi + 1}`) }), inp("Einbauort", b, "location")),
      h("div", { class: "pp-list" }, ...b.circuits.map((c) => circuitNode(b, c, lim))),
      h("div", { class: "btnrow" },
        h("button", { class: "btn", onclick: () => { const last = b.circuits[b.circuits.length - 1], c = newCircuit(last, b.circuits.length + 1); b.circuits.push(c); open.add(c.id); persist(); render(); } }, "+ Stromkreis"),
        h("button", { class: "btn danger", onclick: () => { if (confirm(`Verteiler „${b.name}“ mit ${b.circuits.length} Stromkreis(en) löschen?`)) { p.boards.splice(bi, 1); persist(); render(); } } }, "Verteiler löschen")),
    ]; });
    const H = p.head;
    root.replaceChildren(
      ...section("Anlage", [inp("Objekt / Anlage", H, "object", { placeholder: "z. B. EFH Musterstraße" }), inp("Anschrift", H, "address"), inp("Auftraggeber", H, "client"),
        sel("Netzform", H, "net", NETS), inp("U₀ (Leiter–Erde)", H, "u0", { unit: "V", mode: "decimal", onChange: () => refreshLater.forEach((f) => f()) })]),
      ...section("Prüfung", [seg(H, "kind", KINDS.map((k, i) => [k, ["Erstprüfung", "Wiederholung", "Änderung"][i]])), inp("Datum", H, "date", { type: "date" }),
        inp("Prüfer", H, "inspector"), inp("Firma", H, "company"), inp("Prüfgrundlage", H, "basis", { placeholder: "z. B. DIN VDE 0100-600" }), inp("Messgerät (Typ, Nr.)", H, "meter")]),
      ...section("Grenzwerte (vom Prüfer festzulegen)", [
        inp("Faktor für Zs,max", p.limits, "zsFactor", { mode: "decimal", onChange: () => refreshLater.forEach((f) => f()) }),
        inp("R_iso Mindestwert", p.limits, "risoMin", { unit: "MΩ", mode: "decimal", onChange: () => refreshLater.forEach((f) => f()) }),
        inp("R_PE Höchstwert (optional)", p.limits, "rpeMax", { unit: "Ω", mode: "decimal", onChange: () => refreshLater.forEach((f) => f()) }),
        inp("RCD max. Auslösezeit", p.limits, "tMax", { unit: "ms", mode: "decimal", onChange: () => refreshLater.forEach((f) => f()) }),
        inp("RCD IΔn", p.limits, "idn", { unit: "mA", mode: "decimal", onChange: () => refreshLater.forEach((f) => f()) })],
        "Zs,max = U₀ / Ia · Faktor mit Ia = 5·In (B), 10·In (C), 20·In (D). Leere Grenzwerte werden nicht bewertet. Alle Grenzwerte nach geltender Norm bzw. Prüfvorschrift eintragen – es sind keine Normwerte hinterlegt."),
      ...boards,
      h("div", { class: "btnrow" }, h("button", { class: "btn", onclick: () => { p.boards.push(newBoard(p.boards.length + 1)); persist(); render(); } }, "+ Verteiler")),
      ...section("Besichtigen & Erproben", [h("div", { class: "row" }, h("span", { class: "label" }, "Besichtigen")), seg(p, "visual", VISUAL),
        h("div", { class: "row" }, h("span", { class: "label" }, "Erproben (Funktion, RCD-Prüftaste)")), seg(p, "trial", VISUAL),
        h("label", { class: "row wide" }, h("textarea", { class: "pp-text", rows: 4, placeholder: "Festgestellte Mängel / Bemerkungen", oninput: (e) => { p.defects = e.target.value; persist(); } }, p.defects))]),
      resultBox,
      ...section("Ausgabe", [h("div", { class: "btnrow" },
        h("button", { class: "btn", onclick: () => { flush(); exportPdf(p); } }, "PDF erstellen"),
        h("button", { class: "btn", onclick: () => { flush(); const cp = repeatOf(p), l = load(); l.push(cp); saveAll(l); location.hash = `protocol/${cp.id}`; } }, "Als Wiederholungsprüfung kopieren")),
        h("div", { class: "btnrow" }, h("a", { class: "btn", href: "#protocol", style: "text-align:center;text-decoration:none", onclick: flush }, "Alle Protokolle"),
          h("button", { class: "btn danger", onclick: () => { if (confirm("Dieses Protokoll endgültig löschen?")) { clearTimeout(timer); saveAll(load().filter((x) => x.id !== p.id)); location.hash = "protocol"; } } }, "Löschen"))],
        "„Als Wiederholungsprüfung kopieren“ übernimmt Anlage, Verteiler und Stromkreise ohne Messwerte mit heutigem Datum."),
    );
    renderResult();
    refreshLater.forEach((f) => f());
  }
  window.addEventListener("hashchange", flush, { once: true });
  render();
  return [root];
}

function repeatOf(p) {
  const cp = JSON.parse(JSON.stringify(p));
  cp.id = uid(); cp.created = new Date().toISOString();
  Object.assign(cp.head, { date: today(), next: "", kind: "Wiederholungsprüfung" });
  cp.visual = ""; cp.trial = ""; cp.defects = ""; cp.verdict = "";
  for (const b of cp.boards) { b.id = uid(); for (const c of b.circuits) Object.assign(c, { id: uid(), zs: "", riso: "", rpe: "", t: "", i: "", note: "" }); }
  return cp;
}

// ---------- PDF ----------
export function pdfDoc(p) {
  const H = p.head, lim = limitsOf(p), s = summary(p), vis = (v) => (VISUAL.find(([k]) => k === v) ?? VISUAL[2])[1];
  const lv = (v, u) => (v === null || v === undefined ? "nicht festgelegt" : `${C.fmt(v, 3)} ${u}`);
  const blocks = [
    { heading: "Anlage", rows: [["Objekt / Anlage", H.object || "–"], ["Anschrift", H.address || "–"], ["Auftraggeber", H.client || "–"], ["Netzform / U₀", `${H.net} / ${H.u0} V`]] },
    { heading: "Prüfung", rows: [["Art der Prüfung", H.kind], ["Datum", deDate(H.date)], ["Prüfer / Firma", [H.inspector, H.company].filter(Boolean).join(" · ") || "–"],
      ["Prüfgrundlage", H.basis || "–"], ["Messgerät", H.meter || "–"]] },
    { heading: "Grenzwerte (vom Prüfer festgelegt)", rows: [["Zs,max", `U₀ / Ia · ${C.fmt(lim.zsFactor, 3)} (Ia = 5/10/20 · In für B/C/D)`], ["R_iso min.", lv(lim.risoMin, "MΩ")],
      ["R_PE max.", lv(lim.rpeMax, "Ω")], ["RCD Auslösezeit max.", lv(lim.tMax, "ms")], ["RCD IΔn", lv(lim.idn, "mA")]] },
  ];
  const cols = [{ title: "Nr.", w: 3.5 }, { title: "Stromkreis", w: 14 }, { title: "Schutz- organ", w: 6 }, { title: "Leitung", w: 10.5 }, { title: "RCD", w: 8.5 },
    { title: "Zs [Ω]", w: 5.5, align: "right" }, { title: "Zs,max [Ω]", w: 6, align: "right" }, { title: "Ik [A]", w: 5.5, align: "right" }, { title: "R_iso [MΩ]", w: 6.5, align: "right" },
    { title: "R_PE [Ω]", w: 5.5, align: "right" }, { title: "Auslöse- zeit [ms]", w: 6, align: "right" }, { title: "Auslöse- strom [mA]", w: 6, align: "right" }, { title: "Bemerkung", w: 10 }, { title: "Ergebnis", w: 6, align: "center" }];
  for (const b of p.boards) {
    const bad = [], rows = b.circuits.map((c, i) => {
      const r = evalCircuit(c, lim); if (r.status === false) bad.push(i);
      return [c.nr, c.name, c.device, c.cable, c.rcd, c.zs, r.zsMax !== undefined ? fmt(r.zsMax) : "", r.ik !== undefined ? fmt(r.ik, 0) : "", c.riso, c.rpe, c.t, c.i, c.note, statusText(r)];
    });
    blocks.push({ heading: `Verteiler ${b.name}${b.location ? ` (${b.location})` : ""}`, table: { cols, rows, bad } });
  }
  blocks.push({ heading: "Besichtigen & Erproben", rows: [["Besichtigen", vis(p.visual)], ["Erproben", vis(p.trial)]] });
  if (p.defects?.trim()) blocks.push({ heading: "Mängel / Bemerkungen", text: p.defects.trim() });
  blocks.push({ heading: "Ergebnis", rows: [["Stromkreise gesamt / bewertet", `${s.total} / ${s.rated}`], ["Grenzwert verletzt", String(s.bad)],
    ["Gesamturteil", p.verdict === "ok" ? "Keine Mängel festgestellt" : p.verdict === "bad" ? "Mängel festgestellt" : "–"], ["Nächster Prüftermin", deDate(H.next) || "–"]] });
  blocks.push({ signatures: ["Ort, Datum", "Unterschrift Prüfer", "Unterschrift Auftraggeber"] });
  return { title: `Prüfprotokoll${H.object ? `: ${H.object}` : ""}`, subtitle: `${H.kind} · ${deDate(H.date)}${H.inspector ? ` · Prüfer: ${H.inspector}` : ""}`, landscape: true, blocks,
    footer: "Erstellt mit ElektroRechner (Built by R. U. Sirius?). Grenzwerte, Prüfumfang und Bewertung wurden vom Prüfer festgelegt; " +
      "das Protokoll ersetzt keine normgerechte Prüfung durch eine Elektrofachkraft. i. O. = alle bewerteten Messwerte innerhalb der Grenzwerte, n. i. O. = mindestens ein Grenzwert überschritten, – = keine Messwerte." };
}
function exportPdf(p) {
  const name = `Pruefprotokoll_${safeFilename(p.head.object || "Anlage")}_${p.head.date || today()}.pdf`;
  sharePdf(name, pdfDoc(p));
}
