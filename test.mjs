// node test.mjs – gleiche Referenzwerte wie die Swift-Tests (mit Python nachgerechnet).
import assert from "node:assert/strict";
import * as c from "./calc.js";
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

let r = c.ohm({ u: 230, i: 10 }); near(r.r, 23); near(r.p, 2300);
r = c.ohm({ r: 50, p: 200 }); near(r.u, 100); near(r.i, 2);
for (const inp of [{ u: 12, i: 0.5 }, { u: 12, r: 24 }, { u: 12, p: 6 }, { i: 0.5, r: 24 }, { i: 0.5, p: 6 }, { r: 24, p: 6 }]) {
  const x = c.ohm(inp); near(x.u, 12); near(x.i, 0.5); near(x.r, 24); near(x.p, 6);
}
assert.throws(() => c.ohm({ u: 1 })); assert.throws(() => c.ohm({ u: 0, i: 1 }));

r = c.voltageDrop({ system: "ac1", length: 20, current: 16, section: 1.5, voltage: 230, cos: 1, kappa: 56 });
near(r.drop, 7.619047619047619); near(r.percent, 3.312629399585921); near(r.loss, 121.9047619047619);
r = c.voltageDrop({ system: "ac3", length: 50, current: 32, section: 6, voltage: 400, cos: 0.9, kappa: 56 });
near(r.drop, 7.423074889580902); near(r.percent, 1.8557687223952255); near(r.loss, 457.1428571428571);
r = c.voltageDrop({ system: "dc", length: 10, current: 10, section: 2.5, voltage: 12, cos: 0.5, kappa: 56 });
near(r.drop, 1.4285714285714284);
assert.throws(() => c.voltageDrop({ system: "ac1", length: 1, current: 1, section: 1, voltage: 230, cos: 1.2, kappa: 56 }));

r = c.minSection({ system: "ac1", length: 30, current: 16, voltage: 230, maxPercent: 3, cos: 1, kappa: 56 });
near(r.required, 2.4844720496894412); assert.equal(r.standard, 2.5);
r = c.minSection({ system: "ac3", length: 100, current: 63, voltage: 400, maxPercent: 3, cos: 0.85, kappa: 56 });
near(r.required, 13.80227987281449); assert.equal(r.standard, 16);
r = c.minSection({ system: "ac1", length: 1000, current: 400, voltage: 230, maxPercent: 1, cos: 1, kappa: 56 });
assert.equal(r.standard, null);

near(c.resistor(["yellow", "violet"], "red"), 4700);
near(c.resistor(["brown", "black", "black"], "red"), 10000);
near(c.resistor(["red", "red"], "gold"), 2.2, 1e-12);
assert.throws(() => c.resistor(["gold", "red"], "red"));

assert.equal(c.parse("2,5"), 2.5); assert.equal(c.parse(" 230 "), 230);
assert.equal(c.parse(""), null); assert.equal(c.parse("abc"), null);
assert.equal(c.si(4700, "Ω"), "4,7 kΩ"); assert.equal(c.si(0.022, "A"), "22 mA"); assert.equal(c.si(230, "V"), "230 V");
console.log("Alle Tests bestanden.");

