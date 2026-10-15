# Testing

## 1. Automated tests
```bash
npm test               # 30 unit tests on src/core (tests/run.js)
node tests/parity.js   # Apps Script code against a mock SpreadsheetApp: Sheets mode = static mode
```
Both also run in GitHub Actions before every Pages deployment.

### Hand-calculated fixture
The fixture has 12 people. Standard hours are 37.5, so hourly pay = salary ÷ 1,950.

| ID | Sex | Hourly | Bonus (12m) | Notes |
|---|---|---|---|---|
| M1–M5 | M | 20, 25, 30, 35, 40 | 1000, 2000, 0, 3000, 4000 | |
| F1–F5 | F | 15, 21, 26, 31, 18 | 500, 0, 1000, 0, 1500 | |
| F6 | F | 50 | 1000 | On reduced pay due to leave: out of hourly figures, in bonus figures |
| X1 | X | 22 | 800 | Not recorded as F/M: out of binary measures |

**Hourly pay gaps**

| Measure | Men | Women | Gap |
|---|---|---|---|
| Mean | (20+25+30+35+40)/5 = **30** | (15+21+26+31+18)/5 = **22.2** | (30 − 22.2)/30 = **26.0%** |
| Median | **30** | 15, 18, **21**, 26, 31 → **21** | (30 − 21)/30 = **30.0%** |

**Bonus gaps** (recipients only)

| Measure | Men | Women | Gap |
|---|---|---|---|
| Recipients | 1000, 2000, 3000, 4000 | 500, 1000, 1500, 1000 (includes F6) | |
| Mean | **2500** | **1000** | **60%** |
| Median | **2500** | **1000** | **60%** |

**Proportion receiving a bonus**
- Women: 4 of 6 = **66.7%** (F6 is included)
- Men: 4 of 5 = **80%**

**Quartiles**

The 10 full-pay employees, sorted by hourly pay: 15F 18F 20M | 21F 25M 26F | 30M 31F | 35M 40M. The group sizes are 3/3/2/2.

| Quartile | Share of women |
|---|---|
| Lower | **66.7%** |
| Lower middle | **66.7%** |
| Upper middle | **50%** |
| Upper | **0%** |

**Regression check**

The test builds 40 synthetic rows with ln(pay) = ln 25 − 0.05·Female + 0.10·L4 + 0.01·tenure + 0.02·rating, with no noise.
- Expected adjusted gap: (1 − e^−0.05) × 100 = **4.877%**. It is recovered to within 1e-6.
- The decomposition terms must add up to the raw log gap exactly.

**Scenarios**
- Raising someone at 0.5 FTE from £38,000 to a £40,000 minimum, with a 10% on-cost, costs 2,000 × 0.5 × 1.1 = **£1,100**.
- With a budget cap, total spend never exceeds the cap.

**Generator and story**
- The same seed produces byte-identical JSON.
- These story findings hold:
  - UK adjusted gap between 2% and 5%
  - Engineering L4 flagged
  - Commercial L3 explained
  - Adjusted gap narrowing 2024 → 2026
  - Lena Hoffmann persona present

## 2. Manual walkthrough (about 10 minutes)
Run `npm run dev` and open <http://localhost:5180/ui/index.html>.

**Analyst: Priya, Reward Analyst**
- [ ] The **Statutory overview** shows six tiles. The badge reads *Statutory measures*.
- [ ] Set *Job family = Engineering*. The badge changes to *Filtered view: not the statutory figure*, and all tiles, charts and insight text update. Click *Clear filters*.
- [ ] Hover each ⓘ to see a plain-English definition.
- [ ] Open **Gap drivers**. The waterfall bars add up to the total. Level and job family explain most of it, and the red *Unexplained* bar matches the adjusted gap tile.
- [ ] Open **Categories of worker**. Engineering L4 shows ⚠ and Commercial L3 shows ✓. Switch between *Raw gap* and *Unexplained gap*.
- [ ] Click Engineering L4. The detail panel shows a scatter plot, the joint pay assessment checklist and a people list, with names shown as *Hidden*.
- [ ] Tick **Show names** in the filter bar. Names appear in the tables and in the scatter tooltips.
- [ ] Open **Pay bands**. The *Below minimum* table appears, and the insight says most of these people are women hired in 2023. *Export CSV* downloads a file, which includes names only if they are switched on.
- [ ] Open **Remediation scenarios**. With A and B ticked, categories needing action and people below minimum fall to 0. Tick *Budget cap* and set it to 20,000: *Budget fully used* appears and the cost is £20,000 or less.
- [ ] Name a scenario, click *Save*, reload the page, and check it's still there. Then delete it.
- [ ] Open **Job advert ranges**. Changing the family, level or mode updates the text, and *Copy* works.

**Leadership: David, CFO**
- [ ] KPI tiles are shown, and the trend chart has a dotted projection line.
- [ ] The top insights are ordered with Action items first, and saved scenarios appear in *Remediation options*.
- [ ] The *Group view* lists both entities.
- [ ] *Print / save as PDF* gives a clean page with no header or tabs.

**Employee: Lena, Senior Engineer, Berlin**
- [ ] The view defaults to Lena Hoffmann (DE) and shows the band bar, compa-ratio and the women/men averages for Engineering L3.
- [ ] Pick someone in a small category. The averages are replaced by a suppression message.
- [ ] The *Pay information request* section shows the **Phase 2 · planned add-on** badge and the preview note. The *HR response* text fills in that person's data.

**Cross-cutting**
- [ ] *Data & AI notice* opens and closes.
- [ ] The ◐ button switches between dark and light mode, and charts recolour.
- [ ] At phone width (375px) nothing scrolls sideways.
- [ ] The browser console shows no errors.

**Apps Script mode** (after following [DEPLOY.md](DEPLOY.md))
- [ ] The badge reads *Google Sheets*.
- [ ] The headline figures are identical to the static demo.
- [ ] Saving a scenario adds a row to the `Scenarios` tab.

## Edge cases covered
- A filter so narrow that the model can't be fitted (fewer than 5 women or men, or too few people for the number of factors). The model reports why, rather than showing a misleading number.
- Categories where one sex has fewer than 3 people (analyst view) or fewer than 5 (employee view): these are suppressed.
- Scenarios with no strategy selected (cost is 0), or with a budget smaller than the first uplift (a partial uplift that stops at the cap).
- Records whose sex is not recorded as female or male: excluded from binary measures, and the exclusion is disclosed in the insights.

## Known simplifications
These are fine for a demo. A real statutory submission would need the following:
- **Ordinary pay:** hourly pay is FTE salary ÷ standard hours. A real return uses actual ordinary pay in the relevant pay period, including allowances and shift premiums, and actual hours.
- **Quartile ties:** quartiles split by count. GOV.UK guidance asks employers to spread women and men evenly where tied pay rates fall across a quartile boundary.
- **Bonuses:** the bonus period is taken as the 12 months to 5 April, and commission is treated as bonus pay.
- **Categories of worker:** these are approximated as job family × level. A real equal-value assessment uses a job-evaluation scheme (skills, effort, responsibility, working conditions).
- **Directive dates:** the Directive's reporting timetable and member-state transposition details are not modelled. National law should be checked.
