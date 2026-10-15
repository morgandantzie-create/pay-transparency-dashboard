/**
 * Fernvale Systems — seeded synthetic workforce generator.
 *
 * Everything here is fictional. The same seed always produces the same dataset,
 * so demos, tests and the Google Sheet stay in sync.
 *
 * Output shape (also the Google Sheets schema — one sheet per key):
 *   config, entities, families, levels, bands, employees, compensation
 */
(function (global) {
  'use strict';
  const PT = global.PT || (global.PT = {});

  // ---------- PRNG ----------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeRng(seed) {
    const r = mulberry32(seed);
    const rng = {
      next: r,
      int: (lo, hi) => lo + Math.floor(r() * (hi - lo + 1)),
      pick: (arr) => arr[Math.floor(r() * arr.length)],
      normal: (mu = 0, sd = 1) => {
        const u = 1 - r(), v = r();
        return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      },
      weighted: (weights) => {
        const total = weights.reduce((s, w) => s + w, 0);
        let x = r() * total;
        for (let i = 0; i < weights.length; i++) { x -= weights[i]; if (x <= 0) return i; }
        return weights.length - 1;
      },
    };
    return rng;
  }

  // ---------- Reference data ----------
  const SNAPSHOT_YEARS = [2024, 2025, 2026];
  const SNAPSHOT_DAY = '04-05'; // UK private-sector snapshot date: 5 April

  const ENTITIES = [
    { id: 'UK', name: 'Fernvale Systems Ltd', country: 'United Kingdom', currency: 'GBP', regime: 'UK_GPG', standardHours: 37.5, onCostRate: 0.15, headcount: 320, locations: 'London|Manchester' },
    { id: 'DE', name: 'Fernvale Systems GmbH', country: 'Germany', currency: 'EUR', regime: 'EU_DIRECTIVE', standardHours: 40, onCostRate: 0.21, headcount: 160, locations: 'Berlin' },
  ];

  const FAMILIES = [
    { id: 'ENG', name: 'Engineering', premium: 1.15, weight: 0.32, femaleShare: 0.28 },
    { id: 'DAT', name: 'Data', premium: 1.12, weight: 0.10, femaleShare: 0.38 },
    { id: 'PRD', name: 'Product & Design', premium: 1.08, weight: 0.12, femaleShare: 0.50 },
    { id: 'COM', name: 'Commercial', premium: 1.00, weight: 0.16, femaleShare: 0.45 },
    { id: 'CSX', name: 'Customer Success', premium: 0.88, weight: 0.16, femaleShare: 0.62 },
    { id: 'OPS', name: 'Operations & People', premium: 0.90, weight: 0.14, femaleShare: 0.66 },
  ];

  const LEVELS = [
    { id: 'L1', name: 'Associate', rank: 1, midUK: 32000, weight: 0.10, femaleMod: 1.15, bonusTarget: 0.05, spread: 0.15 },
    { id: 'L2', name: 'Specialist', rank: 2, midUK: 42000, weight: 0.22, femaleMod: 1.10, bonusTarget: 0.05, spread: 0.15 },
    { id: 'L3', name: 'Senior', rank: 3, midUK: 56000, weight: 0.27, femaleMod: 1.00, bonusTarget: 0.08, spread: 0.15 },
    { id: 'L4', name: 'Lead', rank: 4, midUK: 72000, weight: 0.20, femaleMod: 0.95, bonusTarget: 0.10, spread: 0.20 },
    { id: 'L5', name: 'Principal / Manager', rank: 5, midUK: 92000, weight: 0.12, femaleMod: 0.85, bonusTarget: 0.12, spread: 0.20 },
    { id: 'L6', name: 'Director', rank: 6, midUK: 120000, weight: 0.06, femaleMod: 0.70, bonusTarget: 0.15, spread: 0.20 },
    { id: 'L7', name: 'Executive', rank: 7, midUK: 165000, weight: 0.03, femaleMod: 0.60, bonusTarget: 0.20, spread: 0.20 },
  ];

  const CURRENCY_FACTOR = { UK: 1, DE: 1.05 };
  const LOCATION_EFFECT = { London: 0.04, Manchester: -0.05, Berlin: 0 };
  const ANNUAL_INCREASE = 0.035; // pay drift between snapshots
  const BAND_DRIFT = 0.03;
  const PERF_WEIGHTS = [0.04, 0.16, 0.5, 0.24, 0.06]; // ratings 1..5
  const PERF_BONUS_MULT = [0, 0.5, 1, 1.25, 1.5];

  const NAMES = {
    UK: {
      F: ['Amelia', 'Priya', 'Chloe', 'Grace', 'Aisha', 'Hannah', 'Sophie', 'Zara', 'Ellie', 'Freya', 'Maya', 'Ruth', 'Imogen', 'Nia', 'Lucy', 'Fatima', 'Rosa', 'Holly', 'Megan', 'Isla', 'Joanne', 'Kemi', 'Leah', 'Bethan'],
      M: ['Oliver', 'James', 'Arjun', 'Tom', 'Kwame', 'Harry', 'Daniel', 'Samir', 'Owen', 'Callum', 'Rhys', 'Ben', 'Marcus', 'Ethan', 'Luca', 'Hamza', 'Joseph', 'Adam', 'Rory', 'Felix', 'Nathan', 'Tobi', 'George', 'Ewan'],
      X: ['Alex', 'Sam', 'Jordan', 'Robin'],
      last: ['Ashworth', 'Bennett', 'Chowdhury', 'Davies', 'Ellison', 'Fraser', 'Gallagher', 'Hughes', 'Iqbal', 'Jennings', 'Kaur', 'Lawson', 'Mensah', 'Norris', 'Okafor', 'Patel', 'Quinn', 'Reid', 'Shah', 'Thornton', 'Underwood', 'Vaughan', 'Whitlock', 'Yates', 'Adeyemi', 'Brennan', 'Carver', 'Dunmore', 'Ferris', 'Holloway'],
    },
    DE: {
      F: ['Lena', 'Anna', 'Sophie', 'Mia', 'Leonie', 'Katharina', 'Elif', 'Johanna', 'Marie', 'Clara', 'Nina', 'Selin', 'Paula', 'Greta', 'Lea', 'Ida'],
      M: ['Lukas', 'Jonas', 'Felix', 'Max', 'Paul', 'Emre', 'Niklas', 'Tobias', 'Jan', 'Moritz', 'David', 'Kai', 'Florian', 'Sebastian', 'Mehmet', 'Ole'],
      X: ['Kim', 'Luca'],
      last: ['Albrecht', 'Brandt', 'Demir', 'Engel', 'Fischer', 'Graf', 'Hartmann', 'Jung', 'Keller', 'Lorenz', 'Möller', 'Neumann', 'Osterberg', 'Pohl', 'Richter', 'Seidel', 'Thalberg', 'Vogt', 'Winkler', 'Yilmaz', 'Ziegler', 'Busch'],
    },
  };

  const round500 = (x) => Math.round(x / 500) * 500;
  const round100 = (x) => Math.round(x / 100) * 100;

  function isoDate(d) { return d.toISOString().slice(0, 10); }
  function snapshotDate(year) { return new Date(year + '-' + SNAPSHOT_DAY + 'T00:00:00Z'); }
  function yearsBetween(a, b) { return (b - a) / (365.25 * 864e5); }

  // ---------- Bands ----------
  function buildBands() {
    const bands = [];
    for (const year of SNAPSHOT_YEARS) {
      const drift = Math.pow(1 + BAND_DRIFT, year - 2026);
      for (const ent of ENTITIES) {
        for (const fam of FAMILIES) {
          for (const lvl of LEVELS) {
            const mid = round500(lvl.midUK * fam.premium * CURRENCY_FACTOR[ent.id] * drift);
            bands.push({
              year, entity: ent.id, family: fam.id, level: lvl.id,
              min: round500(mid * (1 - lvl.spread)), mid, max: round500(mid * (1 + lvl.spread)),
            });
          }
        }
      }
    }
    return bands;
  }

  // ---------- Story knobs ----------
  // Each knob is a deliberate, documented pattern so the demo has findings to surface.
  const STORY = {
    baseFemaleEffect: -0.008,            // small residual gap everywhere
    cohort2023FemaleEffect: -0.08,       // offer-stage effect for women hired in 2023
    hotspot: { entity: 'UK', family: 'ENG', level: 'L4', femaleEffect: -0.07, femaleShare: 0.35 },
    explained: { entity: 'UK', family: 'COM', level: 'L3', maleTenureBonus: 3, malePerfBonus: 1 },
    persona: { entity: 'DE', family: 'ENG', level: 'L3', femaleShare: 0.4 }, // enough women for Lena's category averages to show
    yearlyCatchUp: 0.012,                // gap narrows ~1.2pts a year
  };

  // ---------- Employees ----------
  function generate(seed) {
    seed = seed || 20261015;
    const rng = makeRng(seed);
    const bands = buildBands();
    const bandIndex = {};
    bands.forEach((b) => { bandIndex[[b.year, b.entity, b.family, b.level].join('|')] = b; });

    const employees = [];
    const compensation = [];
    const usedNames = new Set();
    let seq = 0;

    function makeName(ent, sex) {
      const pool = NAMES[ent];
      for (let i = 0; i < 50; i++) {
        const n = rng.pick(pool[sex]) + ' ' + rng.pick(pool.last);
        if (!usedNames.has(n)) { usedNames.add(n); return n; }
      }
      const n = rng.pick(pool[sex]) + ' ' + rng.pick(pool.last) + '-' + rng.pick(pool.last);
      usedNames.add(n);
      return n;
    }

    for (const ent of ENTITIES) {
      const locations = ent.locations.split('|');
      for (const fam of FAMILIES) {
        for (const lvl of LEVELS) {
          const isHotspot = ent.id === STORY.hotspot.entity && fam.id === STORY.hotspot.family && lvl.id === STORY.hotspot.level;
          const isExplained = ent.id === STORY.explained.entity && fam.id === STORY.explained.family && lvl.id === STORY.explained.level;
          const count = Math.max(1, Math.round(ent.headcount * fam.weight * lvl.weight));
          let share = Math.min(0.9, fam.femaleShare * lvl.femaleMod * (ent.id === 'DE' && lvl.rank >= 4 ? 1.3 : 1));
          if (isHotspot) share = STORY.hotspot.femaleShare;
          if (ent.id === STORY.persona.entity && fam.id === STORY.persona.family && lvl.id === STORY.persona.level) share = STORY.persona.femaleShare;
          const nF = Math.round(count * share);

          for (let i = 0; i < count; i++) {
            let sex = i < nF ? 'F' : 'M';
            if (rng.next() < 0.012) sex = 'X'; // not disclosed / non-binary — excluded from binary statutory metrics
            const location = locations.length > 1 ? (rng.next() < 0.68 ? locations[0] : locations[1]) : locations[0];

            // Tenure: seniors tend to have been here longer
            let tenure = Math.min(11, Math.max(0.1, rng.normal(1.5 + lvl.rank * 0.6, 1.8)));
            if (isExplained && sex === 'M') tenure = Math.min(11, tenure + STORY.explained.maleTenureBonus);
            const hire = new Date(snapshotDate(2026).getTime() - tenure * 365.25 * 864e5);
            // Story: a 2023 hiring cohort. Push a share of women hires into 2023.
            let hireDate = hire;
            if (sex === 'F' && rng.next() < 0.18 && lvl.rank <= 4) {
              hireDate = new Date(Date.UTC(2023, rng.int(0, 11), rng.int(1, 28)));
            }

            let perf = rng.weighted(PERF_WEIGHTS) + 1;
            if (isExplained && sex === 'M') perf = Math.min(5, perf + STORY.explained.malePerfBonus);

            const id = ent.id + '-' + String(1000 + ++seq);
            const fte = (sex === 'F' ? rng.next() < 0.14 : rng.next() < 0.03) ? rng.pick([0.6, 0.8]) : 1;
            // "Unique" personal noise, stable across years
            const personal = rng.normal(0, 0.06);

            employees.push({
              id, name: makeName(ent.id, sex), sex, entity: ent.id, location,
              family: fam.id, level: lvl.id, title: jobTitle(fam, lvl),
              hireDate: isoDate(hireDate), leaveDate: '', fte,
              _perf: perf, _personal: personal, _hotspot: isHotspot,
            });
          }
        }
      }

      // Leavers: people who appear in earlier snapshots only
      const leavers = Math.round(ent.headcount * 0.14);
      for (let i = 0; i < leavers; i++) {
        const fam = FAMILIES[rng.weighted(FAMILIES.map((f) => f.weight))];
        const lvl = LEVELS[rng.weighted(LEVELS.map((l) => l.weight))];
        const share = Math.min(0.9, fam.femaleShare * lvl.femaleMod);
        const sex = rng.next() < share ? 'F' : 'M';
        const leave = new Date(Date.UTC(rng.pick([2024, 2025]), rng.int(4, 11), rng.int(1, 28)));
        const hire = new Date(Date.UTC(rng.int(2017, 2023), rng.int(0, 11), rng.int(1, 28)));
        const id = ent.id + '-' + String(1000 + ++seq);
        employees.push({
          id, name: makeName(ent.id, sex), sex, entity: ent.id,
          location: locations.length > 1 && rng.next() > 0.68 ? locations[1] : locations[0],
          family: fam.id, level: lvl.id, title: jobTitle(fam, lvl),
          hireDate: isoDate(hire), leaveDate: isoDate(leave), fte: 1,
          _perf: rng.weighted(PERF_WEIGHTS) + 1, _personal: rng.normal(0, 0.045), _hotspot: false,
        });
      }
    }

    // ---------- Compensation per snapshot ----------
    for (const emp of employees) {
      const ent = ENTITIES.find((e) => e.id === emp.entity);
      const lvl = LEVELS.find((l) => l.id === emp.level);
      for (const year of SNAPSHOT_YEARS) {
        const snap = snapshotDate(year);
        const hired = new Date(emp.hireDate + 'T00:00:00Z');
        if (hired > snap) continue;
        if (emp.leaveDate && new Date(emp.leaveDate + 'T00:00:00Z') <= snap) continue;

        const band = bandIndex[[year, emp.entity, emp.family, emp.level].join('|')];
        const tenure = Math.min(8, yearsBetween(hired, snap));
        let perf = emp._perf;
        if (year !== 2026) perf = Math.max(1, Math.min(5, perf + rng.pick([-1, 0, 0, 0, 1])));

        let logPay = Math.log(band.mid)
          + LOCATION_EFFECT[emp.location]
          + 0.022 * (tenure - 3)
          + 0.03 * (perf - 3)
          + emp._personal;

        if (emp.sex === 'F') {
          const catchUp = STORY.yearlyCatchUp * (2026 - year);
          logPay += STORY.baseFemaleEffect - catchUp;
          if (emp._hotspot) logPay += STORY.hotspot.femaleEffect;
          if (hired.getUTCFullYear() === 2023) logPay += STORY.cohort2023FemaleEffect;
        }
        let base = Math.exp(logPay);
        base = Math.max(band.min * 0.86, Math.min(band.max * 1.04, base));
        base = round100(base);

        // Bonus paid in the 12 months to the snapshot date (pro-rated for part-time)
        const eligible = yearsBetween(hired, snap) >= 0.5;
        let bonus = 0;
        if (eligible) {
          bonus = base * emp.fte * lvl.bonusTarget * PERF_BONUS_MULT[perf - 1];
          if (emp.family === 'COM') bonus += base * emp.fte * (0.06 + 0.04 * (perf - 3)); // sales commission
          bonus = Math.max(0, round100(bonus));
        }

        // On reduced pay due to leave (maternity, long-term sick) at the snapshot date
        const reducedPay = rng.next() < (emp.sex === 'F' ? 0.03 : 0.006);

        compensation.push({
          employeeId: emp.id, year, baseSalary: base, fte: emp.fte,
          weeklyHours: +(ent.standardHours * emp.fte).toFixed(1),
          bonus12m: bonus, perfRating: perf, reducedPay,
        });
      }
    }

    // Named persona for the Employee view: a Senior Engineer in Berlin
    const lena = employees.find((e) => e.entity === 'DE' && e.family === 'ENG' && e.level === 'L3' && e.sex === 'F' && !e.leaveDate);
    if (lena) lena.name = 'Lena Hoffmann';

    const cleanEmployees = employees.map((e) => {
      const o = {};
      Object.keys(e).forEach((k) => { if (k[0] !== '_') o[k] = e[k]; });
      return o;
    });

    return {
      config: {
        company: 'Fernvale Systems', seed, generatedAt: '2026-10-15',
        snapshotYears: SNAPSHOT_YEARS.join('|'), snapshotDay: SNAPSHOT_DAY,
        suppressionThreshold: 5, analystMinGroup: 3, categoryThreshold: 5, defaultPersonaId: lena ? lena.id : '',
      },
      entities: ENTITIES.map((e) => Object.assign({}, e)),
      families: FAMILIES.map((f) => ({ id: f.id, name: f.name })),
      levels: LEVELS.map((l) => ({ id: l.id, name: l.name, rank: l.rank, bonusTarget: l.bonusTarget })),
      bands,
      employees: cleanEmployees,
      compensation,
    };
  }

  function jobTitle(fam, lvl) {
    if (lvl.rank === 6) return 'Director, ' + fam.name;
    if (lvl.rank === 7) return 'VP, ' + fam.name;
    const prefix = { 1: 'Associate', 2: '', 3: 'Senior', 4: 'Lead', 5: 'Principal' }[lvl.rank];
    return (prefix ? prefix + ' ' : '') + titleFor(fam.id);
  }

  function titleFor(fam) {
    return {
      ENG: 'Software Engineer', DAT: 'Data Analyst', PRD: 'Product Designer',
      COM: 'Account Executive', CSX: 'Customer Success Manager', OPS: 'Operations Partner',
    }[fam];
  }

  PT.generator = { generate, makeRng, SNAPSHOT_YEARS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
