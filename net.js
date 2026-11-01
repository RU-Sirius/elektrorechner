// Netzwerktechnik: IPv4/IPv6, Datenübertragung, PoE, LWL.

const fail = (m = "range") => { throw new Error(m); };

// ---------- IPv4 ----------
export function parseIPv4(str) {
  const parts = String(str).trim().split(".");
  if (parts.length !== 4) fail();
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p) || Number(p) > 255) fail();
    n = n * 256 + Number(p);
  }
  return n >>> 0;
}
export const ipv4ToString = (n) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join(".");
const maskOf = (prefix) => (prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0);

// Präfix aus "/24", "24" oder Maske "255.255.255.0".
export function parsePrefix(str) {
  const s = String(str).trim().replace(/^\//, "");
  if (/^\d{1,2}$/.test(s) && Number(s) <= 32) return Number(s);
  const m = parseIPv4(s);
  const inv = ~m >>> 0;
  if ((inv & (inv + 1)) !== 0) fail(); // Maske muss zusammenhängend sein
  return 32 - Math.log2(inv + 1);
}

// Spezielle Bereiche (RFC 1918, 6598, 1122, 3927, 5771).
const RANGES = [
  ["10.0.0.0", 8, "Privat (RFC 1918)"], ["172.16.0.0", 12, "Privat (RFC 1918)"], ["192.168.0.0", 16, "Privat (RFC 1918)"],
  ["100.64.0.0", 10, "Carrier-Grade NAT (RFC 6598)"], ["127.0.0.0", 8, "Loopback"], ["169.254.0.0", 16, "Link-Local (APIPA)"],
  ["224.0.0.0", 4, "Multicast"], ["0.0.0.0", 8, "„Dieses Netz“ (reserviert)"], ["240.0.0.0", 4, "Reserviert"],
];
export function ipv4Type(n) {
  for (const [net, p, name] of RANGES) if (((n & maskOf(p)) >>> 0) === parseIPv4(net)) return name;
  return "Öffentlich";
}

export function ipv4Info(addr, prefixStr) {
  let a = String(addr).trim(), pStr = prefixStr;
  if (a.includes("/")) [a, pStr] = a.split("/");
  const n = parseIPv4(a);
  const prefix = parsePrefix(pStr ?? "");
  const mask = maskOf(prefix);
  const net = (n & mask) >>> 0;
  const bc = (net | (~mask >>> 0)) >>> 0;
  const total = 2 ** (32 - prefix);
  // /31: Punkt-zu-Punkt (RFC 3021), beide Adressen nutzbar; /32: Einzelhost.
  const hosts = prefix === 32 ? 1 : prefix === 31 ? 2 : total - 2;
  const first = prefix >= 31 ? net : net + 1;
  const last = prefix >= 31 ? bc : bc - 1;
  return { prefix, mask: ipv4ToString(mask), wildcard: ipv4ToString(~mask >>> 0), network: ipv4ToString(net), broadcast: prefix >= 31 ? null : ipv4ToString(bc),
           first: ipv4ToString(first), last: ipv4ToString(last), hosts, total, type: ipv4Type(n), cidr: `${ipv4ToString(net)}/${prefix}` };
}

// Netz in Teilnetze aufteilen: nach Anzahl Netze oder nach Hosts pro Netz.
export function ipv4Subnets(cidr, { count = null, hosts = null }) {
  const base = ipv4Info(cidr);
  let newPrefix;
  if (count) newPrefix = base.prefix + Math.ceil(Math.log2(count));
  else if (hosts) newPrefix = 32 - Math.ceil(Math.log2(hosts + 2));
  else fail("positive");
  if (newPrefix > 32 || newPrefix < base.prefix) fail();
  const size = 2 ** (32 - newPrefix);
  const n = 2 ** (newPrefix - base.prefix);
  const start = parseIPv4(base.network);
  const list = [];
  for (let i = 0; i < Math.min(n, 256); i++) list.push(ipv4Info(ipv4ToString(start + i * size), String(newPrefix)));
  return { newPrefix, count: n, hostsEach: ipv4Info(base.network, String(newPrefix)).hosts, list, truncated: n > 256 };
}

// ---------- IPv6 ----------
export function parseIPv6(str) {
  let s = String(str).trim().toLowerCase();
  if (!/^[0-9a-f:]+$/.test(s) || (s.match(/::/g) || []).length > 1) fail();
  let groups;
  if (s.includes("::")) {
    const [l, r] = s.split("::");
    const L = l ? l.split(":") : [], R = r ? r.split(":") : [];
    if (L.length + R.length > 7) fail();
    groups = [...L, ...Array(8 - L.length - R.length).fill("0"), ...R];
  } else groups = s.split(":");
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) fail();
  return groups.reduce((acc, g) => (acc << 16n) | BigInt(parseInt(g, 16)), 0n);
}
const groupsOf = (big) => Array.from({ length: 8 }, (_, i) => Number((big >> BigInt(112 - 16 * i)) & 0xffffn));
export const ipv6Expanded = (big) => groupsOf(big).map((g) => g.toString(16).padStart(4, "0")).join(":");
// Kurzform nach RFC 5952: längste Nullfolge (≥ 2 Gruppen, bei Gleichstand die erste) wird zu „::“.
export function ipv6Compressed(big) {
  const g = groupsOf(big);
  let best = -1, bestLen = 0;
  for (let i = 0; i < 8; ) {
    if (g[i] !== 0) { i++; continue; }
    let j = i; while (j < 8 && g[j] === 0) j++;
    if (j - i > bestLen && j - i >= 2) { best = i; bestLen = j - i; }
    i = j;
  }
  const hex = g.map((x) => x.toString(16));
  if (best < 0) return hex.join(":");
  return `${hex.slice(0, best).join(":")}::${hex.slice(best + bestLen).join(":")}`;
}
export function ipv6Info(input) {
  const [a, p] = String(input).trim().split("/");
  const prefix = p === undefined ? 64 : Number(p);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 128) fail();
  const big = parseIPv6(a);
  const mask = prefix === 0 ? 0n : ((1n << 128n) - 1n) ^ ((1n << BigInt(128 - prefix)) - 1n);
  const net = big & mask;
  return { expanded: ipv6Expanded(big), compressed: ipv6Compressed(big), network: `${ipv6Compressed(net)}/${prefix}`, prefix,
           subnets64: prefix <= 64 ? 2n ** BigInt(64 - prefix) : null, addresses: 2n ** BigInt(128 - prefix),
           type: big >> 120n === 0xffn ? "Multicast" : big >> 118n === 0x3fan ? "Link-Local" : big >> 121n === 0x7en ? "Unique Local (ULA)" :
                 big === 1n ? "Loopback" : big >> 125n === 1n ? "Global Unicast" : "Sonstige/reserviert" };
}

