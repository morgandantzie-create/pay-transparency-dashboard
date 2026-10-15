# Pay Transparency Dashboard — Specification (v0.1, draft for sign-off)

Portfolio project 1 of 5. Status: **approved 15 Oct 2026. v1 built 15 Oct 2026.**

---

## 1. Business problem

Organisations are under growing pressure to prove that pay is fair, explainable and reportable:

- **UK:** employers with 250+ employees must publish six gender pay gap metrics each year (Equality Act 2010 (Gender Pay Gap Information) Regulations 2017).
- **EU:** the Pay Transparency Directive (EU) 2023/970 adds pay-range disclosure to candidates, a ban on pay-history questions, a worker's right to request pay information, and gap reporting by *category of worker*. A gap of 5% or more in any category that is not justified by objective, gender-neutral criteria and not fixed within six months triggers a **joint pay assessment**.

In practice, HR and Reward teams pull this together from spreadsheets once a year, cannot explain *why* gaps exist, cannot cost the fix, and cannot answer an individual employee's question with confidence.

**Value the tool demonstrates:**

| Stakeholder | Before | After |
|---|---|---|
| Reward / HR analyst | Manual annual calculation, no root-cause view | Statutory metrics in seconds; raw vs adjusted gap; flagged categories |
| Leadership | Single headline number, no context | Trend, risk flags, costed remediation options |
| Employee | No visibility of where they sit | Their band, position in range, and category averages (as the Directive allows) |
| Talent acquisition | Ad-hoc salary ranges in adverts | Ranges generated from governed bands |

## 2. Scope

### In scope
1. Statutory UK gender pay gap metrics (all six).
2. EU Directive view: gap by category of worker (job family × level), the 5% flag, and a joint pay assessment checklist.
3. Adjusted ("unexplained") gap using regression on legitimate factors.
4. Pay band governance: out-of-band employees, compa-ratio, range penetration, band overlap.
5. Job architecture grid (job family × level).
6. Remediation scenario modeller with cost and post-fix gap.
7. Three audience views: Analyst, Leadership, Employee.
8. Generators for a salary range in a job advert and a pay information request response.
9. Three annual snapshots (2024, 2025, 2026) for trend analysis.
10. CSV export and a printable leadership report.

### Out of scope
- Real authentication or role-based security. The demo uses a persona switcher.
- Payroll or HRIS integrations.
- Legal advice. A disclaimer appears on every regulatory view.
- Non-binary or other gender categories in the statutory metrics. The regulations are binary. The data model allows other values, and these are excluded from those calculations with a note explaining why.
- Ethnicity and disability pay gaps. These are noted as a future extension.

## 3. Fictional organisation

**Fernvale Systems**: a fictional health-software company. All people and figures are synthetic.

| Entity | Location(s) | Headcount | Currency | Regime shown |
|---|---|---|---|---|
| Fernvale Systems Ltd | London, Manchester | ~320 | GBP | UK GPG (statutory) |
| Fernvale Systems GmbH | Berlin | ~160 | EUR | EU Directive view |

The two entities are reported separately, so currencies are never mixed.

- **Job families (6):** Engineering, Product & Design, Data, Commercial, Customer Success, Operations & People.
- **Levels (7):** L1 Associate → L7 Executive.

**A story built into the data**, so the demo has something to find:
- The raw UK median gap is about 17%, mainly because men are concentrated in senior and Engineering roles. This is a structural gap.
- The adjusted gap is about 3.5%.
- *Engineering L4* is around 7% and unexplained. *Commercial L3* is over 5% but explained by tenure and rating. A few small categories also flag, which shows why small-group caution matters.
- About 4% of employees are below their band minimum, and these are mostly women hired in 2023. This is a hiring-offer effect.
- The gap narrows over 2024 → 2026, but too slowly.

The data comes from a **seeded generator**, so it is identical on every run and can be regenerated.

## 4. Users and journeys

