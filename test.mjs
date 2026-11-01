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
