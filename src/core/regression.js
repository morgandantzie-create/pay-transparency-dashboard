/**
 * Adjusted ("unexplained") pay gap.
 *
 * Model: ln(hourly pay) = b0 + b_female·Female + level + family + location + b_t·tenure + b_p·performance + e
 *
 * - Adjusted gap = (1 − exp(b_female)) × 100: the gap between a woman and a man with the
 *   same level, family, location, tenure and rating.
 * - Decomposition: mean ln pay(M) − mean ln pay(F) = Σ_k b_k (x̄_M,k − x̄_F,k) − b_female.
 *   Because the model has an intercept and a Female dummy, residuals average to zero in
 *   each sex, so the decomposition is exact.
 */
(function (global) {
  'use strict';
  const PT = global.PT || (global.PT = {});
  const { mean, ols } = PT.stats;

  const GROUP_LABEL = { level: 'Level', family: 'Job family', location: 'Location', tenure: 'Tenure', perf: 'Performance rating' };

  function fit(rows, opts) {
    opts = opts || {};
    const data = rows.filter((r) => (r.sex === 'F' || r.sex === 'M') && !r.reducedPay);
    const nF = data.filter((r) => r.sex === 'F').length;
    const nM = data.length - nF;
    if (nF < 5 || nM < 5) return { ok: false, reason: 'Fewer than 5 women or men in this selection.' };

    // Build columns. Reference category = most common value (dropped).
    const cols = [{ name: 'Intercept', group: 'intercept', get: () => 1 }, { name: 'Female', group: 'female', get: (r) => (r.sex === 'F' ? 1 : 0) }];
    const addDummies = (field, group, label) => {
      const counts = {};
      data.forEach((r) => { counts[r[field]] = (counts[r[field]] || 0) + 1; });
      const values = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
      values.slice(1).forEach((v) => cols.push({ name: label(v), group, value: v, get: (r) => (r[field] === v ? 1 : 0) }));
      return values[0];
    };
    const ref = {
      level: addDummies('level', 'level', (v) => 'Level ' + v),
      family: addDummies('family', 'family', (v) => (opts.familyName ? opts.familyName(v) : v)),
      location: addDummies('location', 'location', (v) => v),
    };
    cols.push({ name: 'Tenure (years, capped at 10)', group: 'tenure', get: (r) => Math.min(10, r.tenure) });
    cols.push({ name: 'Performance rating', group: 'perf', get: (r) => r.perf });

    const X = data.map((r) => cols.map((c) => c.get(r)));
    const y = data.map((r) => Math.log(PT.model.hourly(r)));
    if (data.length < cols.length + 10) return { ok: false, reason: 'Not enough people to fit the model for this selection.' };
    const res = ols(X, y);
    if (!res) return { ok: false, reason: 'Model could not be fitted for this selection (factors are collinear).' };

    const iF = 1;
    const bF = res.beta[iF], seF = res.se[iF];
    const coefficients = cols.map((c, j) => ({
      name: c.name, group: c.group, beta: res.beta[j], se: res.se[j],
      effectPct: (Math.exp(res.beta[j]) - 1) * 100,
    }));

    // Decomposition by factor group
    const isF = data.map((r) => r.sex === 'F');
    const colMean = (j, female) => mean(X.filter((_, i) => isF[i] === female).map((x) => x[j]));
    const contributions = {};
    cols.forEach((c, j) => {
      if (c.group === 'intercept' || c.group === 'female') return;
      contributions[c.group] = (contributions[c.group] || 0) + res.beta[j] * (colMean(j, false) - colMean(j, true));
    });
    const rawLog = mean(y.filter((_, i) => !isF[i])) - mean(y.filter((_, i) => isF[i]));
    const decomposition = Object.keys(GROUP_LABEL)
      .filter((g) => g in contributions)
      .map((g) => ({ group: g, label: GROUP_LABEL[g], logPoints: contributions[g] }));
    decomposition.push({ group: 'unexplained', label: 'Unexplained', logPoints: -bF });

    // Pay net of legitimate factors (keeps the sex effect + residual) — used for category analysis
    const adjusted = {};
    data.forEach((r, i) => {
      const legit = cols.reduce((s, c, j) => (c.group === 'female' || c.group === 'intercept' ? s : s + X[i][j] * res.beta[j]), 0);
      adjusted[r.id] = y[i] - legit;
    });

    return {
      ok: true, n: data.length, nF, nM, r2: res.r2, reference: ref,
      adjustedGap: (1 - Math.exp(bF)) * 100,
      ci: [(1 - Math.exp(bF + 1.96 * seF)) * 100, (1 - Math.exp(bF - 1.96 * seF)) * 100],
      significant: Math.abs(bF / seF) > 1.96,
      rawLogGap: rawLog, decomposition, coefficients, adjusted,
    };
  }

  PT.regression = { fit, GROUP_LABEL };
})(typeof globalThis !== 'undefined' ? globalThis : this);
