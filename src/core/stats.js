/** Small, dependency-free statistics helpers. */
(function (global) {
  'use strict';
  const PT = global.PT || (global.PT = {});

  function sum(xs) { let s = 0; for (const x of xs) s += x; return s; }
  function mean(xs) { return xs.length ? sum(xs) / xs.length : NaN; }
  function median(xs) {
    if (!xs.length) return NaN;
    const s = xs.slice().sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  /** Invert a square matrix (Gauss–Jordan with partial pivoting). Returns null if singular. */
  function invert(A) {
    const n = A.length;
    const M = A.map((row, i) => row.concat(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))));
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-12) return null;
      [M[c], M[p]] = [M[p], M[c]];
      const piv = M[c][c];
      for (let j = 0; j < 2 * n; j++) M[c][j] /= piv;
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = M[r][c];
        if (f === 0) continue;
        for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j];
      }
    }
    return M.map((row) => row.slice(n));
  }

  /**
   * Ordinary least squares. X: n×p (include an intercept column yourself), y: n.
   * Returns { beta, se, residuals, r2, n, p } or null if X'X is singular.
   */
  function ols(X, y) {
    const n = X.length, p = X[0].length;
    const XtX = Array.from({ length: p }, () => new Array(p).fill(0));
    const Xty = new Array(p).fill(0);
    for (let i = 0; i < n; i++) {
      const xi = X[i];
      for (let a = 0; a < p; a++) {
        Xty[a] += xi[a] * y[i];
        for (let b = a; b < p; b++) XtX[a][b] += xi[a] * xi[b];
      }
    }
    for (let a = 0; a < p; a++) for (let b = 0; b < a; b++) XtX[a][b] = XtX[b][a];
    const inv = invert(XtX);
    if (!inv) return null;
    const beta = inv.map((row) => row.reduce((s, v, j) => s + v * Xty[j], 0));
    const residuals = X.map((xi, i) => y[i] - xi.reduce((s, v, j) => s + v * beta[j], 0));
    const sse = sum(residuals.map((r) => r * r));
    const ybar = mean(y);
    const sst = sum(y.map((v) => (v - ybar) ** 2));
    const sigma2 = sse / Math.max(1, n - p);
    const se = inv.map((row, j) => Math.sqrt(Math.max(0, row[j] * sigma2)));
    return { beta, se, residuals, r2: sst ? 1 - sse / sst : 0, n, p };
  }

  /** Least-squares straight line through (x, y) points. */
  function linearFit(xs, ys) {
    const mx = mean(xs), my = mean(ys);
    let num = 0, den = 0;
    xs.forEach((x, i) => { num += (x - mx) * (ys[i] - my); den += (x - mx) ** 2; });
    const slope = den ? num / den : 0;
    return { slope, intercept: my - slope * mx };
  }

  PT.stats = { sum, mean, median, invert, ols, linearFit };
})(typeof globalThis !== 'undefined' ? globalThis : this);