// ---------- Datenübertragung ----------
// Größen dezimal (kB = 1000 B) bzw. binär (KiB = 1024 B); Raten in bit/s.
export const SIZE_UNITS = { B: 1, kB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12, KiB: 2 ** 10, MiB: 2 ** 20, GiB: 2 ** 30, TiB: 2 ** 40 };
export function transferTime({ bytes, rate, efficiency = 1 }) {
  if (!(bytes > 0 && rate > 0 && efficiency > 0 && efficiency <= 1)) fail("positive");
  return (bytes * 8) / (rate * efficiency);
}
export function transferRate({ bytes, seconds, efficiency = 1 }) {
  if (!(bytes > 0 && seconds > 0 && efficiency > 0 && efficiency <= 1)) fail("positive");
  return (bytes * 8) / (seconds * efficiency);
}

// ---------- PoE ----------
// Leistung am Port (PSE) und garantierte Leistung am Endgerät (PD) nach IEEE 802.3.
export const POE = [
  { id: "af", name: "802.3af (PoE, Typ 1)", pse: 15.4, pd: 12.95 },
  { id: "at", name: "802.3at (PoE+, Typ 2)", pse: 30, pd: 25.5 },
  { id: "bt3", name: "802.3bt Typ 3 (4PPoE)", pse: 60, pd: 51 },
  { id: "bt4", name: "802.3bt Typ 4 (4PPoE)", pse: 90, pd: 71.3 },
];
export function poeBudget({ devices, budget }) {
  // devices: [{ type, count, power (optional: tatsächliche Leistung je Gerät am Port) }]
  let sum = 0, ports = 0;
  for (const d of devices) {
    if (!d.count) continue;
    const t = POE.find((x) => x.id === d.type);
    sum += d.count * (d.power ?? t.pse);
    ports += d.count;
  }
  if (!(ports > 0 && budget > 0)) fail("positive");
  return { sum, ports, ok: sum <= budget, reserve: budget - sum, load: (sum / budget) * 100 };
}

// ---------- LWL-Dämpfungsbudget ----------
export function fiberBudget({ tx, rx, length, att, nConn, lossConn, nSplice, lossSplice, margin }) {
  const vals = [tx, rx, length, att, nConn, lossConn, nSplice, lossSplice, margin];
  if (vals.some((v) => v === null || !Number.isFinite(v)) || length < 0) fail("positive");
  const loss = length * att + nConn * lossConn + nSplice * lossSplice + margin;
  const available = tx - rx;
  return { loss, available, reserve: available - loss, ok: available - loss >= 0 };
}