// ---------- Erweiterungen (Referenzwerte mit Python nachgerechnet) ----------
assert.equal(c.parse("4,7k"), 4700); near(c.parse("100n"), 100e-9, 1e-20); near(c.parse("2,2µ"), 2.2e-6, 1e-18);
assert.equal(c.parse("1M"), 1e6); near(c.parse("10m"), 0.01, 1e-15); assert.equal(c.parse("3x"), null);
near(c.parallel([100, 220, 470]), 59.97679814385151); assert.equal(c.series([100, 220]), 320);
r = c.divider({ uin: 12, r1: 10e3, r2: 4.7e3 }); near(r.uout, 3.836734693877551);
near(c.dividerR1({ uin: 12, uout: 5, r2: 10e3 }), 14000);
r = c.eSeries(14000, "E12"); assert.equal(r.lower, 12000); assert.equal(r.upper, 15000); assert.equal(r.nearest, 15000);
r = c.eSeries(4700, "E24"); assert.equal(r.lower, 4700); assert.equal(r.upper, 4700);
r = c.eSeries(0.95, "E6"); assert.equal(r.lower, 0.68); assert.equal(r.upper, 1);
r = c.ledResistor({ ub: 12, uf: 2.1, i: 0.02, n: 2 }); near(r.r, 390); assert.equal(r.chosen, 390); near(r.iReal, 0.02); near(r.pR, 0.156);
assert.throws(() => c.ledResistor({ ub: 3, uf: 2, i: 0.02, n: 2 }));
r = c.acPower({ system: "ac3", u: 400, i: 16, cos: 0.85 }); near(r.s, 11085.125168440814, 1e-6); near(r.p, 9422.356393174692, 1e-6); near(r.q, 5839.45202908629, 1e-6);
r = c.currentFromPower({ system: "ac3", p: 11000, u: 400, cos: 0.85, eta: 0.9 }); near(r.i, 20.754421441457136);
r = c.wireResistance({ length: 50, section: 2.5, kappa: 56, alpha: 0.00393, temp: 70, loop: true }); near(r.r20, 0.7142857142857143); near(r.rT, 0.854642857142857);
r = c.reactance({ f: 50, l: 0.1, c: 10e-6 }); near(r.xl, 31.415926535897935); near(r.xc, 318.30988618379064); near(r.f0, 159.15494309189532);
r = c.timeConstant({ kind: "rc", r: 10e3, x: 100e-9 }); near(r.tau, 0.001); near(r.fg, 159.15494309189535);
r = c.compensation({ system: "ac3", p: 50e3, cos1: 0.7, cos2: 0.95, u: 400, f: 50 }); near(r.qc, 34575.99780207721, 1e-6); near(r.cDelta, 0.0002292892067722957, 1e-15); near(r.cStar, 0.000687867620316887, 1e-15);
r = c.compensation({ system: "ac1", p: 2e3, cos1: 0.7, cos2: 0.95, u: 230, f: 50 }); near(r.c, 8.32202792065799e-05, 1e-15);
r = c.deltaToStar(10, 30, 20); near(r.r1, 3.3333333333333335); near(r.r2, 5); near(r.r3, 10);
r = c.starToDelta(r.r1, r.r2, r.r3); near(r.r12, 10); near(r.r23, 30); near(r.r31, 20);
near(c.db.fromVoltageRatio(10), 20); near(c.db.fromPowerRatio(2), 3.010299956639812); near(c.db.toVoltageRatio(20), 10);
console.log("Erweiterungstests bestanden.");

// ---------- Photovoltaik & Speicher ----------
r = c.pvString({ voc: 49.5, vmpp: 41.6, isc: 13.9, pmod: 500, beta: -0.25, tMin: -10, tMax: 70, uMax: 1000, mppMin: 160, mppMax: 850, iMax: 32 });
near(r.vocCold, 53.83125); near(r.vmppHot, 36.92); near(r.vmppCold, 45.24, 1e-9);
assert.equal(r.nMaxVoltage, 18); assert.equal(r.nMinMpp, 5); assert.equal(r.nMaxMpp, 18); assert.equal(r.parallel, 2); assert.ok(r.ok);
r = c.pvYield({ kwp: 10, specYield: 950, selfShare: 30, price: 0.35, feedIn: 0.08, invest: 15000, opex: 150 });
near(r.e, 9500); near(r.self, 2850); near(r.grid, 6650); near(r.savings, 1379.5, 1e-9); near(r.payback, 10.873504893077202);
r = c.batteryRuntime({ capacity: 10, dod: 0.9, eta: 0.95, load: 0.5 }); near(r.usable, 9); near(r.hours, 17.1, 1e-9);
r = c.batterySize({ load: 0.5, hours: 8, dod: 0.9, eta: 0.95, voltage: 48 }); near(r.kwh, 4.678362573099415); near(r.ah, 97.46588693957115);
r = c.chargeTime({ capacity: 10, socFrom: 0.2, socTo: 0.8, power: 3, eta: 0.95 }); near(r.hours, 2.1052631578947376);
assert.throws(() => c.chargeTime({ capacity: 10, socFrom: 0.8, socTo: 0.2, power: 3, eta: 0.95 }));
console.log("PV-/Speichertests bestanden.");

