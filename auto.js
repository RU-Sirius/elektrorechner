// Automatisierung: Regelungstechnik und Steuerungstechnik (reine Logik, ohne Oberfläche).

const fail = (m = "positive") => { throw new Error(m); };
const pos = (...v) => { if (!v.every((x) => x !== null && x !== undefined && x > 0 && Number.isFinite(x))) fail(); };
const num = (...v) => { if (!v.every((x) => x !== null && x !== undefined && Number.isFinite(x))) fail(); };

// =================== Regelungstechnik ===================

// Ziegler-Nichols, Schwingungsversuch (kritische Verstärkung Kkrit, Periodendauer Tkrit).
export function znOscillation({ kkrit, tkrit }) {
  pos(kkrit, tkrit);
  return { P: { kp: 0.5 * kkrit }, PI: { kp: 0.45 * kkrit, tn: 0.85 * tkrit }, PID: { kp: 0.6 * kkrit, tn: 0.5 * tkrit, tv: 0.12 * tkrit } };
}
// Ziegler-Nichols, Sprungantwort (Wendetangente: Verzugszeit Tu, Ausgleichszeit Tg, Streckenverstärkung Ks).
export function znStep({ tu, tg, ks }) {
  pos(tu, tg, ks);
  const k = tg / (ks * tu);
  const ratio = tg / tu;
  return { ratio, rating: ratio > 10 ? "gut regelbar" : ratio >= 3 ? "noch regelbar" : "schwer regelbar",
           P: { kp: k }, PI: { kp: 0.9 * k, tn: 3.33 * tu }, PID: { kp: 1.2 * k, tn: 2 * tu, tv: 0.5 * tu } };
}

// PID: ideale Form (Kp, Tn, Tv) ↔ Parallelform (Kp, Ki, Kd) und Stellungsalgorithmus mit Abtastzeit Ts.
export function pidForms({ kp, tn = null, tv = null, ts = null }) {
  pos(kp);
  const ki = tn ? kp / tn : 0, kd = tv ? kp * tv : 0;
  const r = { ki, kd };
  if (ts) {
    pos(ts);
    // Geschwindigkeitsalgorithmus: Δu(k) = q0·e(k) + q1·e(k−1) + q2·e(k−2) (Rechteck-Integration)
    r.q0 = kp * (1 + (tn ? ts / tn : 0) + (tv ? tv / ts : 0));
    r.q1 = -kp * (1 + (tv ? (2 * tv) / ts : 0));
    r.q2 = tv ? (kp * tv) / ts : 0;
  }
  return r;
}
export function pidFromParallel({ kp, ki = 0, kd = 0 }) { pos(kp); return { tn: ki > 0 ? kp / ki : null, tv: kd > 0 ? kd / kp : null }; }

// Kennwerte aus einer Sprungantwort (gleichmäßig abgetastet).
export function stepMetrics(t, y, target, band = 0.02) {
  const n = y.length, yEnd = y[n - 1];
  const ref = target ?? yEnd;
  let peak = -Infinity, tPeak = 0, t10 = null, t90 = null, tSettle = 0;
  const lo = 0.1 * ref, hi = 0.9 * ref;
  for (let i = 0; i < n; i++) {
    if (y[i] > peak) { peak = y[i]; tPeak = t[i]; }
    if (t10 === null && y[i] >= lo) t10 = t[i];
    if (t90 === null && y[i] >= hi) t90 = t[i];
  }
  for (let i = n - 1; i >= 0; i--) if (Math.abs(y[i] - ref) > band * Math.abs(ref)) { tSettle = t[Math.min(i + 1, n - 1)]; break; }
  return { yEnd, overshoot: ref !== 0 ? Math.max(0, ((peak - ref) / Math.abs(ref)) * 100) : 0, tPeak, rise: t10 !== null && t90 !== null ? t90 - t10 : null,
           settle: tSettle, settled: Math.abs(yEnd - ref) <= band * Math.abs(ref) };
}