The persona switcher sits in the header. There is no login.

### 4.1 Priya — Reward Analyst (Analyst view)
1. Opens the dashboard on the Analyst view. The UK entity and 2026 snapshot are preselected.
2. Sees the six statutory metrics, each with an explanation on hover.
3. Opens **Gap drivers**: the raw gap breaks down into structural and unexplained parts, and a regression table shows the effect of each factor.
4. Opens **Categories**: a heatmap of job family × level, with Engineering L4 flagged in red.
5. Clicks the cell to see an anonymised pay scatter. Groups smaller than 5 are suppressed.
6. Opens **Bands**, filters to "below minimum", and exports the list as CSV.
7. Opens **Scenarios**, chooses "Bring all to band minimum" plus "Close flagged categories to <2%", and sees the cost (£ and % of payroll) and the new gap figures. Saves the result as "Option B".

### 4.2 David — CFO (Leadership view)
1. Sees KPI tiles: median gap, adjusted gap, flagged categories, out-of-band %, and the cost of the saved remediation options.
2. Views the 3-year trend line with a projection: "at current pace, adjusted gap reaches 0% in 2031".
3. Compares the saved scenarios side by side.
4. Prints or saves to PDF a one-page board summary.

### 4.3 Lena — Senior Engineer, Berlin (Employee view)
1. Picks her persona and sees her band (min, mid, max), her position in it and her compa-ratio.
2. Sees the average pay by sex for her category of worker. This view respects the n<5 suppression rule.
3. Previews **Request pay information**, a *Phase 2 planned add-on*. It generates a template request letter, and an HR toggle shows the matching template response with data filled in.

### 4.4 Tom — Talent Partner (inside the Analyst view)
1. Picks a job family, level and location.
2. Gets a governed salary range plus advert-ready text, for example: "£68,000–£82,000 depending on experience".

## 5. Functional requirements

| ID | Requirement | Acceptance criteria |
|---|---|---|
| F1 | Statutory metrics | Mean and median hourly pay gap, mean and median bonus gap, % of each sex receiving a bonus, and the quartile split, all match hand-calculated fixtures to 0.1% |
| F2 | Full-pay relevant employee filter | Employees on reduced pay due to leave on the snapshot date are excluded from the hourly pay metrics but included in the bonus metrics, per the regulations |
| F3 | Category gaps | A gap is calculated for every family × level cell; ≥5% is flagged as *explained* or *needs action*. In the analyst view, groups with fewer than 3 of either sex are suppressed and groups under 5 carry a warning; employee-facing views suppress groups under 5 |
| F4 | Adjusted gap | An OLS regression on log hourly pay with sex, level, family, location, tenure band and performance rating; reports the sex coefficient as a % and its confidence interval |
| F5 | Gap decomposition | Raw gap = explained + unexplained, shown as a waterfall chart |
| F6 | Band governance | Compa-ratio, range penetration, below min / above max counts, and overlap % between adjacent levels |
| F7 | Scenario modeller | Strategies can be combined: (a) raise to band minimum, (b) uplift a flagged category to a target gap, (c) a fixed budget cap applied lowest compa-ratio first. Outputs show cost, the number of people affected, and the gap before and after |
| F8 | Saved scenarios | Named scenarios persist in Sheets mode, or in localStorage in static mode |
| F9 | Filters | Entity, snapshot year, job family, level, location; these are global and update every chart |
| F10 | Trend | Three snapshots plus a linear projection |
| F11 | Employee view | Band position, compa-ratio and category averages, with suppression applied |
| F12 | Generators | Advert salary range (live). Pay information request and HR response letters are a **Phase 2 add-on**, shown as a labelled preview until use of named data, including any AI-assisted drafting, is approved |
| F13 | Export | CSV of any table; print stylesheet for the leadership report |
| F14 | Explainability | Every metric has an info tooltip giving its plain-English definition and formula |

