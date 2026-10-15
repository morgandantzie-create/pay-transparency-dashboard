/**
 * Pay Transparency Dashboard — Apps Script server.
 *
 * Runs in a PERSONAL Google account, bound to (or pointing at) a Google Sheet you own.
 * Sheets: Config, Entities, Families, Levels, Bands, Employees, Compensation, Scenarios.
 *
 * First run: open the script editor, select setupDemoData, click Run, approve access.
 * Then Deploy → New deployment → Web app.
 */

var SHEETS = ['Config', 'Entities', 'Families', 'Levels', 'Bands', 'Employees', 'Compensation'];
var DATASET_KEYS = { Config: 'config', Entities: 'entities', Families: 'families', Levels: 'levels', Bands: 'bands', Employees: 'employees', Compensation: 'compensation' };

/** Web app entry point. */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Pay Transparency Dashboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** The spreadsheet holding the data. Uses the bound sheet, or the ID stored in Script Properties. */
function ss_() {
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('No spreadsheet. Bind this script to a Sheet, or set SPREADSHEET_ID in Script Properties.');
  return SpreadsheetApp.openById(id);
}

/**
 * Creates (or overwrites) every data sheet from the seeded generator.
 * Safe to re-run: produces the identical fictional dataset each time.
 */
function setupDemoData() {
  var data = PT.generator.generate();
  var ss = ss_();
  writeObjects_(ss, 'Config', [data.config]);
  writeObjects_(ss, 'Entities', data.entities);
  writeObjects_(ss, 'Families', data.families);
  writeObjects_(ss, 'Levels', data.levels);
  writeObjects_(ss, 'Bands', data.bands);
  writeObjects_(ss, 'Employees', data.employees);
  writeObjects_(ss, 'Compensation', data.compensation);
  if (!ss.getSheetByName('Scenarios')) {
    ss.insertSheet('Scenarios').getRange(1, 1, 1, 5).setValues([['name', 'entity', 'year', 'savedAt', 'json']]).setFontWeight('bold');
  }
  return 'Created ' + data.employees.length + ' employees and ' + data.compensation.length + ' compensation rows.';
}

function writeObjects_(ss, name, rows) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clear();
  if (!rows.length) return;
  var headers = Object.keys(rows[0]);
  var values = [headers].concat(rows.map(function (r) { return headers.map(function (h) { return r[h] === undefined ? '' : r[h]; }); }));
  var range = sh.getRange(1, 1, values.length, headers.length);
  if (name === 'Config') range.setNumberFormat('@'); // keep values like "04-05" as text, not dates
  range.setValues(values);
  sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sh.setFrozenRows(1);
}

function readObjects_(sh) {
  var values = sh.getDataRange().getValues();
  var headers = values.shift();
  return values.filter(function (r) { return r.join('') !== ''; }).map(function (r) {
    var o = {};
    headers.forEach(function (h, i) {
      var v = r[i];
      o[h] = v instanceof Date ? Utilities.formatDate(v, 'UTC', 'yyyy-MM-dd') : v;
    });
    return o;
  });
}

/** Called by the page. Returns the whole dataset as JSON (the client normalises types). */
function getDataset() {
  var ss = ss_();
  var out = {};
  SHEETS.forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) throw new Error('Missing sheet "' + name + '". Run setupDemoData() from the script editor first.');
    out[DATASET_KEYS[name]] = readObjects_(sh);
  });
  out.config = out.config[0] || {};
  return JSON.stringify(out);
}

function scenarioSheet_() {
  var ss = ss_();
  return ss.getSheetByName('Scenarios') || ss.insertSheet('Scenarios');
}

function listScenarios() {
  var sh = scenarioSheet_();
  if (sh.getLastRow() < 2) return '[]';
  return JSON.stringify(readObjects_(sh).map(function (r) { return JSON.parse(r.json); }));
}

function saveScenario(json) {
  var s = JSON.parse(json);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    deleteRow_(s.name);
    scenarioSheet_().appendRow([s.name, s.entity, s.year, s.savedAt, json]);
  } finally { lock.releaseLock(); }
  return listScenarios();
}

function deleteScenario(name) {
  deleteRow_(name);
  return listScenarios();
}

function deleteRow_(name) {
  var sh = scenarioSheet_();
  var values = sh.getDataRange().getValues();
  for (var i = values.length - 1; i >= 1; i--) if (values[i][0] === name) sh.deleteRow(i + 1);
}
