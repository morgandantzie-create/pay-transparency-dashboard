/** Pay band governance: compa-ratio, range penetration, out-of-band, overlap, advert ranges. */
(function (global) {
  'use strict';
  const PT = global.PT || (global.PT = {});
  const { mean, median } = PT.stats;

  function position(r) {
    const b = r.band;
    if (!b) return null;
    const compa = r.base / b.mid;
    const penetration = (r.base - b.min) / (b.max - b.min);
    const status = r.base < b.min ? 'below' : r.base > b.max ? 'above' : 'within';
    return { compa, penetration, status, shortfall: Math.max(0, b.min - r.base) };
  }

  function summary(rows) {
    const enriched = rows.filter((r) => r.band).map((r) => Object.assign({}, r, position(r)));
    const below = enriched.filter((r) => r.status === 'below');
    const above = enriched.filter((r) => r.status === 'above');
    const bySex = (list, s) => list.filter((r) => r.sex === s);
    const hireYears = {};
    below.forEach((r) => { hireYears[r.hireYear] = (hireYears[r.hireYear] || 0) + 1; });
    return {
      rows: enriched,
      n: enriched.length,
      below: below.length, above: above.length,
      pctBelow: enriched.length ? (below.length / enriched.length) * 100 : 0,
      belowF: bySex(below, 'F').length, belowM: bySex(below, 'M').length,
      medianCompa: { all: median(enriched.map((r) => r.compa)), F: median(bySex(enriched, 'F').map((r) => r.compa)), M: median(bySex(enriched, 'M').map((r) => r.compa)) },
      meanCompa: { F: mean(bySex(enriched, 'F').map((r) => r.compa)), M: mean(bySex(enriched, 'M').map((r) => r.compa)) },
      belowHireYears: hireYears,
      costToMin: below.reduce((s, r) => s + r.shortfall * r.fte, 0),
    };
  }

  /** Overlap between adjacent levels within a family: share of level L's range above level L+1's minimum. */
  function overlaps(bands, entity, year, levels) {
    const out = [];
    const families = Array.from(new Set(bands.filter((b) => b.entity === entity && b.year === year).map((b) => b.family)));
    families.forEach((family) => {
      const fb = levels.map((l) => bands.find((b) => b.entity === entity && b.year === year && b.family === family && b.level === l.id)).filter(Boolean);
      for (let i = 0; i < fb.length - 1; i++) {
        const lo = fb[i], hi = fb[i + 1];
        const pct = Math.max(0, (lo.max - hi.min) / (lo.max - lo.min)) * 100;
        out.push({ family, from: lo.level, to: hi.level, pct });
      }
    });
    return out;
  }

  /** Salary range for a job advert, from the governed band. */
  function advertRange(band, mode) {
    const lo = band.min, hi = mode === 'hiring' ? band.mid : band.max;
    return { lo, hi };
  }

  PT.bands = { position, summary, overlaps, advertRange };
})(typeof globalThis !== 'undefined' ? globalThis : this);
