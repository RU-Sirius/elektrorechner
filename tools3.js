// Netzwerktechnik
import * as C from "./calc.js";
import * as N from "./net.js";
import { calcView, section, segmented, selectRow, resultRow, msgRow, PREFIX_HINT } from "./ui.js";

const big = (n) => n.toLocaleString("de-DE");
const dur = (s) => {
  if (s < 1) return `${C.fmt(s * 1000, 1)} ms`;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return [h ? `${h} h` : "", m ? `${m} min` : "", `${C.fmt(sec, sec < 10 ? 1 : 0)} s`].filter(Boolean).join(" ");
};

export function ipv4() {
  return calcView({
    init: { ip: "192.168.10.77", prefix: "26" },
    inputs: (s, { field }) => [...section("Adresse", [field("ip", "IPv4-Adresse (auch a.b.c.d/nn)", ""), field("prefix", "Präfix oder Maske", "")])],
    compute: (s) => {
      const r = N.ipv4Info(s.ip, s.ip.includes("/") ? undefined : s.prefix);
      return [resultRow("Netz", r.cidr), resultRow("Subnetzmaske", r.mask), resultRow("Wildcard-Maske", r.wildcard),
              r.broadcast ? resultRow("Broadcast", r.broadcast) : null, resultRow("Erste nutzbare Adresse", r.first),
              resultRow("Letzte nutzbare Adresse", r.last), resultRow("Nutzbare Hosts", big(r.hosts), "good"),
              resultRow("Adressen gesamt", big(r.total)), resultRow("Adressbereich", r.type)];
    },
    rangeMsg: "Ungültige Eingabe. Beispiel: 192.168.1.10 und 24 oder 255.255.255.0.",
    footer: "/31 wird als Punkt-zu-Punkt-Netz mit zwei nutzbaren Adressen behandelt (RFC 3021), /32 als Einzelhost.",
  });
}

export function ipv4Subnetting() {
  return calcView({
    init: { net: "10.0.0.0/24", mode: "count", count: "5", hosts: "30" },
    inputs: (s, { field, set }) => [
      ...section("Ausgangsnetz", [field("net", "Netz (a.b.c.d/nn)", "")]),
      ...section("Aufteilen nach", [segmented([["count", "Anzahl Netze"], ["hosts", "Hosts pro Netz"]], s.mode, (v) => set("mode", v)),
        s.mode === "count" ? field("count", "Benötigte Netze", "") : field("hosts", "Benötigte Hosts je Netz", "")]),
    ],
    compute: (s, p) => {
      const r = N.ipv4Subnets(s.net, s.mode === "count" ? { count: Math.round(p(s.count) ?? 0) } : { hosts: Math.round(p(s.hosts) ?? 0) });
      return [resultRow("Neues Präfix", `/${r.newPrefix} (${N.ipv4Info("0.0.0.0", String(r.newPrefix)).mask})`, "good"),
              resultRow("Anzahl Teilnetze", big(r.count)), resultRow("Nutzbare Hosts je Netz", big(r.hostsEach)),
              ...r.list.map((n) => resultRow(n.cidr, `${n.first} – ${n.last}`)),
              r.truncated ? msgRow("Nur die ersten 256 Teilnetze werden angezeigt.") : null];
    },
    rangeMsg: "Ungültige Eingabe oder das Netz ist dafür zu klein.",
  });
}

export function ipv6() {
  return calcView({
    init: { ip: "2001:db8:abcd:12::1/48" },
    inputs: (s, { field }) => [...section("Adresse", [field("ip", "IPv6-Adresse/Präfix", "")])],
    compute: (s) => {
      const r = N.ipv6Info(s.ip);
      return [resultRow("Kurzform", r.compressed), msgRow(`Ausgeschrieben: ${r.expanded}`), resultRow("Netz", r.network, "good"),
              r.subnets64 !== null ? resultRow("Anzahl /64-Netze", r.subnets64.toLocaleString("de-DE")) : null,
              resultRow("Adressen", r.prefix >= 64 ? r.addresses.toLocaleString("de-DE") : `2^${128 - r.prefix}`), resultRow("Adresstyp", r.type)];
    },
    rangeMsg: "Ungültige IPv6-Adresse. Beispiel: 2001:db8::1/64",
    footer: "Kurzform nach RFC 5952. Ohne Präfixangabe wird /64 angenommen.",
  });
}

