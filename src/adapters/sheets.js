/**
 * Google Sheets adapter — Apps Script web app mode.
 * Calls server functions in apps-script/Code.gs through google.script.run.
 */
(function (global) {
  'use strict';
  const PT = global.PT || (global.PT = {});

  function call(fn) {
    const args = Array.prototype.slice.call(arguments, 1);
    return new Promise((resolve, reject) => {
      const runner = global.google.script.run.withSuccessHandler(resolve).withFailureHandler(reject);
      runner[fn].apply(runner, args);
    });
  }

  PT.sheetsAdapter = {
    mode: 'Google Sheets',
    loadDataset: () => call('getDataset').then((json) => JSON.parse(json)),
    listScenarios: () => call('listScenarios').then((json) => JSON.parse(json)),
    saveScenario: (s) => call('saveScenario', JSON.stringify(s)).then((json) => JSON.parse(json)),
    deleteScenario: (name) => call('deleteScenario', name).then((json) => JSON.parse(json)),
  };

  /** Pick the right adapter for where the page is running. */
  PT.adapter = function () {
    return global.google && global.google.script && global.google.script.run ? PT.sheetsAdapter : PT.staticAdapter;
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
