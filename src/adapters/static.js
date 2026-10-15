/**
 * Static adapter — GitHub Pages / local file mode.
 * Data comes from the seeded generator in the browser; scenarios persist in localStorage.
 */
(function (global) {
  'use strict';
  const PT = global.PT || (global.PT = {});
  const KEY = 'fernvale.pt.scenarios.v1';

  function read() {
    try { return JSON.parse(global.localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
  }
  function write(list) {
    try { global.localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* storage unavailable: keep in memory */ }
    memory = list;
  }
  let memory = null;

  PT.staticAdapter = {
    mode: 'Static demo',
    loadDataset: () => Promise.resolve(PT.generator.generate()),
    listScenarios: () => Promise.resolve(memory || read()),
    saveScenario: (s) => { const list = (memory || read()).filter((x) => x.name !== s.name); list.push(s); write(list); return Promise.resolve(list); },
    deleteScenario: (name) => { const list = (memory || read()).filter((x) => x.name !== name); write(list); return Promise.resolve(list); },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