export function transfer() {
  const units = Object.keys(N.SIZE_UNITS).map((u) => [u, u]);
  return calcView({
    init: { mode: "time", size: "50", unit: "GB", rate: "100M", seconds: "600", eff: "90" },
    inputs: (s, { field, set }) => [
      ...section("Berechnung", [segmented([["time", "Dauer"], ["rate", "Benötigte Bandbreite"]], s.mode, (v) => set("mode", v))]),
      ...section("Werte", [field("size", "Datenmenge", ""), selectRow("Einheit", units, s.unit, (e) => set("unit", e.target.value)),
        s.mode === "time" ? field("rate", "Bandbreite", "bit/s") : field("seconds", "Gewünschte Dauer", "s"), field("eff", "Nutzanteil (Protokoll-Overhead)", "%")]),
    ],
    compute: (s, p) => {
      const bytes = (p(s.size) ?? 0) * N.SIZE_UNITS[s.unit], eff = (p(s.eff) ?? 100) / 100;
      if (s.mode === "time") {
        const t = N.transferTime({ bytes, rate: p(s.rate), efficiency: eff });
        return [resultRow("Übertragungsdauer", dur(t), "good"), resultRow("Effektive Datenrate", `${C.si((p(s.rate) * eff) / 8, "B/s")}`)];
      }
      const r = N.transferRate({ bytes, seconds: p(s.seconds), efficiency: eff });
      return [resultRow("Benötigte Bandbreite", C.si(r, "bit/s"), "good")];
    },
    footer: "Bandbreite in bit/s mit Präfix eingeben, z. B. 100M = 100 Mbit/s, 1G = 1 Gbit/s. kB/MB/GB dezimal (1000), KiB/MiB/GiB binär (1024). " +
            "Der Nutzanteil berücksichtigt Protokoll-Overhead pauschal (Annahme).",
  });
}

export function poe() {
  return calcView({
    init: { budget: "370", af: "4", at: "8", bt3: "0", bt4: "0", paf: "", pat: "", pbt3: "", pbt4: "" },
    inputs: (s, { field }) => [
      ...section("Switch", [field("budget", "PoE-Gesamtbudget", "W")]),
      ...section("Endgeräte (Anzahl)", N.POE.map((t) => field(t.id, t.name, "Stk."))),
      ...section("Tatsächliche Leistung je Gerät (optional)", N.POE.map((t) => field("p" + t.id, `${t.name}`, "W"))),
    ],
    compute: (s, p) => {
      const r = N.poeBudget({ budget: p(s.budget), devices: N.POE.map((t) => ({ type: t.id, count: Math.round(p(s[t.id]) ?? 0), power: p(s["p" + t.id]) })) });
      return [resultRow("PoE-Ports", String(r.ports)), resultRow("Leistungsbedarf", `${C.fmt(r.sum, 1)} W`),
              resultRow("Auslastung", `${C.fmt(r.load, 0)} %`, r.ok ? "good" : "bad"), resultRow("Reserve", `${C.fmt(r.reserve, 1)} W`, r.ok ? "good" : "bad")];
    },
    footer: "Ohne Angabe wird die maximale Port-Leistung (PSE) der Klasse angesetzt: af 15,4 W · at 30 W · bt Typ 3 60 W · bt Typ 4 90 W (IEEE 802.3). " +
            "Viele Switches teilen Leistung dynamisch zu – maßgeblich sind die Herstellerangaben.",
  });
}

