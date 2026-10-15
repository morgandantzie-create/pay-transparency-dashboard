/**
 * Parity test: runs apps-script/Code.gs against an in-memory mock of SpreadsheetApp,
 * round-trips the dataset through "Sheets", and checks the metrics match static mode.
 * The mock converts ISO date strings to Date objects, as Google Sheets does.
 * Run: node tests/parity.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const root = path.join(__dirname, '..');

function mockSheet(name) {
  let grid = [], text = false;
  const coerce = (v) => (!text && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T00:00:00Z') : v);
  const sh = {
    getName: () => name,
    clear: () => { grid = []; },
    setFrozenRows: () => {},
    getRange: (r) => {
      const range = {
        setValues: (vals) => { vals.forEach((row, i) => { grid[r - 1 + i] = row.map(coerce); }); return range; },
        setFontWeight: () => range,
        setNumberFormat: (f) => { text = f === '@'; return range; },
      };
      return range;
    },
    getDataRange: () => ({ getValues: () => grid.map((r) => r.slice()) }),
    getLastRow: () => grid.length,
    appendRow: (row) => { grid.push(row); },
    deleteRow: (i) => { grid.splice(i - 1, 1); },
  };
  return sh;
}
const sheets = {};
const ss = { getSheetByName: (n) => sheets[n] || null, insertSheet: (n) => (sheets[n] = mockSheet(n)) };

const ctx = {
  SpreadsheetApp: { getActiveSpreadsheet: () => ss },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
  LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
  Utilities: { formatDate: (d) => d.toISOString().slice(0, 10) },
  HtmlService: {},
  console,
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'src/data/generator.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'apps-script/Code.gs'), 'utf8'), ctx);

console.log(vm.runInContext('setupDemoData()', ctx));
const fromSheets = JSON.parse(vm.runInContext('getDataset()', ctx));

['data/generator', 'core/stats', 'core/model', 'core/metrics', 'core/regression'].forEach((m) => require(path.join(root, 'src', m + '.js')));
const PT = globalThis.PT;
const a = PT.model.normalise(PT.generator.generate());
const b = PT.model.normalise(fromSheets);

let ok = 0;
for (const entity of ['UK', 'DE']) {
  for (const year of a.years) {
    const ra = PT.model.rows(a, { entity, year }), rb = PT.model.rows(b, { entity, year });
    const sa = PT.metrics.statutory(ra), sb = PT.metrics.statutory(rb);
    assert.strictEqual(ra.length, rb.length, entity + ' ' + year + ' row count');
    ['meanHourlyGap', 'medianHourlyGap', 'meanBonusGap', 'medianBonusGap'].forEach((k) => assert.ok(Math.abs(sa[k] - sb[k]) < 1e-9, entity + ' ' + year + ' ' + k));
    assert.ok(Math.abs(PT.regression.fit(ra).adjustedGap - PT.regression.fit(rb).adjustedGap) < 1e-9, entity + ' ' + year + ' adjusted');
    ok++;
  }
}
// Scenario persistence round trip
vm.runInContext("saveScenario(JSON.stringify({ name: 'Option A', entity: 'UK', year: 2026, savedAt: 'x', totalCost: 1 }))", ctx);
vm.runInContext("saveScenario(JSON.stringify({ name: 'Option A', entity: 'UK', year: 2026, savedAt: 'y', totalCost: 2 }))", ctx);
const list = JSON.parse(vm.runInContext('listScenarios()', ctx));
assert.strictEqual(list.length, 1, 'saving the same name replaces it');
assert.strictEqual(list[0].totalCost, 2);
assert.strictEqual(JSON.parse(vm.runInContext("deleteScenario('Option A')", ctx)).length, 0);
console.log('Parity OK: ' + ok + ' entity/year snapshots identical in Sheets and static mode; scenario save/replace/delete OK');
