/** Leadership view (CFO / ExCo): headline risk, trend, both entities, costed options, printable. */
(function (global) {
  'use strict';
  const PT = global.PT;
  const { esc, pct, num, insightList, table, chart, colors } = PT.ui;
  const { tile, TIPS } = PT.views.analyst;

  function entitySummary(state) {
    const ds = state.ds, year = state.filters.year;
    return ds.entities.map((ent) => {
      const rows = PT.model.rows(ds, { entity: ent.id, year });
      const s = PT.metrics.statutory(rows);
      const reg = PT.regression.fit(rows);
      const cats = PT.metrics.categoryGaps(rows, { minN: Number(ds.config.analystMinGroup || 3), threshold: Number(ds.config.categoryThreshold || 5), adjusted: reg.ok ? reg.adjusted : {} });
      const b = PT.bands.summary(rows);
      return {
        name: ent.name, regime: ent.regime === 'UK_GPG' ? 'UK GPG (statutory)' : 'EU Directive', headcount: rows.length,
        median: s.medianHourlyGap, mean: s.meanHourlyGap, adjusted: reg.ok ? reg.adjustedGap : NaN,
        flagged: cats.filter((c) => c.status === 'flag').length, below: b.pctBelow,
      };
    });
  }

  function html(ctx, state) {
    const s = ctx.stat, r = ctx.reg;
    const flagged = ctx.cats.filter((c) => c.status === 'flag').length;
    const saved = state.scenarios.filter((x) => x.entity === ctx.ent.id && x.year === state.filters.year);
    const cheapest = saved.slice().sort((a, b) => a.totalCost - b.totalCost)[0];
    const order = { risk: 0, watch: 1, good: 2, info: 3 };
    const top = ctx.insights.filter((i) => i.tone !== 'info').sort((a, b) => order[a.tone] - order[b.tone]).slice(0, 3);
    const options = [{ name: 'Do nothing', summary: 'Current position', totalCost: 0, pctPayroll: 0, after: { medianGap: s.medianHourlyGap, adjustedGap: r.ok ? r.adjustedGap : NaN, flagged } }].concat(saved);

    return '<div class="print-only"><h1>Pay transparency summary · ' + esc(ctx.ent.name) + '</h1><p class="sub">Snapshot 5 April ' + state.filters.year + ' · Fictional data</p><br></div>' +
      '<div class="card-head no-print"><h2>' + esc(ctx.ent.name) + ' · board summary</h2><span class="spacer"></span><button type="button" class="btn" data-action="print">Print / save as PDF</button></div>' +
      '<div class="tiles">' +
      tile('Median hourly pay gap', pct(s.medianHourlyGap), 'Statutory headline', TIPS.medianHourly) +
      tile('Like-for-like gap', r.ok ? pct(r.adjustedGap) : '–', 'The part we must justify or fix', TIPS.adjusted, r.ok ? (Math.abs(r.adjustedGap) >= 5 ? 'risk' : Math.abs(r.adjustedGap) >= 2 ? 'watch' : 'good') : '') +
      tile('Categories needing action', num(flagged), 'Unexplained gap of ' + ctx.threshold + '%+', TIPS.category, flagged ? 'risk' : 'good') +
      tile('Paid below band minimum', pct(ctx.bandSummary.pctBelow), num(ctx.bandSummary.below) + ' people', null, ctx.bandSummary.below ? 'watch' : 'good') +
      tile('Lowest-cost saved option', cheapest ? ctx.money(cheapest.totalCost) : '–', cheapest ? esc(cheapest.name) + ': adjusted gap to ' + pct(cheapest.after.adjustedGap) : 'Save options in Analyst › Scenarios') +
      '</div><div class="grid" style="margin-top:16px">' +
      '<section class="card span-7"><div class="card-head"><h2>Three-year trend</h2><span class="sub">Dotted line = projection at the current pace</span></div><div class="chart-box"><canvas id="c-trend" role="img" aria-label="Median and adjusted pay gap over three years with projection"></canvas></div>' +
      '<details class="data"><summary>Show data</summary>' + table(ctx.trend, [{ key: 'year', label: 'Snapshot' }, { key: 'median', label: 'Median gap', cls: 'num', fmt: (v) => pct(v) }, { key: 'mean', label: 'Mean gap', cls: 'num', fmt: (v) => pct(v) }, { key: 'adjusted', label: 'Adjusted gap', cls: 'num', fmt: (v) => pct(v) }]) + '</details></section>' +
      '<section class="card span-5"><div class="card-head"><h2>What the board needs to know</h2></div>' + insightList(top) + '</section>' +
      '<section class="card span-12"><div class="card-head"><h2>Remediation options</h2><span class="sub">Annual cost including on-costs</span></div>' +
      table(options, [
        { key: 'name', label: 'Option' }, { key: 'summary', label: 'Strategy' },
        { key: 'totalCost', label: 'Annual cost', cls: 'num', fmt: (v) => ctx.money(v) },
        { key: 'pctPayroll', label: '% of payroll', cls: 'num', fmt: (v) => pct(v, 2) },
        { key: 'after', label: 'Median gap', cls: 'num', fmt: (v) => pct(v.medianGap) },
        { key: 'after', label: 'Adjusted gap', cls: 'num', fmt: (v) => pct(v.adjustedGap) },
        { key: 'after', label: 'Categories needing action', cls: 'num', fmt: (v) => num(v.flagged) },
      ]) + (saved.length ? '' : '<p class="sub" style="margin-top:8px">No saved options yet. An analyst can build them in Analyst › Remediation scenarios.</p>') + '</section>' +
      '<section class="card span-12"><div class="card-head"><h2>Group view · ' + state.filters.year + '</h2><span class="sub">Each entity reported in its own currency and regime</span></div>' +
      table(entitySummary(state), [
        { key: 'name', label: 'Entity' }, { key: 'regime', label: 'Regime' }, { key: 'headcount', label: 'People', cls: 'num' },
        { key: 'median', label: 'Median gap', cls: 'num', fmt: (v) => pct(v) }, { key: 'mean', label: 'Mean gap', cls: 'num', fmt: (v) => pct(v) },
        { key: 'adjusted', label: 'Adjusted gap', cls: 'num', fmt: (v) => pct(v) }, { key: 'flagged', label: 'Categories needing action', cls: 'num' },
        { key: 'below', label: '% below band', cls: 'num', fmt: (v) => pct(v) },
      ]) + '</section></div>' +
      '<p class="disclaimer">Fictional data for demonstration. Not legal advice.</p>';
  }

  function mount(ctx, state, main) {
    const c = colors();
    const t = ctx.trend.filter((x) => !isNaN(x.adjusted));
    const years = t.map((x) => x.year);
    const fit = PT.stats.linearFit(years, t.map((x) => x.adjusted));
    const last = years[years.length - 1];
    const proj = [last, last + 1, last + 2, last + 3].map((y) => ({ x: y, y: Math.max(0, fit.intercept + fit.slope * y) }));
    proj[0].y = t[t.length - 1].adjusted;
    chart(document.getElementById('c-trend'), {
      type: 'line',
      data: { datasets: [
        { label: 'Median gap', data: t.map((x) => ({ x: x.year, y: x.median })), borderColor: c.neutral, backgroundColor: c.neutral, borderWidth: 2, pointRadius: 4, tension: 0 },
        { label: 'Adjusted gap', data: t.map((x) => ({ x: x.year, y: x.adjusted })), borderColor: c.F, backgroundColor: c.F, borderWidth: 2, pointRadius: 4, tension: 0 },
        { label: 'Adjusted gap projection', data: proj, borderColor: c.F, backgroundColor: c.F, borderWidth: 2, borderDash: [4, 4], pointRadius: 0, tension: 0 },
      ] },
      options: {
        scales: { x: { type: 'linear', ticks: { stepSize: 1, callback: (v) => String(v) } }, y: { beginAtZero: true, ticks: { callback: (v) => v + '%' } } },
        plugins: { tooltip: { mode: 'nearest', intersect: false, callbacks: { title: (items) => String(items[0].parsed.x), label: (it) => it.dataset.label + ': ' + it.parsed.y.toFixed(1) + '%' } } },
        interaction: { mode: 'nearest', intersect: false },
      },
    });
    main.onclick = (e) => { if (e.target.closest('[data-action="print"]')) global.print(); };
    main.onchange = null; main.oninput = null;
  }

  PT.views.leadership = { html, mount };
})(typeof globalThis !== 'undefined' ? globalThis : this);
