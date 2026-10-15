/**
 * Data model: normalises a raw dataset (from the generator or from Google Sheets)
 * and produces analysis rows for one entity + snapshot year.
 */
(function (global) {
  'use strict';
  const PT = global.PT || (global.PT = {});

  const NUM = ['baseSalary', 'fte', 'weeklyHours', 'bonus12m', 'perfRating', 'year', 'min', 'mid', 'max',
    'standardHours', 'onCostRate', 'headcount', 'rank', 'bonusTarget', 'seed', 'suppressionThreshold', 'categoryThreshold'];
  const BOOL = ['reducedPay'];

  /** Sheets returns strings/dates; coerce everything into the generator's types. */
  function normalise(raw) {
    const fix = (o) => {
      const r = Object.assign({}, o);
      NUM.forEach((k) => { if (k in r && r[k] !== '' && r[k] !== null) r[k] = Number(r[k]); });
      BOOL.forEach((k) => { if (k in r) r[k] = r[k] === true || r[k] === 'TRUE' || r[k] === 'true'; });
      ['hireDate', 'leaveDate'].forEach((k) => {
        if (r[k] instanceof Date) r[k] = r[k].toISOString().slice(0, 10);
        else if (r[k]) r[k] = String(r[k]).slice(0, 10);
      });
      return r;
    };
    const ds = {
      config: fix(raw.config || {}),
      entities: (raw.entities || []).map(fix),
      families: raw.families || [],
      levels: (raw.levels || []).map(fix),
      bands: (raw.bands || []).map(fix),
      employees: (raw.employees || []).map(fix),
      compensation: (raw.compensation || []).map(fix),
    };
    ds.years = String(ds.config.snapshotYears || '2024|2025|2026').split('|').map(Number);
    ds.index = {
      entity: Object.fromEntries(ds.entities.map((e) => [e.id, e])),
      family: Object.fromEntries(ds.families.map((f) => [f.id, f])),
      level: Object.fromEntries(ds.levels.map((l) => [l.id, l])),
      employee: Object.fromEntries(ds.employees.map((e) => [e.id, e])),
      band: Object.fromEntries(ds.bands.map((b) => [[b.year, b.entity, b.family, b.level].join('|'), b])),
    };
    return ds;
  }

  function snapshotDate(ds, year) {
    return new Date(year + '-' + (ds.config.snapshotDay || '04-05') + 'T00:00:00Z');
  }

  /**
   * Analysis rows for an entity/year, optionally filtered by family, level, location.
   * One row per relevant employee at the snapshot date.
   */
  function rows(ds, f) {
    const ent = ds.index.entity[f.entity];
    const snap = snapshotDate(ds, f.year);
    const out = [];
    for (const c of ds.compensation) {
      if (c.year !== f.year) continue;
      const e = ds.index.employee[c.employeeId];
      if (!e || e.entity !== f.entity) continue;
      if (f.family && e.family !== f.family) continue;
      if (f.level && e.level !== f.level) continue;
      if (f.location && e.location !== f.location) continue;
      const hired = new Date(e.hireDate + 'T00:00:00Z');
      out.push({
        id: e.id, name: e.name, sex: e.sex, entity: e.entity, location: e.location,
        family: e.family, level: e.level, title: e.title, hireDate: e.hireDate,
        hireYear: hired.getUTCFullYear(),
        tenure: Math.max(0, (snap - hired) / (365.25 * 864e5)),
        base: c.baseSalary, fte: c.fte, weeklyHours: c.weeklyHours, bonus: c.bonus12m,
        perf: c.perfRating, reducedPay: c.reducedPay,
        stdHours: ent.standardHours,
        band: ds.index.band[[f.year, e.entity, e.family, e.level].join('|')],
      });
    }
    return out;
  }

  /** Hourly rate of ordinary pay: full-time-equivalent salary / standard annual hours. */
  function hourly(r) { return r.base / (r.stdHours * 52); }

  PT.model = { normalise, rows, hourly, snapshotDate };
})(typeof globalThis !== 'undefined' ? globalThis : this);
