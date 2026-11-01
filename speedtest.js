// Netzwerk-Speedtest gegen die eigene Seite (GitHub Pages / CDN).
// Misst Ping, Jitter und Download. Ein Upload-Test ist ohne eigenen Server nicht möglich.
import { h, section, resultRow, msgRow, selectRow } from "./ui.js";
import { fmt } from "./calc.js";

const BASE = new URL("speedtest/", location.href).href;
const bust = () => `?r=${Math.random().toString(36).slice(2)}`;
const now = () => performance.now();

// --- Messfunktionen (auch einzeln testbar) ---

// Ping: n kurze Anfragen nacheinander; die erste (Verbindungsaufbau) wird verworfen.
export async function measurePing(n = 11, base = BASE) {
  const times = [];
  for (let i = 0; i < n; i++) {
    const t0 = now();
    const r = await fetch(base + "ping.txt" + bust(), { cache: "no-store" });
    await r.arrayBuffer();
    times.push(now() - t0);
  }
  const t = times.slice(1);
  const sorted = [...t].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const jitter = t.slice(1).reduce((a, x, i) => a + Math.abs(x - t[i]), 0) / (t.length - 1);
  return { min: sorted[0], median, jitter };
}

// Download: mehrere parallele Ströme laden die Testdatei wiederholt, bis Zeit- oder Volumengrenze erreicht ist.
// Gemessen wird nach einer kurzen Anlaufphase (TCP-Slow-Start), Fortschritt per onProgress(mbit, bytes).
export async function measureDownload({ seconds = 8, maxBytes = 100e6, streams = 4, file = "10MB.bin", warmup = 1, onProgress, base = BASE, signal } = {}) {
  let bytes = 0, bytesAfterWarmup = 0, stop = false;
  const t0 = now();
  let tWarm = null;
  const tick = setInterval(() => {
    const el = (now() - t0) / 1000;
    if (el >= warmup && tWarm === null) { tWarm = now(); bytesAfterWarmup = bytes; }
    if (onProgress && tWarm !== null) onProgress(((bytes - bytesAfterWarmup) * 8) / ((now() - tWarm) / 1000) / 1e6, bytes);
    if (el >= seconds || bytes >= maxBytes || signal?.aborted) stop = true;
  }, 100);
  const worker = async () => {
    while (!stop) {
      const r = await fetch(base + file + bust(), { cache: "no-store", signal });
      const reader = r.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (stop) { await reader.cancel(); break; }
      }
    }
  };
  try { await Promise.all(Array.from({ length: streams }, worker)); }
  finally { clearInterval(tick); }
  const tEnd = now();
  // Bei sehr kurzen Messungen (Grenze vor Ende der Anlaufphase) über die Gesamtzeit rechnen.
  const useWarm = tWarm !== null && tEnd - tWarm > 300;
  const b = useWarm ? bytes - bytesAfterWarmup : bytes;
  const sec = ((useWarm ? tEnd - tWarm : tEnd - t0) / 1000);
  return { mbit: (b * 8) / sec / 1e6, bytes, seconds: (tEnd - t0) / 1000 };
}

// --- Ansicht ---

export function speedtestView() {
  let limit = localStorage.getItem("speedLimit") || "100";
  const live = h("div", { class: "speed-live" }, h("div", { class: "speed-num" }, "–"), h("div", { class: "speed-unit" }, "Mbit/s"));
  const status = h("div", { class: "row" }, h("span", { class: "hint" }, "Bereit."));
  const resultBox = h("div");
  const btn = h("button", { class: "btn", style: "width:100%" }, "Test starten");
  const setStatus = (t, cls = "hint") => status.replaceChildren(h("span", { class: cls }, t));
  const setLive = (v) => { live.firstChild.textContent = v === null ? "–" : fmt(v, v < 10 ? 2 : 1); };

  btn.onclick = async () => {
    btn.disabled = true; btn.textContent = "Test läuft …"; resultBox.replaceChildren(); setLive(null);
    try {
      setStatus("Messe Ping …");
      const ping = await measurePing();
      setStatus("Messe Download …");
      const dl = await measureDownload({ maxBytes: Number(limit) * 1e6, onProgress: (m) => setLive(m) });
      setLive(dl.mbit);
      setStatus("Fertig.", "value good");
      const conn = navigator.connection;
      resultBox.replaceChildren(...section("Ergebnis", [
        resultRow("Download", `${fmt(dl.mbit, dl.mbit < 10 ? 2 : 1)} Mbit/s`, "good"),
        resultRow("Ping (Median)", `${fmt(ping.median, 0)} ms`),
        resultRow("Ping (Minimum)", `${fmt(ping.min, 0)} ms`),
        resultRow("Jitter", `${fmt(ping.jitter, 1)} ms`),
        resultRow("Übertragene Datenmenge", `${fmt(dl.bytes / 1e6, 1)} MB`),
        resultRow("Messdauer", `${fmt(dl.seconds, 1)} s`),
        conn?.effectiveType ? resultRow("Verbindungstyp (Browser)", conn.effectiveType) : null,
        resultRow("Zeitpunkt", new Date().toLocaleString("de-DE")),
      ].filter(Boolean)));
    } catch (e) {
      setStatus(`Test fehlgeschlagen: ${navigator.onLine ? e.message : "keine Internetverbindung"}`, "error");
    } finally {
      btn.disabled = false; btn.textContent = "Erneut testen";
    }
  };

  return [
    h("div", { class: "group", style: "margin-top:16px" }, live, status, h("div", { class: "btnrow" }, btn)),
    ...section("Einstellungen", [selectRow("Max. Datenvolumen je Test", [["25", "25 MB"], ["50", "50 MB"], ["100", "100 MB"], ["250", "250 MB"]], limit,
      (e) => { limit = e.target.value; localStorage.setItem("speedLimit", limit); })]),
    resultBox,
    h("div", { class: "footer" },
      "Gemessen wird gegen das Auslieferungsnetz von GitHub Pages, auf dem diese App liegt – nicht gegen einen Speedtest-Server deines Providers. " +
      "Das Ergebnis kann daher von anderen Speedtests abweichen. Ping und Jitter enthalten den Aufwand einer HTTP-Anfrage und liegen über einem reinen ICMP-Ping. " +
      "Ein Upload-Test ist ohne eigenen Server nicht möglich. Achtung bei mobilen Daten: Der Test verbraucht bis zur eingestellten Menge Datenvolumen. " +
      "Es werden keine Daten an Dritte gesendet."),
  ];
}
