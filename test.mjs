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
