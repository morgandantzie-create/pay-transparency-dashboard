/**
 * Gender pay gap metrics.
 *
 * Statutory (UK GPG, Equality Act 2010 (Gender Pay Gap Information) Regulations 2017):
 *   mean & median hourly pay gap, mean & median bonus gap,
 *   proportion of men / women receiving a bonus, pay quartiles.
 * Gaps are expressed as (men − women) / men × 100. Positive = women paid less.
 *
 * Simplifications for the demo are listed in docs/TESTING.md.
 */
(function (global) {
  'use strict';
  const PT = global.PT || (global.PT = {});
  const { mean, median } = PT.stats;
  const hourly = (r) => PT.model.hourly(r);

  function gap(m, f) { return m ? ((m - f) / m) * 100 : NaN; }
  const binary = (rows) => rows.filter((r) => r.sex === 'F' || r.sex === 'M');

  /** Splits a sorted list into four groups of near-equal size (lower → upper). */
  function quartileGroups(sorted) {
    const n = sorted.length, base = Math.floor(n / 4), rem = n % 4;
    const out = []; let i = 0;
    for (let q = 0; q < 4; q++) {
      const size = base + (q < rem ? 1 : 0);
      out.push(sorted.slice(i, i + size)); i += size;
    }
    return out;
  }

  function statutory(rows) {
    const relevant = binary(rows);
    const fullPay = relevant.filter((r) => !r.reducedPay); // "full-pay relevant employees"
    const hF = fullPay.filter((r) => r.sex === 'F').map(hourly);
    const hM = fullPay.filter((r) => r.sex === 'M').map(hourly);

    const bonusF = relevant.filter((r) => r.sex === 'F');
    const bonusM = relevant.filter((r) => r.sex === 'M');
    const paidF = bonusF.filter((r) => r.bonus > 0).map((r) => r.bonus);
    const paidM = bonusM.filter((r) => r.bonus > 0).map((r) => r.bonus);

    const sorted = fullPay.slice().sort((a, b) => hourly(a) - hourly(b));
    const quartiles = quartileGroups(sorted).map((g, i) => {
      const f = g.filter((r) => r.sex === 'F').length;
      return {
        name: ['Lower', 'Lower middle', 'Upper middle', 'Upper'][i],
        n: g.length, f, m: g.length - f,
        pctF: g.length ? (f / g.length) * 100 : NaN,
        pctM: g.length ? ((g.length - f) / g.length) * 100 : NaN,
      };
    });

    return {
      meanHourlyGap: gap(mean(hM), mean(hF)),
      medianHourlyGap: gap(median(hM), median(hF)),
      meanBonusGap: gap(mean(paidM), mean(paidF)),
      medianBonusGap: gap(median(paidM), median(paidF)),
      pctFReceivingBonus: bonusF.length ? (paidF.length / bonusF.length) * 100 : NaN,
      pctMReceivingBonus: bonusM.length ? (paidM.length / bonusM.length) * 100 : NaN,
      quartiles,
      meanHourly: { F: mean(hF), M: mean(hM) },
      medianHourly: { F: median(hF), M: median(hM) },
      counts: {
        total: rows.length, relevant: relevant.length, fullPay: fullPay.length,
        F: bonusF.length, M: bonusM.length,
        excludedReducedPay: relevant.length - fullPay.length,
        excludedNotBinary: rows.length - relevant.length,
      },
    };
  }

  /**
   * Bonus gap if bonuses were full-time equivalent — isolates the part-time effect.
   */
  function fteBonusGap(rows) {
    const b = binary(rows).filter((r) => r.bonus > 0);
    const f = b.filter((r) => r.sex === 'F').map((r) => r.bonus / r.fte);
    const m = b.filter((r) => r.sex === 'M').map((r) => r.bonus / r.fte);
    return { mean: gap(mean(m), mean(f)), median: gap(median(m), median(f)) };
  }

  /**
   * EU Directive-style category analysis: gap per category of worker (family × level).
   * `adjusted` (optional) maps employee id → log pay net of legitimate factors, from regression.
   */
  function categoryGaps(rows, opts) {
    const minN = opts.minN, threshold = opts.threshold, adjusted = opts.adjusted || {};
    const groups = {};
    binary(rows).filter((r) => !r.reducedPay).forEach((r) => {
      const k = r.family + '|' + r.level;
      (groups[k] = groups[k] || []).push(r);
    });
    return Object.keys(groups).map((k) => {
      const g = groups[k];
      const [family, level] = k.split('|');
      const F = g.filter((r) => r.sex === 'F'), M = g.filter((r) => r.sex === 'M');
      const cell = { key: k, family, level, n: g.length, nF: F.length, nM: M.length };
      if (F.length < minN || M.length < minN) return Object.assign(cell, { status: 'suppressed' });
      const meanF = mean(F.map(hourly)), meanM = mean(M.map(hourly));
      const raw = gap(meanM, meanF);
      let unexplained = NaN;
      const aF = F.map((r) => adjusted[r.id]).filter((v) => v !== undefined);
      const aM = M.map((r) => adjusted[r.id]).filter((v) => v !== undefined);
      if (aF.length && aM.length) unexplained = (1 - Math.exp(mean(aF) - mean(aM))) * 100;
      let status = 'ok';
      if (Math.abs(raw) >= threshold) {
        status = !isNaN(unexplained) && Math.abs(unexplained) < threshold ? 'explained' : 'flag';
      }
      return Object.assign(cell, { meanF, meanM, raw, unexplained, status });
    });
  }

  PT.metrics = { statutory, categoryGaps, fteBonusGap, gap, quartileGroups };
})(typeof globalThis !== 'undefined' ? globalThis : this);