// ---------- Schutztechnik & Installation ----------
r = c.loopImpedance({ zPre: 0.3, length: 30, section: 2.5, kappa: 56, alpha: 0.00393, temp: 70, u0: 230, c: 0.95, ia: 16 * c.MCB_TRIP.B });
near(r.rLine, 0.5127857142857142); near(r.zs, 0.8127857142857142); near(r.ik, 268.8285438087706, 1e-6); assert.ok(r.ok); near(r.lMax, 142.2377768491434, 1e-6);
near(c.maxLengthDrop({ system: "ac1", current: 16, voltage: 230, maxPercent: 3, cos: 1, kappa: 56, section: 2.5 }), 30.1875);
r = c.overloadCheck({ ib: 14, inn: 16, iz: 20, k2: 1.45 }); assert.ok(r.c1 && r.c2 && r.c3);
r = c.overloadCheck({ ib: 14, inn: 25, iz: 20, k2: 1.45 }); assert.ok(!r.c2);
r = c.transformer({ sn: 630e3, un: 400, uk: 6 }); near(r.inn, 909.3266739736606, 1e-6); near(r.ik3, 15155.444566227678, 1e-5); near(r.zk, 0.015238095238095238);
assert.ok(c.fuseSelectivity(63, 35).ok); assert.ok(!c.fuseSelectivity(50, 35).ok); assert.ok(c.fuseSelectivity(160, 100).ok);
r = c.demand({ loads: [{ p: 2000, n: 3 }, { p: 11000, n: 1 }, { p: 3700, n: 4 }], g: 0.7, u: 400, system: "ac3", cos: 0.9 }); near(r.i, 35.69949164489186); assert.equal(r.rated, 40);
r = c.demand({ loads: [{ p: 11000, n: 4 }], g: 0.8, u: 400, system: "ac3", cos: 1 }); near(r.i, 50.80682368868707); assert.equal(r.rated, 63);
near(c.emergencyBattery({ p: 1500, hours: 3, u: 216, eta: 0.9, reserve: 1.25 }).ah, 28.935185185185187);
near(c.alarmBattery({ iq: 0.25, tq: 72, ia: 1.2, ta: 0.5, reserve: 1.25 }).ah, 23.25);
r = c.speakerLine({ taps: 240, reserve: 1.2, amp: 360, length: 200, section: 1.5, kappa: 56 }); near(r.lossDb, 0.9399312535244717); assert.ok(r.ok);
r = c.decodeIP("IP54"); assert.match(r.first, /Staubgeschützt/); assert.match(r.second, /Strahlwasser|Spritzwasser/);
assert.equal(c.decodeIP("ipx7").first, null); assert.throws(() => c.decodeIP("IP7"));
console.log("Schutztechnik-Tests bestanden.");
assert.deepEqual(c.IK_ENERGY.map(([k]) => k), ["00","01","02","03","04","05","06","07","08","09","10"]);
console.log("IK-Reihenfolge ok.");

