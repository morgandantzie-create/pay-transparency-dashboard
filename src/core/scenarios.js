/**
 * Remediation scenario engine.
 *
 * Strategies run in order, each on the output of the previous one:
 *   A. Raise everyone below band minimum to the minimum.
 *   B. Close flagged categories: uplift the lower-paid sex so the category's
 *      unexplained gap falls to the target.
 *   C. Compa-ratio floor: raise anyone below the floor, lowest compa-ratio first.
 * An optional budget cap stops spending once reached (the last uplift is partial).
 * All metrics are then recalculated from scratch on the adjusted salaries.
 */
(function (global) {
  'use strict';
  const PT = global.PT || (global.PT = {});

  function analyse(rows, opts) {
    const reg = PT.regression.fit(rows, opts.fitOpts);
    const stat = PT.metrics.statutory(rows);
    const cats = PT.metrics.categoryGaps(rows, { minN: opts.minN, threshold: opts.threshold, adjusted: reg.ok ? reg.adjusted : {} });
    const bands = PT.bands.summary(rows);
    return {
      meanGap: stat.meanHourlyGap, medianGap: stat.medianHourlyGap,
      adjustedGap: reg.ok ? reg.adjustedGap : NaN,
      flagged: cats.filter((c) => c.status === 'flag').length,
      belowMin: bands.below, cats, reg,
    };
  }

  /**
   * @param rows analysis rows (entity + year)
   * @param s    { raiseToMin, closeCategories, targetGap, compaFloor (e.g. 0.9 or null), budget (number|null) }
   * @param opts { minN, threshold, onCostRate }
   */
  function run(rows, s, opts) {
    const work = rows.map((r) => Object.assign({}, r));
    const byId = Object.fromEntries(work.map((r) => [r.id, r]));
    const original = Object.fromEntries(rows.map((r) => [r.id, r.base]));
    let budgetLeft = s.budget > 0 ? s.budget : Infinity;
    const steps = [];

    // Annual cost of an uplift (actual pay, so pro-rated by FTE, plus employer on-cost)
    const costOf = (r, delta) => delta * r.fte * (1 + opts.onCostRate);

    function apply(r, newBase, step) {
      let delta = newBase - r.base;
      if (delta <= 0 || budgetLeft <= 0) return false;
      const c = costOf(r, delta);
      if (c > budgetLeft) delta = budgetLeft / (r.fte * (1 + opts.onCostRate));
      r.base = Math.round(r.base + delta);
      budgetLeft -= costOf(r, delta);
      step.people.add(r.id);
      step.cost += costOf(r, delta);
      return true;
    }
    const newStep = (key, label) => { const st = { key, label, people: new Set(), cost: 0 }; steps.push(st); return st; };

    if (s.raiseToMin) {
      const st = newStep('min', 'Raise to band minimum');
      work.filter((r) => r.band && r.base < r.band.min)
        .sort((a, b) => PT.bands.position(a).penetration - PT.bands.position(b).penetration)
        .forEach((r) => apply(r, r.band.min, st));
    }

    if (s.closeCategories) {
      const st = newStep('cat', 'Close flagged categories to ' + s.targetGap + '%');
      const a = analyse(work, opts);
      const targetLog = -Math.log(1 - s.targetGap / 100);
      a.cats.filter((c) => c.status === 'flag' && !isNaN(c.unexplained))
        .sort((x, y) => Math.abs(y.unexplained) - Math.abs(x.unexplained))
        .forEach((c) => {
          const gapLog = Math.abs(-Math.log(1 - c.unexplained / 100));
          if (gapLog <= targetLog) return;
          const lowerSex = c.unexplained > 0 ? 'F' : 'M';
          const factor = Math.exp(gapLog - targetLog);
          work.filter((r) => r.family === c.family && r.level === c.level && r.sex === lowerSex && !r.reducedPay)
            .forEach((r) => apply(r, r.base * factor, st));
        });
    }

    if (s.compaFloor) {
      const st = newStep('floor', 'Compa-ratio floor ' + Math.round(s.compaFloor * 100) + '%');
      work.filter((r) => r.band && r.base / r.band.mid < s.compaFloor)
        .sort((a, b) => a.base / a.band.mid - b.base / b.band.mid)
        .forEach((r) => apply(r, r.band.mid * s.compaFloor, st));
    }

    const before = analyse(rows, opts);
    const after = analyse(work, opts);
    const payroll = rows.reduce((t, r) => t + r.base * r.fte, 0) * (1 + opts.onCostRate);
    const changed = work.filter((r) => r.base !== original[r.id]);
    const totalCost = steps.reduce((t, st) => t + st.cost, 0);

    return {
      steps: steps.map((st) => ({ key: st.key, label: st.label, people: st.people.size, cost: st.cost })),
      totalCost,
      pctPayroll: payroll ? (totalCost / payroll) * 100 : 0,
      affected: { total: changed.length, F: changed.filter((r) => r.sex === 'F').length, M: changed.filter((r) => r.sex === 'M').length },
      budgetExhausted: s.budget > 0 && budgetLeft <= 1,
      before: strip(before), after: strip(after),
      changes: changed.map((r) => ({ id: r.id, name: r.name, sex: r.sex, family: r.family, level: r.level, from: original[r.id], to: r.base })),
    };
  }

  function strip(a) {
    return { meanGap: a.meanGap, medianGap: a.medianGap, adjustedGap: a.adjustedGap, flagged: a.flagged, belowMin: a.belowMin };
  }

  PT.scenarios = { run, analyse };
})(typeof globalThis !== 'undefined' ? globalThis : this);