// PT2-Glied K/(1 + 2D·s/ω0 + s²/ω0²): Sprungantwort numerisch (RK4), Kennwerte.
export function pt2({ k = 1, w0, d, tEnd = null }) {
  pos(w0); num(d); if (d < 0) fail("range");
  const T = tEnd ?? Math.max(10 / (Math.max(d, 0.05) * w0), 12 / w0);
  const steps = 4000, dt = T / steps;
  let x1 = 0, x2 = 0; // x1 = y, x2 = y'
  const f = (a, b) => [b, w0 * w0 * (k - a) - 2 * d * w0 * b];
  const t = [0], y = [0];
  for (let i = 1; i <= steps; i++) {
    const k1 = f(x1, x2), k2 = f(x1 + (dt / 2) * k1[0], x2 + (dt / 2) * k1[1]);
    const k3 = f(x1 + (dt / 2) * k2[0], x2 + (dt / 2) * k2[1]), k4 = f(x1 + dt * k3[0], x2 + dt * k3[1]);
    x1 += (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]); x2 += (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    t.push(i * dt); y.push(x1);
  }
  const m = stepMetrics(t, y, k);
  const analytic = d < 1 ? { overshoot: 100 * Math.exp((-Math.PI * d) / Math.sqrt(1 - d * d)), tPeak: Math.PI / (w0 * Math.sqrt(1 - d * d)), wd: w0 * Math.sqrt(1 - d * d) } : null;
  return { t, y, ...m, analytic };
}

