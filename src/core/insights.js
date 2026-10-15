/**
 * Dynamic insights engine.
 *
 * Rule-based narratives computed from the current analysis, so they change with every
 * filter. Each rule explains what the numbers MEAN (cause, risk, action), rather than
 * restating what a chart already shows. Returns [{ id, tone: 'risk'|'watch'|'good'|'info', title, text }].
 */
(function (global) {
  'use strict';
  const PT = global.PT || (global.PT = {});

  const p1 = (x) => (isNaN(x) ? '–' : (Math.round(x * 10) / 10).toFixed(1) + '%');
  const pts = (x) => (Math.round(x * 10) / 10).toFixed(1) + ' pts';

  function structural(ctx) {
    const { reg, stat, scope } = ctx;
    if (!reg || !reg.ok) return null;
    const raw = reg.rawLogGap * 100;
    if (Math.abs(raw) < 1) return { id: 'structural', tone: 'good', title: 'Pay levels are broadly even', text: scope + ' average pay for women and men is within 1%.' };
    const byGroup = Object.fromEntries(reg.decomposition.map((d) => [d.group, d.logPoints * 100]));
    const where = (byGroup.level || 0) + (byGroup.family || 0);
    const share = Math.max(0, Math.min(100, (where / raw) * 100));
    const q = stat.quartiles;
    const upperF = q[3].pctF, lowerF = q[0].pctF;
    let text = 'About ' + Math.round(share) + '% of the ' + pts(raw) + ' average gap comes from where people sit rather than how they are paid: ';
    text += 'level accounts for ' + pts(byGroup.level || 0) + ' and job family for ' + pts(byGroup.family || 0) + '. ';
    if (!isNaN(upperF) && !isNaN(lowerF)) text += 'Women are ' + Math.round(lowerF) + '% of the lowest-paid quarter but ' + Math.round(upperF) + '% of the highest-paid quarter. ';
    text += share > 60 ? 'The lever here is progression and hiring into senior and higher-paid families, not pay adjustments alone.' : 'A large share is not explained by role, so pay decisions themselves need review.';
    return { id: 'structural', tone: share > 60 ? 'watch' : 'risk', title: 'The gap is mostly about representation', text };
  }

  function unexplained(ctx) {
    const { reg, scope } = ctx;
    if (!reg || !reg.ok) return { id: 'adjusted', tone: 'info', title: 'Adjusted gap not available', text: reg ? reg.reason : '' };
    const g = reg.adjustedGap;
    const ci = p1(reg.ci[0]) + ' to ' + p1(reg.ci[1]);
    if (!reg.significant) {
      return { id: 'adjusted', tone: 'good', title: 'No statistically clear like-for-like gap', text: scope + ' once level, family, location, tenure and rating are equal, the estimated gap is ' + p1(g) + ' (95% range ' + ci + '), which is not statistically distinguishable from zero.' };
    }
    const tone = Math.abs(g) >= 5 ? 'risk' : Math.abs(g) >= 2 ? 'watch' : 'good';
    return {
      id: 'adjusted', tone,
      title: (g > 0 ? 'Women' : 'Men') + ' earn ' + p1(Math.abs(g)) + ' less than comparable colleagues',
      text: 'Comparing like with like (same level, family, location, tenure and rating), the gap is ' + p1(g) + ' (95% range ' + ci + '). ' +
        'This is the part objective criteria do not explain: under the EU Directive it is what you would have to justify or remedy. ' +
        (tone === 'risk' ? 'Treat it as a priority.' : 'Small, but it should trend to zero.'),
    };
  }

  function bonus(ctx) {
    const { stat, fteBonus } = ctx;
    if (isNaN(stat.medianBonusGap) || !fteBonus) return null;
    const effect = stat.medianBonusGap - fteBonus.median;
    const wider = stat.medianBonusGap - stat.medianHourlyGap;
    if (wider < 3 && effect < 3) return null;
    let text = 'The median bonus gap (' + p1(stat.medianBonusGap) + ') is ' + pts(wider) + ' wider than the median pay gap. ';
    if (effect >= 3) text += 'Bonuses are pro-rated for part-time staff, who are mostly women. Restating bonuses as full-time equivalent brings the median bonus gap down to ' + p1(fteBonus.median) + ', so about ' + pts(effect) + ' is a working-pattern effect rather than unequal reward. ';
    else text += 'Part-time working does not explain it, so review how bonus targets and ratings are set by level and family. ';
    const diff = stat.pctMReceivingBonus - stat.pctFReceivingBonus;
    if (Math.abs(diff) >= 3) text += (diff > 0 ? 'Men' : 'Women') + ' are also more likely to receive a bonus (' + p1(Math.max(stat.pctMReceivingBonus, stat.pctFReceivingBonus)) + ' vs ' + p1(Math.min(stat.pctMReceivingBonus, stat.pctFReceivingBonus)) + ').';
    return { id: 'bonus', tone: effect >= 3 ? 'watch' : 'risk', title: 'Bonus gap is driven by ' + (effect >= 3 ? 'working patterns' : 'how bonuses are awarded'), text };
  }

  function categories(ctx) {
    const { cats, names, threshold } = ctx;
    if (!cats) return null;
    const robust = (c) => (c.nF >= 5 && c.nM >= 5 ? 1 : 0);
    const flagged = cats.filter((c) => c.status === 'flag').sort((a, b) => robust(b) - robust(a) || Math.abs(b.unexplained) - Math.abs(a.unexplained));
    const explained = cats.filter((c) => c.status === 'explained');
    const small = cats.filter((c) => c.status === 'suppressed').length;
    if (!flagged.length && !explained.length) {
      return { id: 'cats', tone: 'good', title: 'No category exceeds the ' + threshold + '% threshold', text: 'No category of worker shows a gap of ' + threshold + '% or more.' + (small ? ' ' + small + ' categories are too small to assess.' : '') };
    }
    const label = (c) => names.family(c.family) + ' ' + c.level;
    let text = '';
    if (flagged.length) {
      const top = flagged[0];
      text += flagged.length + ' categor' + (flagged.length === 1 ? 'y has' : 'ies have') + ' a gap of ' + threshold + '%+ that objective factors do not explain. The most robust finding is ' + label(top) + ' (' + p1(top.unexplained) + ' unexplained, ' + top.nF + ' women / ' + top.nM + ' men). ';
      text += 'Under the Directive, a gap like this that is not justified and not fixed within six months triggers a joint pay assessment. ';
      const tiny = flagged.filter((c) => c.nF < 5 || c.nM < 5).length;
      if (tiny) text += tiny + ' of these involve fewer than 5 people of one sex, so check individual cases before drawing conclusions. ';
    }
    if (explained.length) text += explained.length + ' further categor' + (explained.length === 1 ? 'y exceeds' : 'ies exceed') + ' ' + threshold + '% but the gap is explained by tenure, rating or location (e.g. ' + label(explained[0]) + '). Document that justification now.';
    return { id: 'cats', tone: flagged.length ? 'risk' : 'watch', title: flagged.length ? flagged.length + ' categor' + (flagged.length === 1 ? 'y needs' : 'ies need') + ' action' : 'Gaps found, but explained', text };
  }

  function bands(ctx) {
    const b = ctx.bandSummary;
    if (!b || !b.below) return b ? { id: 'bands', tone: 'good', title: 'Everyone is paid within their band', text: 'No one is paid below their band minimum.' } : null;
    const years = Object.entries(b.belowHireYears).sort((x, y) => y[1] - x[1]);
    const [topYear, topCount] = years[0];
    const pctF = (b.belowF / b.below) * 100;
    let text = b.below + ' people (' + p1(b.pctBelow) + ') are paid below their band minimum; ' + Math.round(pctF) + '% of them are women. ';
    if (topCount / b.below >= 0.5) text += topCount + ' of them joined in ' + topYear + ', which points to how offers were set that year rather than to in-role pay decisions. ';
    text += 'Bringing them to minimum costs about ' + ctx.money(b.costToMin) + ' a year before on-costs.';
    return { id: 'bands', tone: pctF > 65 ? 'risk' : 'watch', title: 'Below-band pay is concentrated', text };
  }

  function trend(ctx) {
    const t = ctx.trend;
    if (!t || t.length < 2) return null;
    const first = t[0], last = t[t.length - 1];
    const change = last.adjusted - first.adjusted;
    const perYear = change / (last.year - first.year);
    let text = 'The adjusted gap moved from ' + p1(first.adjusted) + ' in ' + first.year + ' to ' + p1(last.adjusted) + ' in ' + last.year + '. ';
    if (perYear < -0.1 && last.adjusted > 0) {
      const yearsToZero = last.adjusted / -perYear;
      text += 'At this pace it reaches zero around ' + Math.ceil(last.year + yearsToZero) + '. ';
      text += yearsToZero > 3 ? 'That is too slow to rely on: a targeted remediation round would close it faster.' : 'On track, if the pace holds.';
    } else if (perYear >= 0.1) text += 'It is widening; investigate recent hires and promotions.';
    else text += 'It is flat.';
    return { id: 'trend', tone: perYear < -0.1 ? 'watch' : 'risk', title: perYear < -0.1 ? 'Improving, but slowly' : 'Not improving', text };
  }

  function exclusions(ctx) {
    const c = ctx.stat.counts;
    if (!c.excludedReducedPay && !c.excludedNotBinary) return null;
    return {
      id: 'excl', tone: 'info', title: 'Who is in the statutory figures',
      text: c.excludedReducedPay + ' people on reduced pay due to leave are excluded from the hourly pay figures but included in the bonus figures, as the UK regulations require. ' +
        (c.excludedNotBinary ? c.excludedNotBinary + ' people who have not recorded their sex as female or male are excluded from the binary measures.' : ''),
    };
  }

  function overview(ctx) {
    return [unexplained(ctx), structural(ctx), categories(ctx), bonus(ctx), bands(ctx), trend(ctx), exclusions(ctx)].filter(Boolean);
  }

  PT.insights = { overview, structural, unexplained, bonus, categories, bands, trend, exclusions };
})(typeof globalThis !== 'undefined' ? globalThis : this);
