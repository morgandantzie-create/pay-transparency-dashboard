/**
 * Unit tests for src/core — no dependencies. Run: node tests/run.js
 * Expected values are calculated by hand; workings are in docs/TESTING.md.
 */
const assert = require('assert');
const path = require('path');
['data/generator', 'core/stats', 'core/model', 'core/metrics', 'core/regression', 'core/bands', 'core/privacy', 'core/scenarios', 'core/insights']
  .forEach((m) => require(path.join(__dirname, '..', 'src', m + '.js')));
const PT = globalThis.PT;

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); } catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}
const near = (actual, expected, tol, msg) => assert.ok(Math.abs(actual - expected) <= (tol || 1e-6), (msg || '') + ' expected ' + expected + ', got ' + actual);

// ---------- Fixture: 11 people, standard hours 37.5 → hourly = salary / 1950 ----------
const H = 1950;
const person = (id, sex, hourly, bonus, extra) => Object.assign({
  id, name: id, sex, base: hourly * H, fte: 1, stdHours: 37.5, bonus, reducedPay: false,
  family: 'ENG', level: 'L3', location: 'London', tenure: 3, perf: 3, hireYear: 2022,
  band: { min: 40000, mid: 50000, max: 60000 },
}, extra || {});
const fixture = [
  person('M1', 'M', 20, 1000), person('M2', 'M', 25, 2000), person('M3', 'M', 30, 0), person('M4', 'M', 35, 3000), person('M5', 'M', 40, 4000),
  person('F1', 'F', 15, 500), person('F2', 'F', 21, 0), person('F3', 'F', 26, 1000), person('F4', 'F', 31, 0), person('F5', 'F', 18, 1500),
  person('F6', 'F', 50, 1000, { reducedPay: true }),
  person('X1', 'X', 22, 800),
];

console.log('stats');
test('median of odd and even lists', () => { near(PT.stats.median([3, 1, 2]), 2); near(PT.stats.median([4, 1, 3, 2]), 2.5); });
test('matrix inverse', () => {
  const inv = PT.stats.invert([[4, 7], [2, 6]]);
  near(inv[0][0], 0.6); near(inv[0][1], -0.7); near(inv[1][0], -0.2); near(inv[1][1], 0.4);
});
test('OLS recovers an exact line', () => {
  const X = [[1, 0], [1, 1], [1, 2], [1, 3]], y = [1, 3, 5, 7];
  const r = PT.stats.ols(X, y); near(r.beta[0], 1); near(r.beta[1], 2); near(r.r2, 1);
});

console.log('statutory metrics (UK GPG)');
const s = PT.metrics.statutory(fixture);
test('mean hourly gap = (30 − 22.2) / 30 = 26.0%', () => near(s.meanHourlyGap, 26, 1e-9));
test('median hourly gap = (30 − 21) / 30 = 30.0%', () => near(s.medianHourlyGap, 30, 1e-9));
test('reduced-pay employee excluded from hourly figures', () => assert.strictEqual(s.counts.fullPay, 10));
test('non-binary record excluded from binary measures', () => assert.strictEqual(s.counts.excludedNotBinary, 1));
test('mean bonus gap = (2500 − 1000) / 2500 = 60.0%', () => near(s.meanBonusGap, 60, 1e-9));
test('median bonus gap = (2500 − 1000) / 2500 = 60.0%', () => near(s.medianBonusGap, 60, 1e-9));
test('reduced-pay employee included in bonus figures: 4 of 6 women = 66.7%', () => near(s.pctFReceivingBonus, 400 / 6, 1e-9));
test('men receiving bonus: 4 of 5 = 80%', () => near(s.pctMReceivingBonus, 80, 1e-9));
test('quartile sizes 3/3/2/2', () => assert.deepStrictEqual(s.quartiles.map((q) => q.n), [3, 3, 2, 2]));
test('quartile female shares 66.7 / 66.7 / 50 / 0', () => {
  near(s.quartiles[0].pctF, 200 / 3, 1e-9); near(s.quartiles[1].pctF, 200 / 3, 1e-9); near(s.quartiles[2].pctF, 50); near(s.quartiles[3].pctF, 0);
});

console.log('regression');
// Deterministic data with a known 5% female effect and a 10% level effect, no noise.
const synth = [];
for (let i = 0; i < 40; i++) {
  const sex = i % 2 ? 'F' : 'M', level = i % 4 < 2 ? 'L3' : 'L4', tenure = (i % 5) + 1, perf = (i % 3) + 2;
  const logPay = Math.log(25) - (sex === 'F' ? 0.05 : 0) + (level === 'L4' ? 0.1 : 0) + 0.01 * tenure + 0.02 * perf;
  synth.push(person('S' + i, sex, Math.exp(logPay), 0, { level, tenure, perf, family: i < 20 ? 'ENG' : 'DAT' }));
}
const reg = PT.regression.fit(synth);
test('adjusted gap = (1 − e^−0.05) = 4.877%', () => near(reg.adjustedGap, (1 - Math.exp(-0.05)) * 100, 1e-6));
test('decomposition sums exactly to the raw log gap', () => near(reg.decomposition.reduce((t, d) => t + d.logPoints, 0), reg.rawLogGap, 1e-9));
test('too-small selection is refused, not mis-estimated', () => assert.strictEqual(PT.regression.fit(fixture.slice(0, 6)).ok, false));