// Regelkreis-Simulation: Strecke Ks·e^(−s·Tt)/(1 + s·T)^n, Regler P/PI/PD/PID (ideale Form, D-Anteil gefiltert mit Tv/N).
// mode "closed": Führungssprung w = 1; "open": nur Strecke mit Stellgrößensprung u = 1.
export function simulateLoop({ ks, t1, n = 1, tt = 0, type = "PI", kp = 1, tn = null, tv = null, nFilt = 10, umin = null, umax = null, mode = "closed", tEnd = null }) {
  pos(ks, t1); num(tt); if (tt < 0 || n < 1 || n > 8) fail("range");
  if (mode === "closed") { pos(kp); if (type.includes("I")) pos(tn); if (type.includes("D")) pos(tv); }
  const T = tEnd ?? Math.max(8 * (n * t1 + tt) + (tn ?? 0) * 3, 1e-6);
  const dtMin = Math.min(t1, tn ?? Infinity, tv ? tv / nFilt : Infinity, tt > 0 ? tt : Infinity) / 40;
  const steps = Math.min(Math.max(Math.ceil(T / dtMin), 2000), 60000);
  const dt = T / steps;
  const x = new Array(n).fill(0);
  const delay = new Array(Math.max(1, Math.round(tt / dt)) + 1).fill(0);
  let di = 0, iState = 0, dState = 0;
  const t = [0], y = [0], u = [0], w = [mode === "closed" ? 1 : 0];
  const deriv = (xs, uIn) => xs.map((xi, i) => ((i === 0 ? ks * uIn : xs[i - 1]) - xi) / t1);
  for (let k = 1; k <= steps; k++) {
    const yk = x[n - 1];
    let uk;
    if (mode === "open") uk = 1;
    else {
      const e = 1 - yk;
      const hasI = type.includes("I"), hasD = type.includes("D");
      // D-Anteil: Kp·Tv·s/(1 + s·Tv/N), als Zustand dState
      let dPart = 0;
      if (hasD) { const tf = tv / nFilt; dPart = (kp * tv * e - dState) / tf; }
      let uRaw = kp * e + (hasI ? iState : 0) + dPart;
      let sat = false;
      if (umax !== null && uRaw > umax) { uRaw = umax; sat = true; }
      if (umin !== null && uRaw < umin) { uRaw = umin; sat = true; }
      // Anti-Windup: Integrator anhalten, solange die Stellgröße begrenzt ist
      if (hasI && !sat) iState += ((kp / tn) * e) * dt;
      if (hasD) { const tf = tv / nFilt; dState += ((kp * tv * e - dState) / tf) * dt; }
      uk = uRaw;
    }
    // Totzeit: Ringpuffer
    delay[di] = uk; di = (di + 1) % delay.length;
    const ud = tt > 0 ? delay[di] : uk;
    // RK4 für die PT1-Kette bei konstantem Eingang ud
    const k1 = deriv(x, ud), k2 = deriv(x.map((v, i) => v + (dt / 2) * k1[i]), ud);
    const k3 = deriv(x.map((v, i) => v + (dt / 2) * k2[i]), ud), k4 = deriv(x.map((v, i) => v + dt * k3[i]), ud);
    for (let i = 0; i < n; i++) x[i] += (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    t.push(k * dt); y.push(x[n - 1]); u.push(uk); w.push(mode === "closed" ? 1 : 0);
  }
  return { t, y, u, w, ...stepMetrics(t, y, mode === "closed" ? 1 : ks) };
}

// Frequenzgang des offenen Kreises L = C·G und Stabilitätsreserven.
export function openLoopBode({ ks, t1, n = 1, tt = 0, type = "PI", kp = 1, tn = null, tv = null, nFilt = 10, wMin = null, wMax = null, points = 400 }) {
  pos(ks, t1, kp); num(tt);
  const hasI = type.includes("I"), hasD = type.includes("D");
  if (hasI) pos(tn); if (hasD) pos(tv);
  const lo = wMin ?? 0.01 / Math.max(t1, tn ?? 0, tt);
  // Bei Totzeit obere Grenze so wählen, dass die Totzeitphase höchstens ca. −570° erreicht (sonst unlesbares Diagramm)
  const hi = wMax ?? Math.min(100 / Math.min(t1, tv ? tv / nFilt : Infinity), tt > 0 ? 10 / tt : Infinity);
  const ws = [], mag = [], ph = [];
  for (let i = 0; i < points; i++) {
    const wv = lo * (hi / lo) ** (i / (points - 1));
    // Regler C(jω) = Kp·(1 + 1/(jωTn) + jωTv/(1 + jωTv/N))
    let re = 1, im = 0;
    if (hasI) im += -1 / (wv * tn);
    if (hasD) { const a = wv * tv, b = (wv * tv) / nFilt, den = 1 + b * b; re += (a * b) / den; im += a / den; }
    re *= kp; im *= kp;
    const cMag = Math.hypot(re, im), cPh = Math.atan2(im, re);
    const gMag = ks / (1 + (wv * t1) ** 2) ** (n / 2), gPh = -n * Math.atan(wv * t1) - wv * tt;
    ws.push(wv); mag.push(20 * Math.log10(cMag * gMag)); ph.push(((cPh + gPh) * 180) / Math.PI);
  }
  // Durchtrittsfrequenz (|L| = 0 dB) und Phasenreserve; Phasenschnitt (−180°) und Amplitudenreserve
  let wc = null, pm = null, w180 = null, gm = null;
  for (let i = 1; i < points; i++) {
    if (wc === null && mag[i - 1] >= 0 && mag[i] < 0) { const f = mag[i - 1] / (mag[i - 1] - mag[i]); wc = ws[i - 1] * (ws[i] / ws[i - 1]) ** f; pm = 180 + ph[i - 1] + f * (ph[i] - ph[i - 1]); }
    if (w180 === null && ph[i - 1] > -180 && ph[i] <= -180) { const f = (ph[i - 1] + 180) / (ph[i - 1] - ph[i]); w180 = ws[i - 1] * (ws[i] / ws[i - 1]) ** f; gm = -(mag[i - 1] + f * (mag[i] - mag[i - 1])); }
  }
  return { ws, mag, ph, wc, pm, w180, gm };
}

// =================== Steuerungstechnik ===================

// Analogwerte: Signal ↔ physikalischer Wert ↔ Rohwert, linear.
export const SIGNALS = {
  "4-20mA": { name: "4 … 20 mA", lo: 4, hi: 20, unit: "mA" },
  "0-20mA": { name: "0 … 20 mA", lo: 0, hi: 20, unit: "mA" },
  "0-10V": { name: "0 … 10 V", lo: 0, hi: 10, unit: "V" },
  "pm10V": { name: "−10 … +10 V", lo: -10, hi: 10, unit: "V" },
};
export function analogScale({ signal, from, value, pMin, pMax, rMin, rMax }) {
  num(value, pMin, pMax, rMin, rMax);
  if (pMax === pMin || rMax === rMin) fail("range");
  const s = SIGNALS[signal];
  const frac = from === "signal" ? (value - s.lo) / (s.hi - s.lo) : from === "phys" ? (value - pMin) / (pMax - pMin) : (value - rMin) / (rMax - rMin);
  return { frac, signal: s.lo + frac * (s.hi - s.lo), phys: pMin + frac * (pMax - pMin), raw: rMin + frac * (rMax - rMin), outOfRange: frac < 0 || frac > 1 };
}
// Maximale Bürde einer 4–20-mA-Schleife: (Versorgung − Mindestspannung Messumformer) / 20 mA.
export function loopBurden({ supply, uMin, iMax = 0.02 }) { pos(supply, iMax); num(uMin); if (uMin >= supply) fail("range"); return (supply - uMin) / iMax; }

// Zahlensysteme für eine Bitbreite (8/16/32). Eingabe: Text mit Basis.
export function parseInt2(text, base) {
  const s = String(text).trim().replace(/[\s_]/g, "").replace(/^0x/i, "").replace(/^0b/i, "").replace(/^16#/, "").replace(/^2#/, "");
  if (s === "") fail();
  const re = { 2: /^[01]+$/, 10: /^-?\d+$/, 16: /^[0-9a-f]+$/i }[base];
  if (!re.test(s)) fail("range");
  return BigInt(base === 10 ? s : (base === 16 ? "0x" : "0b") + s);
}
export function numberSystems({ text, base, bits }) {
  if (![8, 16, 32].includes(bits)) fail("range");
  const v = parseInt2(text, base);
  const mod = 1n << BigInt(bits), min = -(mod >> 1n);
  if (v >= mod || v < min) fail("range");
  const u = ((v % mod) + mod) % mod;
  const signed = u >= mod >> 1n ? u - mod : u;
  const bin = u.toString(2).padStart(bits, "0");
  const gray = u ^ (u >> 1n);
  // BCD nur, wenn alle Hex-Ziffern 0–9 sind bzw. der Dezimalwert in die Breite passt
  const hex = u.toString(16).toUpperCase().padStart(bits / 4, "0");
  const bcdDecoded = /^[0-9]+$/.test(hex) ? Number(hex) : null;
  const bcdEncoded = u < 10n ** BigInt(bits / 4) ? BigInt("0x" + u.toString(10)) : null;
  return { unsigned: u, signed, hex, bin: bin.replace(/(.{4})(?=.)/g, "$1 "), gray: gray.toString(2).padStart(bits, "0").replace(/(.{4})(?=.)/g, "$1 "),
           bcdDecoded, bcdEncoded: bcdEncoded !== null ? bcdEncoded.toString(16).toUpperCase().padStart(bits / 4, "0") : null };
}
// IEEE 754 einfache Genauigkeit (REAL).
export function realToHex(x) { num(x); const b = new DataView(new ArrayBuffer(4)); b.setFloat32(0, x); return b.getUint32(0).toString(16).toUpperCase().padStart(8, "0"); }
export function hexToReal(h) {
  const s = String(h).trim().replace(/^0x/i, "").replace(/^16#/, "").replace(/\s/g, "");
  if (!/^[0-9a-f]{1,8}$/i.test(s)) fail("range");
  const b = new DataView(new ArrayBuffer(4)); b.setUint32(0, parseInt(s, 16)); return b.getFloat32(0);
}

// Logik: Ausdruck parsen (& | ! ^, UND/ODER/NICHT/XOR, Klammern), Wahrheitstabelle, Minimierung (Quine-McCluskey).
export function parseLogic(src) {
  const s = String(src).toUpperCase().replace(/\bUND\b|\bAND\b|∧|·|\*/g, "&").replace(/\bODER\b|\bOR\b|∨|\+/g, "|")
    .replace(/\bNICHT\b|\bNOT\b|¬|~/g, "!").replace(/\bXOR\b|⊕/g, "^");
  const toks = s.match(/[A-Z][A-Z0-9]*|[01]|[&|!^()]/g) ?? [];
  if (toks.join("") !== s.replace(/\s+/g, "")) fail("range");
  let i = 0;
  const vars = new Set();
  const peek = () => toks[i], eat = (t) => { if (toks[i] !== t) fail("range"); i++; };
  const prim = () => {
    const t = toks[i++];
    if (t === "!") { const a = prim(); return (e) => !a(e); }
    if (t === "(") { const a = orE(); eat(")"); return a; }
    if (t === "0" || t === "1") return () => t === "1";
    if (t && /^[A-Z]/.test(t)) { vars.add(t); return (e) => e[t]; }
    fail("range");
  };
  const andE = () => { let a = prim(); while (peek() === "&" || (peek() && /^[A-Z!(01]/.test(peek()))) { if (peek() === "&") i++; const l = a, r = prim(); a = (e) => l(e) && r(e); } return a; };
  const xorE = () => { let a = andE(); while (peek() === "^") { i++; const l = a, r = andE(); a = (e) => l(e) !== r(e); } return a; };
  const orE = () => { let a = xorE(); while (peek() === "|") { i++; const l = a, r = xorE(); a = (e) => l(e) || r(e); } return a; };
  if (!toks.length) fail();
  const f = orE();
  if (i !== toks.length) fail("range");
  const names = [...vars].sort();
  if (names.length > 8) fail("range");
  return { f, vars: names };
}
export function truthTable(src) {
  const { f, vars } = parseLogic(src);
  const rows = [];
  for (let m = 0; m < 1 << vars.length; m++) {
    const env = {};
    vars.forEach((v, k) => { env[v] = !!((m >> (vars.length - 1 - k)) & 1); });
    rows.push({ m, inputs: vars.map((v) => (env[v] ? 1 : 0)), out: f(env) ? 1 : 0 });
  }
  return { vars, rows, minterms: rows.filter((r) => r.out).map((r) => r.m) };
}
// Quine-McCluskey mit Abdeckung (wesentliche Primimplikanten, danach greedy).
export function minimize(vars, minterms) {
  const n = vars.length;
  if (!minterms.length) return "0";
  if (minterms.length === 1 << n) return "1";
  let groups = minterms.map((m) => ({ bits: m.toString(2).padStart(n, "0"), cover: [m] }));
  const primes = [];
  while (groups.length) {
    const next = new Map(), used = new Set();
    for (let a = 0; a < groups.length; a++) for (let b = a + 1; b < groups.length; b++) {
      const x = groups[a].bits, y = groups[b].bits;
      let diff = -1, cnt = 0;
      for (let k = 0; k < n; k++) if (x[k] !== y[k]) { cnt++; diff = k; }
      if (cnt === 1 && x[diff] !== "-" && y[diff] !== "-") {
        const bits = x.slice(0, diff) + "-" + x.slice(diff + 1);
        used.add(a); used.add(b);
        if (!next.has(bits)) next.set(bits, { bits, cover: [...new Set([...groups[a].cover, ...groups[b].cover])] });
      }
    }
    groups.forEach((g, k) => { if (!used.has(k) && !primes.some((p) => p.bits === g.bits)) primes.push(g); });
    groups = [...next.values()];
  }
  const remaining = new Set(minterms), chosen = [];
  for (const m of minterms) { const cov = primes.filter((p) => p.cover.includes(m)); if (cov.length === 1 && !chosen.includes(cov[0])) chosen.push(cov[0]); }
  chosen.forEach((p) => p.cover.forEach((m) => remaining.delete(m)));
  while (remaining.size) {
    const best = primes.reduce((a, p) => { const c = p.cover.filter((m) => remaining.has(m)).length; return c > a.c || (c === a.c && c > 0 && p.bits.split("-").length > a.p.bits.split("-").length) ? { p, c } : a; }, { p: null, c: 0 }).p;
    chosen.push(best); best.cover.forEach((m) => remaining.delete(m));
  }
  // kurze Terme zuerst, dann alphabetisch – besser lesbar
  chosen.sort((a, b) => (n - a.bits.split("-").length) - (n - b.bits.split("-").length) || a.bits.localeCompare(b.bits) * -1);
  return chosen.map((p) => { const lits = [...p.bits].map((b, k) => (b === "-" ? null : b === "1" ? vars[k] : "!" + vars[k])).filter(Boolean); return lits.length > 1 ? lits.join("&") : lits[0]; })
    .join(" | ");
}

// Inkrementalgeber: Impulse/Umdrehung, Drehzahl, Auswertung (1/2/4-fach).
export function encoder({ ppr, rpm = null, freq = null, factor = 1, lead = null }) {
  pos(ppr, factor);
  if (rpm === null && freq === null) fail();
  const n = rpm !== null ? rpm : (freq * 60) / ppr;
  const f = (n * ppr) / 60;
  return { rpm: n, freq: f, edges: f * factor, resolutionDeg: 360 / (ppr * factor), mmPerCount: lead ? lead / (ppr * factor) : null };
}
// Frequenzumrichter / Asynchronmotor: Synchrondrehzahl, Schlupf, U/f-Kennlinie (linear bis Nennfrequenz).
export function vfd({ f, p, slip = 0, un = null, fn = null, boost = 0 }) {
  pos(f, p); num(slip);
  const nSync = (60 * f) / p;
  const r = { nSync, n: nSync * (1 - slip / 100) };
  if (un && fn) { pos(un, fn); r.u = Math.min(un, boost + ((un - boost) * f) / fn); }
  return r;
}
export function slipFromNameplate({ f, p, nRated }) { pos(f, p, nRated); const ns = (60 * f) / p; return { nSync: ns, slip: ((ns - nRated) / ns) * 100 }; }

// Pt100/Pt1000 nach IEC 60751 (Callendar-Van Dusen), gültig −200 … 850 °C.
const CVD = { A: 3.9083e-3, B: -5.775e-7, C: -4.183e-12 };
export function rtdResistance(t, r0 = 100) {
  num(t, r0); if (t < -200 || t > 850) fail("range");
  return r0 * (1 + CVD.A * t + CVD.B * t * t + (t < 0 ? CVD.C * (t - 100) * t ** 3 : 0));
}
export function rtdTemperature(r, r0 = 100) {
  pos(r, r0);
  if (r >= r0) {
    const t = (-CVD.A + Math.sqrt(CVD.A ** 2 - 4 * CVD.B * (1 - r / r0))) / (2 * CVD.B);
    if (t > 850) fail("range"); return t;
  }
  let t = (r / r0 - 1) / CVD.A; // Startwert, dann Newton
  for (let k = 0; k < 50; k++) {
    const fx = rtdResistance(Math.max(t, -200), r0) - r;
    const d = r0 * (CVD.A + 2 * CVD.B * t + CVD.C * (4 * t ** 3 - 300 * t ** 2));
    const nt = t - fx / d; if (Math.abs(nt - t) < 1e-10) { t = nt; break; } t = nt;
  }
  if (t < -200) fail("range");
  return t;
}