**Non-functional requirements:**
- Initial load under 2 seconds in static mode.
- WCAG AA contrast.
- Keyboard-navigable.
- Responsive down to 375px.
- No external data calls apart from the chart library CDN.

## 5a. Data, names and AI governance

- **No AI in v1.** Every calculation, insight and letter is deterministic and runs in the browser or in Apps Script. No data is sent to any external service.
- **Names are hidden by default** in analyst tables, charts and CSV exports, which show employee IDs. A "Show names" switch reveals them. In a real deployment, that switch would sit behind approval from the data owner.
- **Data & AI notice.** A notice in the header states the above, and says that passing named employee data to any AI tool would need a documented lawful basis, a DPIA and sign-off from the data owner first.
- **Phase 2 gating.** Pay information request letters are labelled as a planned add-on. They would go live only after approval to use named employee data, including any AI-assisted drafting.

## 6. Architecture

```
pay-transparency-dashboard/
├── README.md
├── docs/            SPEC.md · DEPLOY.md · TESTING.md · screenshots/
├── src/
│   ├── core/        Pure JS, no DOM or Google APIs — the logic
│   │   ├── metrics.js      statutory + category gaps
│   │   ├── regression.js   OLS + decomposition
│   │   ├── bands.js        compa-ratio, penetration, overlap
│   │   ├── scenarios.js    remediation engine
│   │   └── privacy.js      small-group suppression
│   ├── data/
│   │   ├── generator.js    seeded synthetic data
│   │   └── fixtures/       generated JSON (static mode)
│   ├── adapters/
│   │   ├── static.js       reads JSON, saves to localStorage
│   │   └── sheets.js       google.script.run → Apps Script
│   └── ui/          index.html · styles.css · app.js · views/*.js
├── apps-script/     Code.gs (doGet + Sheets I/O) · appsscript.json
├── build/           build.js — bundles src/ into Apps Script HTML files
└── tests/           unit tests on core/ against hand-calculated fixtures
```

**Dual mode:** the same UI and core logic run in two places.
- **GitHub Pages (static):** the one-click public demo, using the generated JSON.
- **Apps Script web app:** reads from and writes to a Google Sheet in your personal Google account. This shows the Workspace integration.

The build script inlines the modules, because Apps Script's HtmlService does not support ES modules. clasp is used to push the code.

**Sheets schema:** `Employees`, `Compensation` (one row per employee per snapshot), `PayBands`, `JobArchitecture`, `Bonuses`, `Scenarios`, `Config`.

**Charts:** Chart.js, loaded from a CDN.

## 7. Testing

- **Unit:** each formula in `core/` is tested against a 10-person fixture whose answers are calculated by hand and documented in TESTING.md.
- **Data:** the generator is deterministic (same seed, same output), and the built-in story targets fall within tolerance.
- **Manual:** a scripted walkthrough of the four journeys in §4, plus filter combinations and edge cases (an empty category, a fully suppressed category, a zero-budget scenario).
- **Parity:** Sheets mode and static mode produce identical metrics for the same snapshot.

## 8. Separation from employer

- The project is built in a personal Google account with a new Sheet, and the repo is personal on GitHub.
- No code, data, naming, layouts or terminology are taken from any employer system.
- All data is synthetic and comes from the seeded generator.
- Regulatory logic is sourced only from public legislation and GOV.UK / EUR-Lex guidance. Sources are cited in the README.

## 9. Decisions

**Confirmed (15 Oct):**
- Both regimes are in scope: UK GPG and the EU Directive.
- All three audience views: Analyst, Leadership, Employee.
- The remediation scenario modeller is in scope.
- No further features to add.

**Confirmed (15 Oct):**
1. Fernvale Systems as the fictional company, shared across all five projects.
2. The EU entity is based in **Berlin (Germany)**, so it lines up with the jurisdictions in the Employment Law Reviewer.
3. Chart.js for charts.
4. GitHub Pages as the primary public demo link.