// ---------- Netzwerk (Referenz: Python ipaddress) ----------
const N = await import("./net.js");
r = N.ipv4Info("192.168.10.77/26");
assert.equal(r.network, "192.168.10.64"); assert.equal(r.broadcast, "192.168.10.127"); assert.equal(r.mask, "255.255.255.192");
assert.equal(r.wildcard, "0.0.0.63"); assert.equal(r.first, "192.168.10.65"); assert.equal(r.last, "192.168.10.126"); assert.equal(r.hosts, 62);
assert.equal(N.ipv4Info("10.1.2.3", "255.255.0.0").prefix, 16);
assert.equal(N.ipv4Type(N.parseIPv4("172.20.1.1")), "Privat (RFC 1918)"); assert.equal(N.ipv4Type(N.parseIPv4("8.8.8.8")), "Öffentlich");
assert.equal(N.ipv4Info("10.0.0.0/31").hosts, 2); assert.equal(N.ipv4Info("10.0.0.5/32").hosts, 1);
assert.throws(() => N.ipv4Info("256.1.1.1/24")); assert.throws(() => N.ipv4Info("10.0.0.1", "255.0.255.0"));
r = N.ipv4Subnets("10.0.0.0/24", { count: 5 }); assert.equal(r.count, 8); assert.equal(r.list[0].cidr, "10.0.0.0/27");
assert.equal(r.list[1].cidr, "10.0.0.32/27"); assert.equal(r.list[7].cidr, "10.0.0.224/27");
assert.equal(N.ipv4Subnets("10.0.0.0/24", { hosts: 30 }).newPrefix, 27);
r = N.ipv6Info("2001:db8:abcd:12::1/48");
assert.equal(r.expanded, "2001:0db8:abcd:0012:0000:0000:0000:0001"); assert.equal(r.compressed, "2001:db8:abcd:12::1");
assert.equal(r.network, "2001:db8:abcd::/48"); assert.equal(r.subnets64, 65536n); assert.equal(r.type, "Global Unicast");
assert.equal(N.ipv6Compressed(N.parseIPv6("2001:0db8:0000:0000:0000:ff00:0042:8329")), "2001:db8::ff00:42:8329");
assert.equal(N.ipv6Expanded(N.parseIPv6("::1")), "0000:0000:0000:0000:0000:0000:0000:0001");
assert.equal(N.ipv6Compressed(N.parseIPv6("fe80::")), "fe80::"); assert.equal(N.ipv6Info("fe80::1/64").type, "Link-Local");
assert.equal(N.ipv6Compressed(N.parseIPv6("2001:db8:0:1:1:1:1:1")), "2001:db8:0:1:1:1:1:1");
assert.throws(() => N.parseIPv6("2001::db8::1"));
near(N.transferTime({ bytes: 50e9, rate: 100e6, efficiency: 0.9 }), 4444.444444444444, 1e-6);
r = N.poeBudget({ devices: [{ type: "at", count: 8 }, { type: "af", count: 4 }], budget: 370 }); near(r.sum, 301.6, 1e-9); assert.ok(r.ok);
r = N.fiberBudget({ tx: -3, rx: -28, length: 2, att: 0.35, nConn: 2, lossConn: 0.75, nSplice: 4, lossSplice: 0.1, margin: 3 }); near(r.loss, 5.6, 1e-9); near(r.reserve, 19.4, 1e-9);
console.log("Netzwerk-Tests bestanden.");

