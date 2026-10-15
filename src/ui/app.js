/**
 * App shell: state, filters, persona switching, analysis context, rendering.
 * Views live in ui/views/*.js and register themselves on PT.views.
 */
(function (global) {
  'use strict';
  const PT = global.PT || (global.PT = {});
  PT.views = PT.views || {};
  const { esc } = PT.ui;

  const state = {
    ds: null,
    adapter: null,
    persona: 'analyst',
    tab: 'overview',
    filters: { entity: 'UK', year: 2026, family: '', level: '', location: '' },
    scenarios: [],
    employeeId: '',
    selectedCategory: null,
    showNames: false,   // names hidden by default: analyst views show employee IDs
    showNotice: false,
  };
  PT.state = state;

  // ---------- Analysis context (memoised per filter set) ----------
  let cacheKey = '', cache = null;

  function names() {
    return {
      family: (id) => (state.ds.index.family[id] || {}).name || id,
      level: (id) => (state.ds.index.level[id] || {}).name || id,
    };
  }

  function context() {
    const f = state.filters;
    const key = JSON.stringify(f);
    if (key === cacheKey && cache) return cache;
    const ds = state.ds;
    const ent = ds.index.entity[f.entity];
    const nm = names();
    const fitOpts = { familyName: nm.family };
    const minN = Number(ds.config.analystMinGroup || 3);
    const threshold = Number(ds.config.categoryThreshold || 5);
    const rows = PT.model.rows(ds, f);
    const stat = PT.metrics.statutory(rows);
    const reg = PT.regression.fit(rows, fitOpts);
    const cats = PT.metrics.categoryGaps(rows, { minN, threshold, adjusted: reg.ok ? reg.adjusted : {} });
    const bandSummary = PT.bands.summary(rows);
    const fteBonus = PT.metrics.fteBonusGap(rows);
    const trend = ds.years.map((year) => {
      const r = PT.model.rows(ds, Object.assign({}, f, { year }));
      const s = PT.metrics.statutory(r);
      const g = PT.regression.fit(r, fitOpts);
      return { year, mean: s.meanHourlyGap, median: s.medianHourlyGap, adjusted: g.ok ? g.adjustedGap : NaN };
    });
    const filtered = !!(f.family || f.level || f.location);
    const scopeParts = [f.family && nm.family(f.family), f.level && f.level, f.location].filter(Boolean);
    const money = (x, compact) => PT.ui.money(x, ent.currency, compact);
    const money2 = (x) => PT.ui.money(x, ent.currency, false, 2);
    cache = {
      ent, year: f.year, rows, stat, reg, cats, bandSummary, fteBonus, trend, filtered, names: nm, money, money2, minN, threshold, fitOpts,
      publicMinN: Number(ds.config.suppressionThreshold || 5),
      scope: filtered ? 'Within ' + scopeParts.join(' · ') + ',' : 'Across ' + ent.name + ',',
    };
    cache.insights = PT.insights.overview(cache);
    cacheKey = key;
    return cache;
  }
  PT.context = context;

  // ---------- Rendering ----------
  function renderHeader() {
    const ds = state.ds, f = state.filters;
    const ent = ds.index.entity[f.entity];
    const opt = (v, label, sel) => '<option value="' + esc(v) + '"' + (String(sel) === String(v) ? ' selected' : '') + '>' + esc(label) + '</option>';
    const locations = ent.locations.split('|');
    document.getElementById('persona').innerHTML = [['analyst', 'Analyst'], ['leadership', 'Leadership'], ['employee', 'Employee']]
      .map(([id, label]) => '<button type="button" data-persona="' + id + '" aria-pressed="' + (state.persona === id) + '">' + label + '</button>').join('');
    document.getElementById('mode').textContent = 'Fictional data · ' + state.adapter.mode;

    const showDims = state.persona !== 'employee';
    document.getElementById('filter-bar').innerHTML =
      '<label>Entity <select data-filter="entity">' + ds.entities.map((e) => opt(e.id, e.name + ' (' + e.currency + ')', f.entity)).join('') + '</select></label>' +
      '<label>Snapshot <select data-filter="year">' + ds.years.map((y) => opt(y, '5 Apr ' + y, f.year)).join('') + '</select></label>' +
      (showDims && state.persona === 'analyst' ?
        '<label>Job family <select data-filter="family">' + opt('', 'All', f.family) + ds.families.map((x) => opt(x.id, x.name, f.family)).join('') + '</select></label>' +
        '<label>Level <select data-filter="level">' + opt('', 'All', f.level) + ds.levels.map((x) => opt(x.id, x.id + ' ' + x.name, f.level)).join('') + '</select></label>' +
        (locations.length > 1 ? '<label>Location <select data-filter="location">' + opt('', 'All', f.location) + locations.map((l) => opt(l, l, f.location)).join('') + '</select></label>' : '') +
        ((f.family || f.level || f.location) ? '<button type="button" class="link-btn" data-action="clear-filters">Clear filters</button>' : '') +
        '<label class="toggle"><input type="checkbox" data-names' + (state.showNames ? ' checked' : '') + '> Show names</label>' +
        PT.ui.info('Names are hidden by default and employee IDs are shown instead. In a real deployment, showing names would need approval from the data owner.')
        : '') +
      '<span style="margin-left:auto" class="sub">Regime: ' + (ent.regime === 'UK_GPG' ? 'UK gender pay gap reporting' : 'EU Pay Transparency Directive') + '</span>';
  }

  function render() {
    PT.ui.destroyCharts();
    renderHeader();
    const view = PT.views[state.persona];
    const main = document.getElementById('view');
    document.getElementById('notice').innerHTML = state.showNotice ? noticeHtml() : '';
    document.querySelector('[data-action="notice"]').setAttribute('aria-expanded', String(state.showNotice));
    try {
      main.innerHTML = view.html(context(), state);
      if (view.mount) view.mount(context(), state, main);
    } catch (err) {
      console.error(err);
      main.innerHTML = '<div class="card"><h2>Something went wrong</h2><p class="sub">' + esc(err.message) + '</p></div>';
    }
  }
  PT.render = render;

  function noticeHtml() {
    return '<section class="notice" aria-label="Data and AI notice"><div class="card-head"><h2>Data &amp; AI notice</h2><span class="spacer"></span>' +
      '<button type="button" class="link-btn" data-action="notice">Close</button></div><ul>' +
      '<li><strong>Fictional data.</strong> Every person, name, salary and company in this demo is invented by a seeded generator. Any resemblance to real people is coincidental.</li>' +
      '<li><strong>No AI is used.</strong> All calculations, insights and letters are deterministic rules and fixed templates that run in your browser (or in Apps Script). No data is sent to an AI model or any other external service.</li>' +
      '<li><strong>Names are hidden by default.</strong> Analyst views show employee IDs. In a real deployment, showing names, and above all passing named employee data to any AI tool, would need approval first: a documented lawful basis, a data protection impact assessment and sign-off from the data owner.</li>' +
      '<li><strong>Pay information requests are a planned Phase 2 add-on.</strong> They are shown in the Employee view as a preview only, and would go live once use of named employee data, including any AI-assisted drafting, has been approved.</li>' +
      '</ul></section>';
  }

  // ---------- Events ----------
  function onChange(e) {
    const t = e.target;
    if ('names' in t.dataset) { state.showNames = t.checked; cacheKey = ''; render(); return; }
    if (t.dataset.filter) {
      const k = t.dataset.filter;
      state.filters[k] = k === 'year' ? Number(t.value) : t.value;
      if (k === 'entity') { state.filters.location = ''; state.employeeId = ''; }
      state.selectedCategory = null;
      render();
    }
  }
  function onClick(e) {
    const btn = e.target.closest('[data-persona],[data-action="clear-filters"],[data-action="notice"],[data-theme-toggle]');
    if (!btn) return;
    if (btn.dataset.action === 'notice') { state.showNotice = !state.showNotice; render(); return; }
    if (btn.dataset.persona) {
      state.persona = btn.dataset.persona;
      if (state.persona === 'employee' && !state.employeeId) {
        const lena = state.ds.index.employee[state.ds.config.defaultPersonaId];
        if (lena) { state.filters.entity = lena.entity; state.employeeId = lena.id; }
      }
      if (state.persona !== 'analyst') Object.assign(state.filters, { family: '', level: '', location: '' });
      render();
    } else if (btn.dataset.action === 'clear-filters') {
      Object.assign(state.filters, { family: '', level: '', location: '' });
      render();
    } else if (btn.hasAttribute('data-theme-toggle')) {
      const root = document.documentElement;
      const dark = root.dataset.theme ? root.dataset.theme === 'dark' : global.matchMedia('(prefers-color-scheme: dark)').matches;
      root.dataset.theme = dark ? 'light' : 'dark';
      try { global.localStorage.setItem('fernvale.pt.theme', root.dataset.theme); } catch (err) { /* ignore */ }
      render();
    }
  }

  // ---------- Boot ----------
  function boot() {
    try {
      const theme = global.localStorage.getItem('fernvale.pt.theme');
      if (theme) document.documentElement.dataset.theme = theme;
    } catch (err) { /* ignore */ }
    state.adapter = PT.adapter();
    document.addEventListener('change', onChange);
    document.addEventListener('click', onClick);
    Promise.all([state.adapter.loadDataset(), state.adapter.listScenarios()])
      .then(([raw, scenarios]) => {
        state.ds = PT.model.normalise(raw);
        state.scenarios = scenarios || [];
        state.filters.year = state.ds.years[state.ds.years.length - 1];
        render();
      })
      .catch((err) => {
        document.getElementById('view').innerHTML = '<div class="card"><h2>Could not load data</h2><p class="sub">' + esc(err && err.message ? err.message : err) +
          '</p><p class="sub">In Apps Script mode, run <code>setupDemoData()</code> once from the editor to create the sheets.</p></div>';
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : this);