console.log('categories, bands, privacy');
test('category gap flagged at ≥5% when unexplained', () => {
  const cats = PT.metrics.categoryGaps(synth, { minN: 3, threshold: 5, adjusted: {} });
  assert.ok(cats.every((c) => c.status === 'flag' || c.status === 'ok' || c.status === 'suppressed'));
});
test('category suppressed below minimum group size', () => {
  const cats = PT.metrics.categoryGaps(fixture, { minN: 6, threshold: 5 });
  assert.strictEqual(cats[0].status, 'suppressed');
});
test('compa-ratio and penetration', () => {
  const p = PT.bands.position({ base: 45000, band: { min: 40000, mid: 50000, max: 60000 } });
  near(p.compa, 0.9); near(p.penetration, 0.25); assert.strictEqual(p.status, 'within');
});
test('below-minimum status and shortfall', () => {
  const p = PT.bands.position({ base: 38000, band: { min: 40000, mid: 50000, max: 60000 } });
  assert.strictEqual(p.status, 'below'); near(p.shortfall, 2000);
});
test('employee-facing averages suppressed when a group < 5', () => {
  assert.strictEqual(PT.privacy.categoryAverages(fixture, 'ENG', 'L3', 7).suppressed, true);
  assert.strictEqual(PT.privacy.categoryAverages(fixture, 'ENG', 'L3', 5).suppressed, false);
});

console.log('scenarios');
test('raise-to-minimum costs shortfall × FTE × (1 + on-cost)', () => {
  const rows = [person('A', 'F', 0, 0, { base: 38000, fte: 0.5 }), person('B', 'M', 0, 0, { base: 45000 })];
  const res = PT.scenarios.run(rows, { raiseToMin: true }, { minN: 1, threshold: 5, onCostRate: 0.1 });
  near(res.totalCost, 2000 * 0.5 * 1.1, 1e-6);
  assert.strictEqual(res.after.belowMin, 0);
});
test('budget cap is never exceeded', () => {
  const rows = [person('A', 'F', 0, 0, { base: 30000 }), person('B', 'F', 0, 0, { base: 32000 })];
  const res = PT.scenarios.run(rows, { raiseToMin: true, budget: 5000 }, { minN: 1, threshold: 5, onCostRate: 0 });
  assert.ok(res.totalCost <= 5000 + 1, 'cost ' + res.totalCost);
});

console.log('generator & story');
const a = JSON.stringify(PT.generator.generate(42)), b = JSON.stringify(PT.generator.generate(42));
test('same seed → identical dataset', () => assert.strictEqual(a, b));
const ds = PT.model.normalise(PT.generator.generate());
const uk = PT.model.rows(ds, { entity: 'UK', year: 2026 });
const ukReg = PT.regression.fit(uk);
const ukCats = PT.metrics.categoryGaps(uk, { minN: 3, threshold: 5, adjusted: ukReg.adjusted });
test('UK adjusted gap is in the 2–5% story range', () => assert.ok(ukReg.adjustedGap > 2 && ukReg.adjustedGap < 5, ukReg.adjustedGap));
test('Engineering L4 (UK) is flagged', () => assert.strictEqual(ukCats.find((c) => c.key === 'ENG|L4').status, 'flag'));
test('Commercial L3 (UK) gap is explained', () => assert.strictEqual(ukCats.find((c) => c.key === 'COM|L3').status, 'explained'));
test('adjusted gap narrows 2024 → 2026', () => {
  const g = (y) => PT.regression.fit(PT.model.rows(ds, { entity: 'UK', year: y })).adjustedGap;
  assert.ok(g(2024) > g(2025) && g(2025) > g(2026));
});
test('persona Lena Hoffmann exists in Berlin Engineering', () => {
  const e = ds.index.employee[ds.config.defaultPersonaId];
  assert.strictEqual(e.name, 'Lena Hoffmann'); assert.strictEqual(e.entity, 'DE');
});
test('insights produce text for every rule input', () => {
  const ctx = { reg: ukReg, stat: PT.metrics.statutory(uk), cats: ukCats, bandSummary: PT.bands.summary(uk), fteBonus: PT.metrics.fteBonusGap(uk),
    trend: [{ year: 2024, adjusted: 5 }, { year: 2026, adjusted: 3.5 }], names: { family: (x) => x }, threshold: 5, scope: 'Across UK,', money: (x) => '£' + Math.round(x) };
  const out = PT.insights.overview(ctx);
  assert.ok(out.length >= 5 && out.every((i) => i.title && i.text));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