// ---------- Automatisierung (Referenz: Python / exakte Lösungen) ----------
const AU = await import("./auto.js");
near(AU.rtdResistance(100), 138.5055, 1e-9); near(AU.rtdResistance(-100), 60.25584, 1e-9); near(AU.rtdResistance(25, 1000), 1097.3465625, 1e-7);
near(AU.rtdTemperature(138.5055), 100, 1e-7); near(AU.rtdTemperature(60.25584), -100, 1e-6); near(AU.rtdTemperature(AU.rtdResistance(-180)), -180, 1e-6);
r = AU.znOscillation({ kkrit: 5, tkrit: 10 }); near(r.P.kp, 2.5); near(r.PI.kp, 2.25); near(r.PI.tn, 8.5); near(r.PID.kp, 3); near(r.PID.tn, 5); near(r.PID.tv, 1.2);
r = AU.znStep({ tu: 2, tg: 20, ks: 1.5 }); near(r.P.kp, 6.666666666666667); near(r.PI.kp, 6); near(r.PI.tn, 6.66); near(r.PID.kp, 8); near(r.PID.tn, 4); near(r.PID.tv, 1); near(r.ratio, 10);
r = AU.pidForms({ kp: 2, tn: 4, tv: 0.5, ts: 0.1 }); near(r.ki, 0.5); near(r.kd, 1); near(r.q0, 12.05); near(r.q1, -22); near(r.q2, 10);
r = AU.pidFromParallel({ kp: 2, ki: 0.5, kd: 1 }); near(r.tn, 4); near(r.tv, 0.5);
r = AU.pt2({ w0: 2, d: 0.5 }); near(r.overshoot, 16.303353482158048, 0.05); near(r.tPeak, 1.8137993642342178, 0.01); near(r.analytic.overshoot, 16.303353482158048, 1e-9);
// P-Regler an PT1: y(0,2 s) = 0,8·(1 − e^−1), y∞ = 0,8
r = AU.simulateLoop({ ks: 1, t1: 1, type: "P", kp: 4, tEnd: 3 });
// exakte Lösung y(t) = 0,8·(1 − e^(−5t)) an mehreren Abtastpunkten vergleichen
for (const tq of [0.1, 0.2, 0.5, 1]) { const i = r.t.findIndex((x) => x >= tq); near(r.y[i], 0.8 * (1 - Math.exp(-5 * r.t[i])), 2e-3); }
near(r.yEnd, 0.8, 1e-3);
r = AU.simulateLoop({ ks: 2, t1: 1, n: 2, tt: 0.3, type: "PI", kp: 0.5, tn: 2, tEnd: 40 }); near(r.yEnd, 1, 1e-3);
r = AU.simulateLoop({ ks: 1.5, t1: 2, n: 3, mode: "open", tEnd: 60 }); near(r.yEnd, 1.5, 1e-3);
r = AU.openLoopBode({ ks: 1, t1: 1, n: 1, tt: 0.2, type: "PI", kp: 2, tn: 1, points: 4000 }); near(r.wc, 2, 2e-3); near(r.pm, 67.08168819476707, 0.05);
r = AU.analogScale({ signal: "4-20mA", from: "signal", value: 12, pMin: 0, pMax: 10, rMin: 0, rMax: 27648 }); near(r.phys, 5); near(r.raw, 13824);
near(AU.analogScale({ signal: "4-20mA", from: "raw", value: 27648, pMin: 0, pMax: 10, rMin: 0, rMax: 27648 }).signal, 20);
near(AU.loopBurden({ supply: 24, uMin: 8 }), 800);
r = AU.numberSystems({ text: "1234", base: 16, bits: 16 }); assert.equal(r.unsigned, 4660n); assert.equal(r.bcdDecoded, 1234);
r = AU.numberSystems({ text: "-1", base: 10, bits: 16 }); assert.equal(r.hex, "FFFF"); assert.equal(r.signed, -1n);
r = AU.numberSystems({ text: "5", base: 10, bits: 8 }); assert.equal(r.gray, "0000 0111"); assert.equal(r.bcdEncoded, "05");
assert.throws(() => AU.numberSystems({ text: "256", base: 10, bits: 8 }));
assert.equal(AU.realToHex(1.5), "3FC00000"); assert.equal(AU.realToHex(-0.1), "BDCCCCCD"); near(AU.hexToReal("3FC00000"), 1.5);
r = AU.truthTable("A&B | A&!B"); assert.deepEqual(r.vars, ["A", "B"]); assert.deepEqual(r.minterms, [2, 3]); assert.equal(AU.minimize(r.vars, r.minterms), "A");
r = AU.truthTable("(!A&!B&!C)|(!A&B&!C)|(A&!B&!C)|(A&B&!C)"); assert.equal(AU.minimize(r.vars, r.minterms), "!C");
r = AU.truthTable("A UND (B ODER NICHT C)"); assert.deepEqual(r.minterms, [4, 6, 7]);
r = AU.truthTable("A ^ B"); assert.equal(AU.minimize(r.vars, r.minterms), "A&!B | !A&B");
// Minimierung muss äquivalent sein: zufällige Funktionen prüfen
for (let trial = 0; trial < 200; trial++) {
  const ms = [...Array(16).keys()].filter(() => Math.random() < 0.5);
  const expr = AU.minimize(["A", "B", "C", "D"], ms);
  const back = expr === "0" ? [] : expr === "1" ? [...Array(16).keys()] : AU.truthTable(expr + " | A&!A | B&!B | C&!C | D&!D").minterms;
  assert.deepEqual(back, ms, `Minimierung falsch für ${ms} → ${expr}`);
}
assert.throws(() => AU.truthTable("A & & B"));
r = AU.encoder({ ppr: 1024, rpm: 1500, factor: 4, lead: 5 }); near(r.freq, 25600); near(r.edges, 102400); near(r.mmPerCount, 5 / 4096);
r = AU.vfd({ f: 50, p: 2, slip: 3 }); near(r.nSync, 1500); near(r.n, 1455);
near(AU.vfd({ f: 35, p: 2, un: 400, fn: 50 }).u, 280); near(AU.slipFromNameplate({ f: 50, p: 2, nRated: 1455 }).slip, 3, 1e-12);
console.log("Automatisierungs-Tests bestanden.");
// ---------- Beleuchtung, Motoranlauf, Messwerte ----------
{
  const C4 = await import("./calc4.js");
  let r = C4.lighting({ a: 8, b: 6, h: 2, em: 500, phi: 4000, etaB: 0.6, mf: 0.8, pLum: 30 });
  near(r.area, 48); near(r.k, 48 / 28); near(r.nExact, 12.5); assert.equal(r.n, 13); near(r.emReached, 520); near(r.pTotal, 390);
  r = C4.motorStart({ p: 11000, u: 400, cos: 0.85, eta: 0.9, kI: 7, kM: 2.2, method: "direct" });
  near(r.iN, 11000 / (Math.sqrt(3) * 400 * 0.85 * 0.9)); near(r.iA, 7 * r.iN); near(r.relay, r.iN);
  const sd = C4.motorStart({ p: 11000, u: 400, cos: 0.85, eta: 0.9, kI: 7, kM: 2.2, method: "stardelta" });
  near(sd.iA, 7 * r.iN / 3); near(sd.kMStart, 2.2 / 3); near(sd.relay, r.iN / Math.sqrt(3));
  const sf = C4.motorStart({ p: 11000, u: 400, cos: 0.85, eta: 0.9, kI: 7, kM: 2.2, method: "soft", uStart: 0.5 });
  near(sf.iA, 3.5 * r.iN); near(sf.kMStart, 0.55);
  assert.deepEqual(C4.parseDevice("b16"), { type: "B", inn: 16, ia: 80 }); assert.equal(C4.parseDevice("X16"), null); near(C4.parseDevice("C 10 A").ia, 100);
  const lim = { u0: 230, zsFactor: 1, risoMin: 1, tMax: 300, idn: 30 };
  let c = C4.checkCircuit({ device: "B16", zs: 0.8, riso: 200, trcd: 25, ircd: 21 }, lim); near(c.zsMax, 2.875); assert.equal(c.status, true);
  c = C4.checkCircuit({ device: "B16", zs: 3, riso: 0.5, trcd: null, ircd: null }, lim); assert.equal(c.zsOk, false); assert.equal(c.risoOk, false); assert.equal(c.status, false);
  assert.equal(C4.checkCircuit({ device: "B16", zs: null, riso: null, trcd: null, ircd: null }, lim).status, null);
  console.log("Beleuchtung/Motor/Messwerte ok.");
}