export function fiber() {
  return calcView({
    init: { tx: "-3", rx: "-28", length: "2", att: "0,35", nConn: "2", lossConn: "0,75", nSplice: "4", lossSplice: "0,1", margin: "3" },
    inputs: (s, { field }) => [
      ...section("Transceiver (Datenblatt)", [field("tx", "Sendeleistung (min.)", "dBm"), field("rx", "Empfindlichkeit", "dBm")]),
      ...section("Strecke", [field("length", "Länge", "km"), field("att", "Faserdämpfung", "dB/km"), field("nConn", "Steckverbindungen", "Stk."),
        field("lossConn", "Dämpfung je Steckverbindung", "dB"), field("nSplice", "Spleiße", "Stk."), field("lossSplice", "Dämpfung je Spleiß", "dB"),
        field("margin", "Systemreserve", "dB")]),
    ],
    compute: (s, p) => {
      const r = N.fiberBudget({ tx: p(s.tx), rx: p(s.rx), length: p(s.length), att: p(s.att), nConn: p(s.nConn), lossConn: p(s.lossConn),
                                nSplice: p(s.nSplice), lossSplice: p(s.lossSplice), margin: p(s.margin) });
      return [resultRow("Verfügbares Budget", `${C.fmt(r.available, 2)} dB`), resultRow("Streckendämpfung inkl. Reserve", `${C.fmt(r.loss, 2)} dB`),
              resultRow("Verbleibende Reserve", `${C.fmt(r.reserve, 2)} dB`, r.ok ? "good" : "bad")];
    },
    footer: "Alle Werte sind Beispiele: Dämpfungswerte aus Kabel- und Komponentendatenblättern bzw. Planungsvorgaben einsetzen. " +
            "Die maximale Empfangsleistung (Übersteuerung bei kurzen Strecken) ist nicht geprüft.",
  });
}

export function networkTables() {
  const tbl = (title, rows, footer) => section(title, rows.map(([a, b]) => resultRow(a, b)), footer);
  return [
    ...tbl("Kupfer-Datenkabel: Kategorie → Bandbreite", [["Cat 5e", "100 MHz"], ["Cat 6", "250 MHz"], ["Cat 6A", "500 MHz"], ["Cat 7", "600 MHz"], ["Cat 7A", "1000 MHz"], ["Cat 8", "2000 MHz"]],
      "Kategorien nach TIA-568 bzw. Klassen nach ISO/IEC 11801 (Cat 7/7A nur ISO)."),
    ...tbl("Twisted-Pair-Ethernet: max. Länge", [["Übertragungsstrecke (Channel)", "100 m"], ["davon fest verlegt (Permanent Link)", "90 m"], ["Patchkabel gesamt", "10 m"]],
      "Gilt für 10BASE-T bis 10GBASE-T mit passender Kategorie; 25G/40GBASE-T (Cat 8) nur bis 30 m."),
    ...tbl("PoE nach IEEE 802.3 (PSE / PD)", N.POE.map((t) => [t.name, `${C.fmt(t.pse, 1)} W / ${C.fmt(t.pd, 2)} W`]),
      "PSE: Leistung am Switch-Port, PD: garantierte Leistung am Endgerät."),
    ...tbl("Private IPv4-Bereiche (RFC 1918)", [["10.0.0.0/8", "10.0.0.0 – 10.255.255.255"], ["172.16.0.0/12", "172.16.0.0 – 172.31.255.255"], ["192.168.0.0/16", "192.168.0.0 – 192.168.255.255"]]),
    ...tbl("Gebräuchliche IPv4-Präfixe", [16, 20, 22, 23, 24, 25, 26, 27, 28, 29, 30].map((p) => [`/${p}`, `${N.ipv4Info("0.0.0.0", String(p)).mask} · ${big(N.ipv4Info("0.0.0.0", String(p)).hosts)} Hosts`])),
  ];
}
