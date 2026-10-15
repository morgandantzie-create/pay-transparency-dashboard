/** Small-group suppression: never show an aggregate that could identify an individual. */
(function (global) {
  'use strict';
  const PT = global.PT || (global.PT = {});

  /** True when every group in `counts` meets the minimum size. */
  function canShow(counts, minN) {
    return counts.every((c) => c >= minN);
  }

  /** Category averages by sex for the Employee view (Directive right to information). */
  function categoryAverages(rows, family, level, minN) {
    const g = rows.filter((r) => r.family === family && r.level === level && (r.sex === 'F' || r.sex === 'M'));
    const F = g.filter((r) => r.sex === 'F'), M = g.filter((r) => r.sex === 'M');
    if (!canShow([F.length, M.length], minN)) {
      return { suppressed: true, nF: F.length, nM: M.length, minN };
    }
    const avg = (xs) => xs.reduce((s, r) => s + r.base, 0) / xs.length;
    return { suppressed: false, nF: F.length, nM: M.length, avgF: avg(F), avgM: avg(M) };
  }

  PT.privacy = { canShow, categoryAverages };
})(typeof globalThis !== 'undefined' ? globalThis : this);
