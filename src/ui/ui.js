/** UI helpers: formatting, escaping, tooltips, CSV export, chart theming. */
(function (global) {
  'use strict';
  const PT = global.PT || (global.PT = {});

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = (x, d = 1) => (x == null || isNaN(x) ? '–' : x.toFixed(d) + '%');
  const num = (x, d = 0) => (x == null || isNaN(x) ? '–' : x.toLocaleString('en-GB', { maximumFractionDigits: d, minimumFractionDigits: d }));
  function money(x, currency, compact, decimals) {
    if (x == null || isNaN(x)) return '–';
    const opts = { style: 'currency', currency: currency || 'GBP', maximumFractionDigits: decimals || 0, minimumFractionDigits: decimals || 0 };
    if (compact && Math.abs(x) >= 10000) { opts.notation = 'compact'; opts.maximumFractionDigits = 1; }
    return new Intl.NumberFormat(currency === 'EUR' ? 'de-DE' : 'en-GB', opts).format(x);
  }

  function info(text) {
    return '<button type="button" class="info" aria-label="' + esc(text) + '" data-tip="' + esc(text) + '">i</button>';
  }

  const TONE_LABEL = { risk: 'Action', watch: 'Watch', good: 'On track', info: 'Note' };
  const TONE_ICON = { risk: '!', watch: '◐', good: '✓', info: 'i' };
  function insightList(items) {
    if (!items.length) return '';
    return '<ul class="insights">' + items.map((i) =>
      '<li class="insight tone-' + i.tone + '"><span class="tone-badge" aria-label="' + TONE_LABEL[i.tone] + '">' + TONE_ICON[i.tone] + ' ' + TONE_LABEL[i.tone] + '</span>' +
      '<div><strong>' + esc(i.title) + '</strong><p>' + esc(i.text) + '</p></div></li>').join('') + '</ul>';
  }

  /** Render a simple table; columns: [{ key, label, fmt?, cls? }]. Returns HTML. */
  function table(rows, columns, opts) {
    opts = opts || {};
    const head = '<thead><tr>' + columns.map((c) => '<th scope="col" class="' + (c.cls || '') + '">' + esc(c.label) + '</th>').join('') + '</tr></thead>';
    const body = '<tbody>' + (rows.length ? rows.map((r) => '<tr>' + columns.map((c) => '<td class="' + (c.cls || '') + '">' + (c.fmt ? c.fmt(r[c.key], r) : esc(r[c.key])) + '</td>').join('') + '</tr>').join('')
      : '<tr><td colspan="' + columns.length + '" class="empty">' + esc(opts.empty || 'Nothing to show for this selection.') + '</td></tr>') + '</tbody>';
    return '<div class="table-wrap"><table>' + (opts.caption ? '<caption>' + esc(opts.caption) + '</caption>' : '') + head + body + '</table></div>';
  }

  function downloadCsv(filename, rows, columns) {
    const q = (v) => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const csv = [columns.map((c) => q(c.label)).join(',')].concat(rows.map((r) => columns.map((c) => q(c.csv ? c.csv(r[c.key], r) : r[c.key])).join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- Charts ----------
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const live = [];
  function destroyCharts() { while (live.length) live.pop().destroy(); }

  function chart(canvas, config) {
    if (!global.Chart || !canvas) return null;
    const ink2 = css('--text-secondary'), muted = css('--text-muted'), grid = css('--grid');
    global.Chart.defaults.font.family = css('--font');
    global.Chart.defaults.color = ink2;
    const base = {
      responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
      plugins: {
        legend: { position: 'top', align: 'start', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'rectRounded', color: ink2 } },
        tooltip: { backgroundColor: css('--surface-inverse'), titleColor: css('--text-inverse'), bodyColor: css('--text-inverse'), padding: 10, cornerRadius: 6, displayColors: true, boxPadding: 4 },
      },
      scales: {},
    };
    const cfg = Object.assign({}, config);
    cfg.options = deepMerge(base, config.options || {});
    Object.values(cfg.options.scales || {}).forEach((s) => {
      s.grid = Object.assign({ color: grid, drawTicks: false }, s.grid || {});
      s.border = Object.assign({ color: css('--axis') }, s.border || {});
      s.ticks = Object.assign({ color: muted, padding: 6 }, s.ticks || {});
    });
    const c = new global.Chart(canvas, cfg);
    live.push(c);
    return c;
  }
  function deepMerge(a, b) {
    const out = Object.assign({}, a);
    Object.keys(b).forEach((k) => {
      out[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' ? deepMerge(a[k], b[k]) : b[k];
    });
    return out;
  }
  const colors = () => ({
    F: css('--series-f'), M: css('--series-m'), neutral: css('--text-muted'), ink: css('--text-primary'),
    critical: css('--status-critical'), good: css('--status-good'), before: css('--series-before'), after: css('--series-after'),
    surface: css('--surface-1'),
  });

  PT.views = PT.views || {};
  PT.ui = { esc, pct, num, money, info, insightList, table, downloadCsv, chart, destroyCharts, colors, css };
})(typeof globalThis !== 'undefined' ? globalThis : this);
