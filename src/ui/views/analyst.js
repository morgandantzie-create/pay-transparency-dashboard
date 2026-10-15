/** Analyst view (Reward / HR analyst + Talent partner): the full analysis. */
(function (global) {
  'use strict';
  const PT = global.PT;
  const { esc, pct, num, info, insightList, table, chart, colors, downloadCsv } = PT.ui;

  const TABS = [
    ['overview', 'Statutory overview'],
    ['drivers', 'Gap drivers'],
    ['categories', 'Categories of worker'],
    ['bands', 'Pay bands'],
    ['scenarios', 'Remediation scenarios'],
    ['ranges', 'Job advert ranges'],
  ];

  const TIPS = {
    meanHourly: 'Mean hourly pay of men minus mean hourly pay of women, as a % of men\'s. Full-pay relevant employees only. Positive = women paid less.',
    medianHourly: 'Difference between the middle hourly rate for men and for women, as a % of men\'s. Less affected by a few very high earners than the mean.',
    meanBonus: 'Mean bonus paid in the 12 months to the snapshot date, men vs women, among those who received one. Commission counts as bonus.',
    medianBonus: 'Median bonus paid in the 12 months to the snapshot date, men vs women, among those who received one.',
    bonusShare: 'Proportion of women and of men who received any bonus pay in the 12 months to the snapshot date.',
    adjusted: 'Gap between women and men with the same level, job family, location, tenure and performance rating (regression on log hourly pay). This is the part objective criteria do not explain.',
    quartiles: 'Everyone ranked by hourly pay and split into four equal groups. Shows the share of women and men in each.',
    compa: 'Salary ÷ band midpoint. 100% = paid at the midpoint of the band.',
    category: 'A "category of worker" is a group doing the same work or work of equal value. Here: job family × level. The EU Directive requires a gap analysis per category; a gap of 5%+ that is not justified triggers a joint pay assessment.',
  };

  /** Name column: hidden unless the analyst has switched names on. */
  const nameCol = (state) => ({ key: 'name', label: 'Name', fmt: (v) => (state.showNames ? esc(v) : '<span class="sub">Hidden</span>') });
  const nameCsv = (state) => (state.showNames ? [{ key: 'name', label: 'Name' }] : []);

  function tile(label, value, foot, tip, tone) {
    return '<div class="tile ' + (tone || '') + '"><div class="label">' + esc(label) + (tip ? info(tip) : '') + '</div><div class="value">' + value + '</div>' + (foot ? '<div class="foot">' + foot + '</div>' : '') + '</div>';
  }
  const toneFor = (g) => (isNaN(g) ? '' : Math.abs(g) >= 5 ? 'risk' : Math.abs(g) >= 2 ? 'watch' : 'good');
  const pickInsights = (ctx, ids) => ctx.insights.filter((i) => ids.indexOf(i.id) >= 0);

  // ---------------- Overview ----------------
  function overview(ctx) {
    const s = ctx.stat, r = ctx.reg;
    const filteredNote = ctx.filtered ? '<span class="badge warn">Filtered view: not the statutory figure</span>' : '<span class="badge accent">Statutory measures</span>';
    return '<div class="card-head">' + filteredNote + '<span class="sub">' + num(s.counts.relevant) + ' relevant employees · ' + num(s.counts.fullPay) + ' full-pay relevant</span></div>' +
      '<div class="tiles">' +
      tile('Mean hourly pay gap', pct(s.meanHourlyGap), 'Mean per hour: women ' + ctx.money2(s.meanHourly.F) + ', men ' + ctx.money2(s.meanHourly.M), TIPS.meanHourly) +
      tile('Median hourly pay gap', pct(s.medianHourlyGap), 'Headline figure most often quoted', TIPS.medianHourly) +
      tile('Mean bonus gap', pct(s.meanBonusGap), 'Among bonus recipients', TIPS.meanBonus) +
      tile('Median bonus gap', pct(s.medianBonusGap), 'Among bonus recipients', TIPS.medianBonus) +
      tile('Received a bonus', '<div class="split"><span><i class="dot f"></i>' + pct(s.pctFReceivingBonus, 0) + '</span><span><i class="dot m"></i>' + pct(s.pctMReceivingBonus, 0) + '</span></div>', 'Women · Men', TIPS.bonusShare) +
      tile('Adjusted (like-for-like) gap', r.ok ? pct(r.adjustedGap) : '–', r.ok ? '95% range ' + pct(r.ci[0]) + ' to ' + pct(r.ci[1]) : esc(r.reason), TIPS.adjusted, r.ok ? toneFor(r.adjustedGap) : '') +
      '</div>' +
      '<div class="grid" style="margin-top:16px">' +
      '<section class="card span-7"><div class="card-head"><h2>Pay quartiles</h2>' + info(TIPS.quartiles) + '</div><div class="chart-box"><canvas id="c-quart" role="img" aria-label="Share of women and men in each hourly pay quartile"></canvas></div>' +
      '<details class="data"><summary>Show data</summary>' + table(s.quartiles, [
        { key: 'name', label: 'Quartile' }, { key: 'n', label: 'People', cls: 'num' },
        { key: 'pctF', label: 'Women', cls: 'num', fmt: (v) => pct(v) }, { key: 'pctM', label: 'Men', cls: 'num', fmt: (v) => pct(v) }]) + '</details></section>' +
      '<section class="card span-5"><div class="card-head"><h2>What this means</h2></div>' + insightList(pickInsights(ctx, ['adjusted', 'structural', 'bonus', 'excl'])) + '</section>' +
      '</div>';
  }
  function mountOverview(ctx) {
    const c = colors();
    const q = ctx.stat.quartiles;
    chart(document.getElementById('c-quart'), {
      type: 'bar',
      data: {
        labels: q.map((x) => x.name),
        datasets: [
          { label: 'Women', data: q.map((x) => x.pctF), backgroundColor: c.F, borderColor: c.surface, borderWidth: 2, borderRadius: 4, borderSkipped: false },
          { label: 'Men', data: q.map((x) => x.pctM), backgroundColor: c.M, borderColor: c.surface, borderWidth: 2, borderRadius: 4, borderSkipped: false },
        ],
      },
      options: {
        indexAxis: 'y',
        scales: { x: { stacked: true, max: 100, ticks: { callback: (v) => v + '%' } }, y: { stacked: true, grid: { display: false } } },
        plugins: { tooltip: { callbacks: { label: (it) => it.dataset.label + ': ' + it.parsed.x.toFixed(1) + '% (' + (it.datasetIndex === 0 ? q[it.dataIndex].f : q[it.dataIndex].m) + ' people)' } } },
      },
    });
  }

  // ---------------- Gap drivers ----------------
  function drivers(ctx) {
    const r = ctx.reg;
    if (!r.ok) return '<div class="card"><h2>Gap drivers</h2><p class="sub">' + esc(r.reason) + ' Widen the filters to fit the model.</p></div>';
    const coefs = r.coefficients.filter((c) => c.group !== 'intercept').map((c) => Object.assign({}, c, {
      lo: (Math.exp(c.beta - 1.96 * c.se) - 1) * 100, hi: (Math.exp(c.beta + 1.96 * c.se) - 1) * 100,
      groupLabel: c.group === 'female' ? 'Sex' : PT.regression.GROUP_LABEL[c.group],
    }));
    const ref = r.reference;
    return '<p class="lede">Breaks the average gap into the part explained by <em>where</em> women and men work (level, family, location) and by tenure and rating, and the part that remains when like is compared with like. Bars show approximate percentage points (log-pay differences).</p>' +
      '<div class="grid">' +
      '<section class="card span-7"><div class="card-head"><h2>From average gap to unexplained gap</h2>' + info('Pooled decomposition: each factor\'s coefficient × the difference between men\'s and women\'s average on that factor. Contributions add up exactly to the raw gap.') + '</div>' +
      '<div class="chart-box tall"><canvas id="c-water" role="img" aria-label="Waterfall chart decomposing the pay gap"></canvas></div>' +
      '<details class="data"><summary>Show data</summary>' + table(r.decomposition.concat([{ label: 'Total average gap', logPoints: r.rawLogGap }]), [
        { key: 'label', label: 'Component' }, { key: 'logPoints', label: '≈ points', cls: 'num', fmt: (v) => (v * 100).toFixed(1) }]) + '</details></section>' +
      '<section class="card span-5"><div class="card-head"><h2>Model summary</h2></div>' +
      '<div class="tiles" style="grid-template-columns:1fr 1fr">' +
      tile('Adjusted gap', pct(r.adjustedGap), '95% range ' + pct(r.ci[0]) + ' to ' + pct(r.ci[1]), TIPS.adjusted, toneFor(r.adjustedGap)) +
      tile('Statistically clear?', r.significant ? 'Yes' : 'No', r.significant ? 'Unlikely to be chance (p < 0.05)' : 'Could be chance at this sample size') +
      tile('People in model', num(r.n), num(r.nF) + ' women · ' + num(r.nM) + ' men') +
      tile('Variation explained (R²)', (r.r2 * 100).toFixed(0) + '%', 'Share of pay variation the model accounts for') +
      '</div><p class="sub" style="margin-top:10px">Reference groups: level ' + esc(ref.level) + ', ' + esc(ctx.names.family(ref.family)) + (ref.location ? ', ' + esc(ref.location) : '') + '. Excludes people on reduced pay due to leave.</p>' +
      '<div style="margin-top:12px">' + insightList(pickInsights(ctx, ['structural'])) + '</div></section>' +
      '<section class="card span-12"><div class="card-head"><h2>Factor effects</h2><span class="sub">Effect on hourly pay relative to the reference group, holding other factors constant</span></div>' +
      table(coefs, [
        { key: 'groupLabel', label: 'Factor group' }, { key: 'name', label: 'Factor' },
        { key: 'effectPct', label: 'Effect on pay', cls: 'num', fmt: (v) => (v > 0 ? '+' : '') + v.toFixed(1) + '%' },
        { key: 'lo', label: '95% range', cls: 'num', fmt: (v, row) => v.toFixed(1) + '% to ' + row.hi.toFixed(1) + '%' },
      ]) + '</section></div>';
  }
  function mountDrivers(ctx) {
    const r = ctx.reg;
    if (!r.ok) return;
    const c = colors();
    const comps = r.decomposition.map((d) => ({ label: d.label, v: d.logPoints * 100, unexplained: d.group === 'unexplained' }));
    let cum = 0;
    const bars = comps.map((d) => { const b = [cum, cum + d.v]; cum += d.v; return b; });
    bars.push([0, r.rawLogGap * 100]);
    const labels = comps.map((d) => d.label).concat(['Total gap']);
    const fills = comps.map((d) => (d.unexplained ? c.critical : c.neutral)).concat([PT.ui.css('--text-secondary')]);
    chart(document.getElementById('c-water'), {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Contribution', data: bars, backgroundColor: fills, borderRadius: 4, borderSkipped: false, maxBarThickness: 44 }] },
      options: {
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (it) => { const [a, b] = it.raw; return (b - a >= 0 ? '+' : '') + (b - a).toFixed(1) + ' pts' + (it.dataIndex === labels.length - 1 ? ' (total)' : ''); } } } },
        scales: { y: { ticks: { callback: (v) => v + ' pts' } }, x: { grid: { display: false } } },
      },
    });
  }

  // ---------------- Categories ----------------
  function bucket(v) {
    if (isNaN(v)) return 'var(--surface-2)';
    if (v >= 5) return 'var(--div-pos-2)';
    if (v >= 2) return 'var(--div-pos-1)';
    if (v > -2) return 'var(--div-mid)';
    if (v > -5) return 'var(--div-neg-1)';
    return 'var(--div-neg-2)';
  }
  function categories(ctx, state) {
    const ds = state.ds;
    const metric = state.catMetric || 'unexplained';
    const byKey = Object.fromEntries(ctx.cats.map((c) => [c.key, c]));
    const sel = state.selectedCategory;
    const head = '<tr><th scope="col">Job family</th>' + ds.levels.map((l) => '<th scope="col">' + l.id + '<br><span class="sub">' + esc(l.name) + '</span></th>').join('') + '</tr>';
    const body = ds.families.map((f) => '<tr><th scope="row">' + esc(f.name) + '</th>' + ds.levels.map((l) => {
      const c = byKey[f.id + '|' + l.id];
      if (!c) return '<td><span class="sub">—</span></td>';
      if (c.status === 'suppressed') return '<td><div class="cell suppressed" title="Fewer than ' + ctx.minN + ' women or men">n&lt;' + ctx.minN + '<small>' + c.nF + 'F · ' + c.nM + 'M</small></div></td>';
      const v = c[metric];
      const strong = Math.abs(v) >= 5;
      const icon = c.status === 'flag' ? '⚠ ' : c.status === 'explained' ? '✓ ' : '';
      return '<td><button type="button" class="cell" data-cat="' + c.key + '" aria-pressed="' + (sel === c.key) + '" style="background:' + bucket(v) + (strong ? ';color:var(--div-strong-text)' : '') + '" aria-label="' + esc(f.name + ' ' + l.id + ': ' + pct(v) + ', ' + c.status) + '">' + icon + pct(v) +
        '<small' + (strong ? ' style="color:var(--div-strong-text)"' : '') + '>' + c.nF + 'F · ' + c.nM + 'M</small></button></td>';
    }).join('') + '</tr>').join('');

    const counts = { flag: 0, explained: 0, ok: 0, suppressed: 0 };
    ctx.cats.forEach((c) => counts[c.status]++);
    let html = '<p class="lede">Each cell is a category of worker (job family × level). ' +
      'Cells show the ' + (metric === 'raw' ? '<strong>raw</strong> gap in mean hourly pay' : '<strong>unexplained</strong> gap after allowing for location, tenure and rating') +
      '. Positive values mean women are paid less. Select a cell to see the people behind it.</p>' +
      '<div class="grid"><section class="card span-12"><div class="card-head"><h2>Gap by category of worker</h2>' + info(TIPS.category) +
      '<span class="spacer"></span><div class="segmented" role="group" aria-label="Metric">' +
      '<button type="button" data-metric="unexplained" aria-pressed="' + (metric === 'unexplained') + '">Unexplained gap</button>' +
      '<button type="button" data-metric="raw" aria-pressed="' + (metric === 'raw') + '">Raw gap</button></div>' +
      '<button type="button" class="btn" data-export="cats">Export CSV</button></div>' +
      '<div class="table-wrap"><table class="heat"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
      '<div class="legend-row"><span><i class="swatch" style="background:var(--div-neg-2)"></i>Men paid ≥5% less</span><span><i class="swatch" style="background:var(--div-neg-1)"></i>2–5%</span>' +
      '<span><i class="swatch" style="background:var(--div-mid);border:1px solid var(--border)"></i>Within ±2%</span><span><i class="swatch" style="background:var(--div-pos-1)"></i>2–5%</span><span><i class="swatch" style="background:var(--div-pos-2)"></i>Women paid ≥5% less</span>' +
      '<span>⚠ ' + counts.flag + ' need action</span><span>✓ ' + counts.explained + ' over 5% but explained</span><span>' + counts.suppressed + ' too small to assess</span></div></section>';

    html += '<section class="card span-7" id="drill">' + (sel && byKey[sel] && byKey[sel].status !== 'suppressed' ? drill(ctx, byKey[sel]) : '<h2>Category detail</h2><p class="sub" style="margin-top:8px">Select a category in the grid above.</p>') + '</section>';
    html += '<section class="card span-5"><div class="card-head"><h2>What this means</h2></div>' + insightList(pickInsights(ctx, ['cats'])) + '</section></div>';
    return html;
  }
  function drill(ctx, c) {
    const members = ctx.rows.filter((r) => r.family === c.family && r.level === c.level && (r.sex === 'F' || r.sex === 'M') && !r.reducedPay);
    const fam = ctx.names.family(c.family);
    let html = '<div class="card-head"><h2>' + esc(fam + ' · ' + c.level) + '</h2><span class="badge ' + (c.status === 'flag' ? 'warn' : 'accent') + '">' +
      (c.status === 'flag' ? '⚠ Joint pay assessment risk' : c.status === 'explained' ? '✓ Gap explained by objective factors' : 'Within threshold') + '</span></div>' +
      '<div class="tiles" style="grid-template-columns:repeat(3,1fr)">' +
      '<div class="tile"><div class="label">Raw gap</div><div class="value">' + pct(c.raw) + '</div></div>' +
      '<div class="tile"><div class="label">Unexplained</div><div class="value">' + pct(c.unexplained) + '</div></div>' +
      '<div class="tile"><div class="label">Mean salary</div><div class="split" style="margin-top:6px"><span><i class="dot f"></i>' + ctx.money(c.meanF * members[0].stdHours * 52) + '</span><span><i class="dot m"></i>' + ctx.money(c.meanM * members[0].stdHours * 52) + '</span></div></div></div>' +
      '<div class="chart-box" style="margin-top:12px"><canvas id="c-scatter" role="img" aria-label="Salary against tenure for women and men in this category"></canvas></div>';
    if (c.nF < 5 || c.nM < 5) html += '<p class="sub" style="margin-top:6px">Small group: fewer than 5 women or men. Review individual cases rather than relying on the average.</p>';
    if (c.status === 'flag') {
      html += '<h3 style="margin-top:14px">Joint pay assessment: what it would cover</h3><ol class="sub" style="padding-left:18px;margin:6px 0 0">' +
        '<li>Proportion of women and men in this category</li><li>Average pay and complementary/variable pay by sex</li>' +
        '<li>Differences in pay levels between women and men</li><li>Reasons for the differences, and any objective, gender-neutral justification</li>' +
        '<li>Measures to address unjustified differences, and how their effect will be evaluated</li><li>Evaluation of measures taken after previous assessments</li></ol>' +
        '<p class="sub" style="margin-top:6px">Carried out with worker representatives. Try <button type="button" class="link-btn" data-goto="scenarios">Remediation scenarios</button> to cost a fix.</p>';
    }
    html += '<details class="data"><summary>Show people (' + members.length + ')</summary>' + table(members.map((r) => Object.assign({}, r, { pos: PT.bands.position(r) })), [
      { key: 'id', label: 'ID' }, nameCol(PT.state), { key: 'sex', label: 'Sex' }, { key: 'location', label: 'Location' },
      { key: 'tenure', label: 'Tenure (yrs)', cls: 'num', fmt: (v) => v.toFixed(1) }, { key: 'perf', label: 'Rating', cls: 'num' },
      { key: 'base', label: 'Salary (FTE)', cls: 'num', fmt: (v) => ctx.money(v) }, { key: 'pos', label: 'Compa', cls: 'num', fmt: (v) => pct(v.compa * 100, 0) }]) + '</details>';
    return html;
  }
  function mountCategories(ctx, state) {
    const key = state.selectedCategory;
    const cnv = document.getElementById('c-scatter');
    if (!key || !cnv) return;
    const [family, level] = key.split('|');
    const c = colors();
    const members = ctx.rows.filter((r) => r.family === family && r.level === level && !r.reducedPay);
    const pts = (sex) => members.filter((r) => r.sex === sex).map((r) => ({ x: +r.tenure.toFixed(2), y: r.base, name: state.showNames ? r.name : r.id }));
    chart(cnv, {
      type: 'scatter',
      data: { datasets: [
        { label: 'Women', data: pts('F'), backgroundColor: c.F, borderColor: c.surface, borderWidth: 2, pointRadius: 6, pointHoverRadius: 8 },
        { label: 'Men', data: pts('M'), backgroundColor: c.M, borderColor: c.surface, borderWidth: 2, pointRadius: 6, pointHoverRadius: 8 },
      ] },
      options: {
        scales: { x: { title: { display: true, text: 'Tenure (years)' } }, y: { title: { display: true, text: 'Salary (FTE)' }, ticks: { callback: (v) => ctx.money(v, true) } } },
        plugins: { tooltip: { callbacks: { label: (it) => it.raw.name + ': ' + ctx.money(it.raw.y) + ', ' + it.raw.x.toFixed(1) + ' yrs' } } },
      },
    });
  }

  // ---------------- Bands ----------------
  const BINS = [[0, 0.85, '<85%'], [0.85, 0.9, '85–90%'], [0.9, 0.95, '90–95%'], [0.95, 1, '95–100%'], [1, 1.05, '100–105%'], [1.05, 1.1, '105–110%'], [1.1, 1.15, '110–115%'], [1.15, 9, '>115%']];
  function bandsTab(ctx, state) {
    const b = ctx.bandSummary;
    const filter = state.bandFilter || 'below';
    const list = b.rows.filter((r) => (filter === 'all' ? r.status !== 'within' : r.status === filter));
    const ov = PT.bands.overlaps(state.ds.bands, ctx.ent.id, state.filters.year, state.ds.levels);
    const ovFam = Array.from(new Set(ov.map((o) => o.family)));
    const ovRows = ovFam.map((f) => { const o = { family: ctx.names.family(f) }; ov.filter((x) => x.family === f).forEach((x) => { o[x.from + '→' + x.to] = x.pct; }); return o; });
    const ovCols = [{ key: 'family', label: 'Job family' }].concat(ov.filter((x) => x.family === ovFam[0]).map((x) => ({ key: x.from + '→' + x.to, label: x.from + '→' + x.to, cls: 'num', fmt: (v) => pct(v, 0) })));
    const gapCompa = (b.medianCompa.M - b.medianCompa.F) * 100;
    return '<div class="tiles">' +
      tile('Below band minimum', num(b.below), pct(b.pctBelow) + ' of people · ' + b.belowF + ' women, ' + b.belowM + ' men', null, b.below ? 'risk' : 'good') +
      tile('Above band maximum', num(b.above), 'Review for red-circling') +
      tile('Median compa-ratio', '<div class="split"><span><i class="dot f"></i>' + pct(b.medianCompa.F * 100, 0) + '</span><span><i class="dot m"></i>' + pct(b.medianCompa.M * 100, 0) + '</span></div>', 'Women · Men (' + (gapCompa >= 0 ? '+' : '') + gapCompa.toFixed(1) + ' pts for men)', TIPS.compa, toneFor(gapCompa)) +
      tile('Cost to reach minimum', ctx.money(b.costToMin), 'Annual, before on-costs') +
      '</div><div class="grid" style="margin-top:16px">' +
      '<section class="card span-7"><div class="card-head"><h2>Where people sit in their band</h2>' + info(TIPS.compa) + '</div><div class="chart-box"><canvas id="c-compa" role="img" aria-label="Compa-ratio distribution for women and men"></canvas></div></section>' +
      '<section class="card span-5"><div class="card-head"><h2>What this means</h2></div>' + insightList(pickInsights(ctx, ['bands'])) + '</section>' +
      '<section class="card span-12"><div class="card-head"><h2>Out-of-band employees</h2><span class="spacer"></span>' +
      '<label class="sub">Show <select data-band-filter>' + [['below', 'Below minimum'], ['above', 'Above maximum'], ['all', 'Both']].map(([v, l]) => '<option value="' + v + '"' + (filter === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>' +
      '<button type="button" class="btn" data-export="bands">Export CSV</button></div>' +
      table(list, [
        { key: 'id', label: 'ID' }, nameCol(state), { key: 'sex', label: 'Sex' },
        { key: 'family', label: 'Family', fmt: (v) => esc(ctx.names.family(v)) }, { key: 'level', label: 'Level' }, { key: 'hireDate', label: 'Hired' },
        { key: 'base', label: 'Salary', cls: 'num', fmt: (v) => ctx.money(v) },
        { key: 'band', label: 'Band', cls: 'num', fmt: (v) => ctx.money(v.min) + '–' + ctx.money(v.max) },
        { key: 'compa', label: 'Compa', cls: 'num', fmt: (v) => pct(v * 100, 0) },
      ], { empty: 'No one ' + (filter === 'above' ? 'above maximum' : 'below minimum') + ' in this selection.' }) + '</section>' +
      '<section class="card span-12"><div class="card-head"><h2>Band overlap between adjacent levels</h2>' + info('Share of a level\'s range that sits above the next level\'s minimum. High overlap (over ~50%) blurs progression and makes pay harder to justify.') + '</div>' +
      table(ovRows, ovCols) + '</section></div>';
  }
  function mountBands(ctx) {
    const c = colors();
    const rows = ctx.bandSummary.rows;
    const count = (sex) => BINS.map(([lo, hi]) => rows.filter((r) => r.sex === sex && r.compa >= lo && r.compa < hi).length);
    chart(document.getElementById('c-compa'), {
      type: 'bar',
      data: { labels: BINS.map((x) => x[2]), datasets: [
        { label: 'Women', data: count('F'), backgroundColor: c.F, borderColor: c.surface, borderWidth: 2, borderRadius: 4, maxBarThickness: 22 },
        { label: 'Men', data: count('M'), backgroundColor: c.M, borderColor: c.surface, borderWidth: 2, borderRadius: 4, maxBarThickness: 22 },
      ] },
      options: { scales: { x: { grid: { display: false }, title: { display: true, text: 'Compa-ratio (salary ÷ band midpoint)' } }, y: { title: { display: true, text: 'People' }, ticks: { precision: 0 } } } },
    });
  }

  // ---------------- Scenarios ----------------
  function scenarioInputs(state) {
    return state.scenarioInputs || (state.scenarioInputs = { raiseToMin: true, closeCategories: true, targetGap: 2, compaFloorOn: false, compaFloor: 90, budgetOn: false, budget: 150000, name: '' });
  }
  function runScenario(ctx, state) {
    const s = scenarioInputs(state);
    const rows = PT.model.rows(state.ds, { entity: state.filters.entity, year: state.filters.year });
    return PT.scenarios.run(rows, {
      raiseToMin: s.raiseToMin, closeCategories: s.closeCategories, targetGap: Number(s.targetGap) || 0,
      compaFloor: s.compaFloorOn ? Number(s.compaFloor) / 100 : null, budget: s.budgetOn ? Number(s.budget) : null,
    }, { minN: ctx.minN, threshold: ctx.threshold, onCostRate: ctx.ent.onCostRate, fitOpts: ctx.fitOpts });
  }
  function scenariosTab(ctx, state) {
    const s = scenarioInputs(state);
    const res = runScenario(ctx, state);
    state.lastScenario = res;
    const cb = (k, on) => '<input type="checkbox" data-sc="' + k + '"' + (on ? ' checked' : '') + '>';
    const delta = (b, a, digits = 1) => { const d = a - b; if (isNaN(d) || Math.abs(d) < 0.05) return '<span class="sub">no change</span>'; const good = d < 0; return '<span class="' + (good ? 'delta-good' : 'delta-bad') + '">' + (d > 0 ? '▲ +' : '▼ ') + d.toFixed(digits) + (digits ? ' pts' : '') + '</span>'; };
    const B = res.before, A = res.after;
    const cmp = [
      { m: 'Mean hourly pay gap', b: pct(B.meanGap), a: pct(A.meanGap), d: delta(B.meanGap, A.meanGap) },
      { m: 'Median hourly pay gap', b: pct(B.medianGap), a: pct(A.medianGap), d: delta(B.medianGap, A.medianGap) },
      { m: 'Adjusted gap', b: pct(B.adjustedGap), a: pct(A.adjustedGap), d: delta(B.adjustedGap, A.adjustedGap) },
      { m: 'Categories needing action', b: B.flagged, a: A.flagged, d: delta(B.flagged, A.flagged, 0) },
      { m: 'People below band minimum', b: B.belowMin, a: A.belowMin, d: delta(B.belowMin, A.belowMin, 0) },
    ];
    const entityRows = state.scenarios.filter((x) => x.entity === ctx.ent.id && x.year === state.filters.year);
    return '<p class="lede">Model the cost of closing gaps for <strong>' + esc(ctx.ent.name) + '</strong> at the ' + state.filters.year + ' snapshot. Strategies apply in order, and every metric is recalculated from scratch on the adjusted salaries. Costs are annual and include ' + Math.round(ctx.ent.onCostRate * 100) + '% assumed employer on-costs.</p>' +
      '<div class="grid"><section class="card span-5"><div class="card-head"><h2>Strategy</h2></div><div class="form-grid">' +
      '<label class="check">' + cb('raiseToMin', s.raiseToMin) + '<span><strong>A. Raise to band minimum</strong><br><span class="sub">Everyone below their band minimum is moved to it.</span></span></label>' +
      '<label class="check">' + cb('closeCategories', s.closeCategories) + '<span><strong>B. Close flagged categories</strong><br><span class="sub">Uplift the lower-paid sex where the unexplained gap is ' + ctx.threshold + '%+.</span></span>' +
      '<span class="opts">Target gap <input type="number" min="0" max="5" step="0.5" data-sc="targetGap" value="' + esc(s.targetGap) + '">%</span></label>' +
      '<label class="check">' + cb('compaFloorOn', s.compaFloorOn) + '<span><strong>C. Compa-ratio floor</strong><br><span class="sub">Raise anyone below the floor, lowest first.</span></span>' +
      '<span class="opts">Floor <input type="number" min="80" max="100" step="1" data-sc="compaFloor" value="' + esc(s.compaFloor) + '">% of midpoint</span></label>' +
      '<label class="check">' + cb('budgetOn', s.budgetOn) + '<span><strong>Budget cap</strong><br><span class="sub">Stop when the budget runs out (A first, then B, then C).</span></span>' +
      '<span class="opts">' + esc(ctx.ent.currency) + ' <input type="number" min="0" step="10000" data-sc="budget" value="' + esc(s.budget) + '" style="width:120px"></span></label>' +
      '<div class="row-actions"><input type="text" data-sc="name" placeholder="Scenario name" value="' + esc(s.name) + '" aria-label="Scenario name" style="flex:1;min-width:140px"><button type="button" class="btn primary" data-action="save-scenario">Save scenario</button></div>' +
      '</div></section>' +
      '<section class="card span-7"><div class="card-head"><h2>Result</h2>' + (res.budgetExhausted ? '<span class="badge warn">Budget fully used</span>' : '') + '</div>' +
      '<div class="tiles">' +
      tile('Annual cost', ctx.money(res.totalCost), pct(res.pctPayroll, 2) + ' of payroll') +
      tile('People receiving an uplift', num(res.affected.total), res.affected.F + ' women · ' + res.affected.M + ' men') +
      tile('Adjusted gap after', pct(A.adjustedGap), 'from ' + pct(B.adjustedGap), TIPS.adjusted, toneFor(A.adjustedGap)) +
      '</div><div class="chart-box" style="margin-top:14px;height:220px"><canvas id="c-scen" role="img" aria-label="Pay gap measures before and after the scenario"></canvas></div>' +
      table(cmp, [{ key: 'm', label: 'Measure' }, { key: 'b', label: 'Before', cls: 'num' }, { key: 'a', label: 'After', cls: 'num' }, { key: 'd', label: 'Change', cls: 'num', fmt: (v) => v }]) +
      '<div style="margin-top:12px">' + table(res.steps, [{ key: 'label', label: 'Step' }, { key: 'people', label: 'People', cls: 'num' }, { key: 'cost', label: 'Cost', cls: 'num', fmt: (v) => ctx.money(v) }], { empty: 'Select at least one strategy.' }) + '</div>' +
      '<div class="row-actions" style="margin-top:10px"><button type="button" class="btn" data-export="changes">Export individual uplifts (CSV)</button></div></section>' +
      '<section class="card span-12"><div class="card-head"><h2>Saved scenarios</h2><span class="sub">' + esc(state.adapter.mode === 'Google Sheets' ? 'Stored in the Scenarios sheet' : 'Stored in this browser') + '</span></div>' +
      table(entityRows, [
        { key: 'name', label: 'Name' }, { key: 'summary', label: 'Strategy' },
        { key: 'totalCost', label: 'Cost', cls: 'num', fmt: (v) => ctx.money(v) },
        { key: 'after', label: 'Adjusted gap after', cls: 'num', fmt: (v) => pct(v.adjustedGap) },
        { key: 'after', label: 'Median gap after', cls: 'num', fmt: (v) => pct(v.medianGap) },
        { key: 'name', label: '', fmt: (v) => '<button type="button" class="link-btn" data-delete-scenario="' + esc(v) + '">Delete</button>' },
      ], { empty: 'No saved scenarios for this entity and year yet.' }) + '</section></div>';
  }
  function mountScenarios(ctx, state) {
    const res = state.lastScenario, c = colors();
    if (!res) return;
    const labels = ['Mean gap', 'Median gap', 'Adjusted gap'];
    const k = ['meanGap', 'medianGap', 'adjustedGap'];
    chart(document.getElementById('c-scen'), {
      type: 'bar',
      data: { labels, datasets: [
        { label: 'Before', data: k.map((x) => res.before[x]), backgroundColor: c.before, borderColor: c.surface, borderWidth: 2, borderRadius: 4, maxBarThickness: 28 },
        { label: 'After', data: k.map((x) => res.after[x]), backgroundColor: c.after, borderColor: c.surface, borderWidth: 2, borderRadius: 4, maxBarThickness: 28 },
      ] },
      options: { indexAxis: 'y', scales: { x: { ticks: { callback: (v) => v + '%' } }, y: { grid: { display: false } } },
        plugins: { tooltip: { callbacks: { label: (it) => it.dataset.label + ': ' + it.parsed.x.toFixed(1) + '%' } } } },
    });
  }

  // ---------------- Ranges ----------------
  function rangesTab(ctx, state) {
    const ds = state.ds;
    const r = state.rangeInputs || (state.rangeInputs = { family: 'ENG', level: 'L3', mode: 'hiring', location: '' });
    const locs = ctx.ent.locations.split('|');
    const loc = r.location && locs.indexOf(r.location) >= 0 ? r.location : locs[0];
    const band = ds.index.band[[state.filters.year, ctx.ent.id, r.family, r.level].join('|')];
    const range = PT.bands.advertRange(band, r.mode);
    const title = (ds.employees.find((e) => e.family === r.family && e.level === r.level) || {}).title || '';
    const text = 'Salary: ' + ctx.money(range.lo) + ' – ' + ctx.money(range.hi) + ' per year (full-time equivalent), depending on skills and experience.' +
      (r.mode === 'hiring' ? ' Our full pay band for this role runs to ' + ctx.money(band.max) + ', with progression based on published criteria.' : '') +
      '\n\nFernvale Systems sets pay using objective, gender-neutral criteria: skills, effort, responsibility and working conditions. We will not ask about your current or previous salary.';
    state.rangeText = text;
    const sel = (key, opts, val) => '<select data-range="' + key + '">' + opts.map(([v, l]) => '<option value="' + esc(v) + '"' + (v === val ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select>';
    return '<p class="lede">For talent partners: generate a salary range for a job advert from the governed pay band, so every advert is consistent and defensible. The EU Directive requires candidates to be told the starting pay or range before interview, and bans questions about pay history.</p>' +
      '<div class="grid"><section class="card span-5"><div class="card-head"><h2>Role</h2></div><div class="form-grid">' +
      '<label class="sub">Job family ' + sel('family', ds.families.map((f) => [f.id, f.name]), r.family) + '</label>' +
      '<label class="sub">Level ' + sel('level', ds.levels.map((l) => [l.id, l.id + ' ' + l.name]), r.level) + '</label>' +
      (locs.length > 1 ? '<label class="sub">Location ' + sel('location', locs.map((l) => [l, l]), loc) + '</label>' : '') +
      '<label class="sub">Range to advertise ' + sel('mode', [['hiring', 'Hiring range (minimum to midpoint)'], ['full', 'Full band (minimum to maximum)']], r.mode) + '</label>' +
      '<div class="tiles" style="grid-template-columns:repeat(3,1fr)">' +
      '<div class="tile"><div class="label">Minimum</div><div class="value" style="font-size:18px">' + ctx.money(band.min) + '</div></div>' +
      '<div class="tile"><div class="label">Midpoint</div><div class="value" style="font-size:18px">' + ctx.money(band.mid) + '</div></div>' +
      '<div class="tile"><div class="label">Maximum</div><div class="value" style="font-size:18px">' + ctx.money(band.max) + '</div></div></div>' +
      '<p class="sub">Bands are entity-wide; location is shown for the advert only.</p></div></section>' +
      '<section class="card span-7"><div class="card-head"><h2>Advert text</h2><span class="sub">' + esc(title + ' · ' + loc) + '</span><span class="spacer"></span><button type="button" class="btn" data-action="copy-range">Copy</button></div>' +
      '<div class="letter" id="range-text">' + esc(text) + '</div></section></div>';
  }

  // ---------------- View contract ----------------
  const BUILDERS = { overview, drivers, categories, bands: bandsTab, scenarios: scenariosTab, ranges: rangesTab };
  const MOUNTERS = { overview: mountOverview, drivers: mountDrivers, categories: mountCategories, bands: mountBands, scenarios: mountScenarios };

  function html(ctx, state) {
    const tabs = '<div class="tabs" role="tablist">' + TABS.map(([id, label]) => '<button type="button" role="tab" data-tab="' + id + '" aria-selected="' + (state.tab === id) + '">' + label + '</button>').join('') + '</div>';
    const scopedNote = state.tab === 'scenarios' && ctx.filtered ? '<p class="sub" style="margin-bottom:10px">Scenarios always run on the whole entity; family, level and location filters are ignored here.</p>' : '';
    return tabs + scopedNote + BUILDERS[state.tab](ctx, state) + disclaimer();
  }
  function disclaimer() {
    return '<p class="disclaimer">Fictional data for demonstration. Calculations follow the published UK gender pay gap method and the EU Pay Transparency Directive (EU) 2023/970 in simplified form. This is not legal advice.</p>';
  }

  function mount(ctx, state, main) {
    if (MOUNTERS[state.tab]) MOUNTERS[state.tab](ctx, state);
    main.onclick = (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.tab) { state.tab = t.dataset.tab; PT.render(); }
      else if (t.dataset.goto) { state.tab = t.dataset.goto; PT.render(); }
      else if (t.dataset.cat) { state.selectedCategory = state.selectedCategory === t.dataset.cat ? null : t.dataset.cat; PT.render(); }
      else if (t.dataset.metric) { state.catMetric = t.dataset.metric; PT.render(); }
      else if (t.dataset.export) exportCsv(t.dataset.export, ctx, state);
      else if (t.dataset.action === 'save-scenario') saveScenario(ctx, state);
      else if (t.dataset.deleteScenario) state.adapter.deleteScenario(t.dataset.deleteScenario).then((list) => { state.scenarios = list; PT.render(); });
      else if (t.dataset.action === 'copy-range') {
        const done = () => { t.textContent = 'Copied'; setTimeout(() => { t.textContent = 'Copy'; }, 1500); };
        if (navigator.clipboard) navigator.clipboard.writeText(state.rangeText).then(done, () => {}); else done();
      }
    };
    main.onchange = (e) => {
      const t = e.target;
      if (t.dataset.sc) { const s = scenarioInputs(state); s[t.dataset.sc] = t.type === 'checkbox' ? t.checked : t.value; if (t.dataset.sc !== 'name') PT.render(); }
      else if (t.dataset.range) { state.rangeInputs[t.dataset.range] = t.value; PT.render(); }
      else if ('bandFilter' in t.dataset) { state.bandFilter = t.value; PT.render(); }
    };
    main.oninput = (e) => { if (e.target.dataset.sc === 'name') scenarioInputs(state).name = e.target.value; };
  }

  function saveScenario(ctx, state) {
    const s = scenarioInputs(state);
    const res = state.lastScenario;
    const name = (s.name || '').trim() || 'Option ' + String.fromCharCode(65 + state.scenarios.filter((x) => x.entity === ctx.ent.id).length);
    const parts = [s.raiseToMin && 'A', s.closeCategories && 'B (' + s.targetGap + '%)', s.compaFloorOn && 'C (' + s.compaFloor + '%)', s.budgetOn && 'cap ' + ctx.money(Number(s.budget))].filter(Boolean);
    const record = { name, entity: ctx.ent.id, year: state.filters.year, summary: parts.join(' + ') || 'None', inputs: Object.assign({}, s), totalCost: res.totalCost, pctPayroll: res.pctPayroll, before: res.before, after: res.after, savedAt: new Date().toISOString() };
    state.adapter.saveScenario(record).then((list) => { state.scenarios = list; s.name = ''; PT.render(); });
  }

  function exportCsv(kind, ctx, state) {
    const fname = (x) => 'fernvale-' + ctx.ent.id.toLowerCase() + '-' + state.filters.year + '-' + x + '.csv';
    if (kind === 'cats') {
      downloadCsv(fname('categories'), ctx.cats.map((c) => Object.assign({}, c, { familyName: ctx.names.family(c.family) })), [
        { key: 'familyName', label: 'Job family' }, { key: 'level', label: 'Level' }, { key: 'nF', label: 'Women' }, { key: 'nM', label: 'Men' },
        { key: 'raw', label: 'Raw gap %', csv: (v) => (v == null || isNaN(v) ? '' : v.toFixed(2)) },
        { key: 'unexplained', label: 'Unexplained gap %', csv: (v) => (v == null || isNaN(v) ? '' : v.toFixed(2)) }, { key: 'status', label: 'Status' }]);
    } else if (kind === 'bands') {
      const f = state.bandFilter || 'below';
      downloadCsv(fname('out-of-band'), ctx.bandSummary.rows.filter((r) => (f === 'all' ? r.status !== 'within' : r.status === f)), [
        { key: 'id', label: 'ID' }].concat(nameCsv(state), [{ key: 'sex', label: 'Sex' }, { key: 'family', label: 'Family' }, { key: 'level', label: 'Level' },
        { key: 'hireDate', label: 'Hire date' }, { key: 'base', label: 'Salary' }, { key: 'band', label: 'Band min', csv: (v) => v.min }, { key: 'band', label: 'Band max', csv: (v) => v.max },
        { key: 'compa', label: 'Compa-ratio', csv: (v) => v.toFixed(3) }, { key: 'status', label: 'Status' }]));
    } else if (kind === 'changes' && state.lastScenario) {
      downloadCsv(fname('scenario-uplifts'), state.lastScenario.changes, [
        { key: 'id', label: 'ID' }].concat(nameCsv(state), [{ key: 'sex', label: 'Sex' }, { key: 'family', label: 'Family' }, { key: 'level', label: 'Level' },
        { key: 'from', label: 'Salary before' }, { key: 'to', label: 'Salary after' }, { key: 'to', label: 'Uplift', csv: (v, r) => r.to - r.from }]));
    }
  }

  PT.views.analyst = { html, mount, TIPS, tile };
})(typeof globalThis !== 'undefined' ? globalThis : this);
