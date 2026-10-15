/** Employee view: my band, my position, my category averages, and pay information requests. */
(function (global) {
  'use strict';
  const PT = global.PT;
  const { esc, pct, info } = PT.ui;

  function pick(ctx, state) {
    const current = ctx.rows.filter((r) => r.sex === 'F' || r.sex === 'M' || r.sex === 'X').sort((a, b) => a.name.localeCompare(b.name));
    let me = current.find((r) => r.id === state.employeeId);
    if (!me) { me = current.find((r) => r.id === state.ds.config.defaultPersonaId) || current[0]; state.employeeId = me ? me.id : ''; }
    return { me, current };
  }

  function requestLetter(me, ctx) {
    return 'To: People Team, ' + ctx.ent.name + '\nFrom: ' + me.name + ' (' + me.id + ')\n\nSubject: Request for pay information\n\n' +
      'I would like to request the following information:\n\n' +
      '1. My individual pay level.\n' +
      '2. The average pay levels, broken down by sex, for workers doing the same work as me or work of equal value.\n' +
      '3. The criteria used to determine pay, pay levels and pay progression.\n\n' +
      'Please provide this in writing within two months, as set out in Article 7 of the EU Pay Transparency Directive' +
      (ctx.ent.regime === 'UK_GPG' ? ' (provided by Fernvale policy for UK colleagues; there is no equivalent UK statutory right)' : '') + '.\n\nThank you,\n' + me.name;
  }

  function responseLetter(me, ctx, avgs) {
    const b = me.band;
    let s = 'Dear ' + me.name.split(' ')[0] + ',\n\nThank you for your request. Here is the information you asked for, as at 5 April ' + ctx.year + '.\n\n' +
      '1. Your pay\n   Salary (full-time equivalent): ' + ctx.money(me.base) + '\n   Your band (' + me.level + ' ' + ctx.names.family(me.family) + '): ' + ctx.money(b.min) + ' – ' + ctx.money(b.max) + ', midpoint ' + ctx.money(b.mid) + '\n\n' +
      '2. Average pay for your category of worker (' + ctx.names.family(me.family) + ' ' + me.level + ')\n';
    if (avgs.suppressed) s += '   We cannot share averages by sex for this category, because one group has fewer than ' + avgs.minN + ' people and the figures could identify individuals. We can instead share the averages for the wider job family on request.\n\n';
    else s += '   Women: ' + ctx.money(avgs.avgF) + ' (' + avgs.nF + ' people)\n   Men: ' + ctx.money(avgs.avgM) + ' (' + avgs.nM + ' people)\n\n';
    s += '3. How pay is set\n   Pay bands are set per job family and level using market data. Position in band reflects skills, experience and sustained performance. ' +
      'Progression between levels follows the published career framework. All criteria are objective and gender-neutral: skills, effort, responsibility and working conditions.\n\n' +
      'If you have questions, or believe there is a difference that is not justified, please contact the People Team. You will not be treated unfavourably for asking.\n\nPeople Team, ' + ctx.ent.name;
    return s;
  }

  function html(ctx, state) {
    const { me, current } = pick(ctx, state);
    if (!me) return '<div class="card"><p class="sub">No employees in this selection.</p></div>';
    const pos = PT.bands.position(me);
    const b = me.band;
    const avgs = PT.privacy.categoryAverages(ctx.rows, me.family, me.level, ctx.publicMinN);
    const lo = Math.min(b.min, me.base) * 0.97, hi = Math.max(b.max, me.base) * 1.03;
    const x = (v) => ((v - lo) / (hi - lo)) * 100;
    const posText = pos.status === 'below' ? 'below the band minimum' : pos.status === 'above' ? 'above the band maximum' : Math.round(pos.penetration * 100) + '% of the way through your band';
    const showHr = !!state.hrResponse;

    return '<div class="card-head"><label class="sub">Viewing as <select data-emp>' + current.map((r) => '<option value="' + r.id + '"' + (r.id === me.id ? ' selected' : '') + '>' + esc(r.name + ' · ' + r.title) + '</option>').join('') + '</select></label>' +
      '<span class="sub">Demo persona switcher. In production this view would only ever show the signed-in employee.</span></div>' +
      '<div class="grid">' +
      '<section class="card span-7"><div class="card-head"><h2>' + esc(me.name) + '</h2><span class="badge">' + esc(me.title) + ' · ' + esc(me.location) + '</span></div>' +
      '<p class="sub">' + esc(ctx.names.family(me.family)) + ' · Level ' + me.level + ' (' + esc(ctx.names.level(me.level)) + ') · joined ' + esc(me.hireDate) + (me.fte < 1 ? ' · ' + Math.round(me.fte * 100) + '% FTE' : '') + '</p>' +
      '<div class="bandbar" role="img" aria-label="Your salary ' + esc(ctx.money(me.base)) + ' within band ' + esc(ctx.money(b.min)) + ' to ' + esc(ctx.money(b.max)) + '">' +
      '<div class="track" style="left:' + x(b.min) + '%;right:' + (100 - x(b.max)) + '%"></div>' +
      '<div class="mid" style="left:' + x(b.mid) + '%"></div><div class="marker" style="left:' + x(me.base) + '%"></div>' +
      '<span class="lbl" style="left:' + x(b.min) + '%">Min ' + esc(ctx.money(b.min)) + '</span><span class="lbl" style="left:' + x(b.mid) + '%">Mid ' + esc(ctx.money(b.mid)) + '</span><span class="lbl" style="left:' + x(b.max) + '%">Max ' + esc(ctx.money(b.max)) + '</span></div>' +
      '<div class="tiles" style="margin-top:22px">' +
      '<div class="tile"><div class="label">Your salary (FTE)</div><div class="value">' + ctx.money(me.base) + '</div></div>' +
      '<div class="tile"><div class="label">Compa-ratio ' + info('Your salary ÷ the midpoint of your band. 100% means paid at the midpoint.') + '</div><div class="value">' + pct(pos.compa * 100, 0) + '</div><div class="foot">You are ' + posText + '</div></div>' +
      '</div></section>' +
      '<section class="card span-5"><div class="card-head"><h2>People doing the same work</h2>' + info('Average salary for your category of worker (same family and level), by sex. Groups smaller than ' + ctx.publicMinN + ' are hidden to protect privacy.') + '</div>' +
      (avgs.suppressed
        ? '<p>Not shown: one group has fewer than ' + avgs.minN + ' people (' + avgs.nF + ' women, ' + avgs.nM + ' men), so averages could identify individuals.</p>'
        : '<div class="tiles" style="grid-template-columns:1fr 1fr"><div class="tile"><div class="label"><i class="dot f"></i> Women (' + avgs.nF + ')</div><div class="value" style="font-size:20px">' + ctx.money(avgs.avgF) + '</div></div>' +
          '<div class="tile"><div class="label"><i class="dot m"></i> Men (' + avgs.nM + ')</div><div class="value" style="font-size:20px">' + ctx.money(avgs.avgM) + '</div></div></div>') +
      '<h3 style="margin-top:16px">Your rights</h3><p class="sub" style="margin-top:4px">' +
      (ctx.ent.regime === 'EU_DIRECTIVE'
        ? 'Under the EU Pay Transparency Directive you can ask in writing for your pay level and the average pay, by sex, of people doing the same work or work of equal value. The answer is due within two months.'
        : 'UK law gives no individual right to this information, but Fernvale applies the same approach across the group, so you can ask in writing.') + '</p></section>' +
      '<section class="card span-12"><div class="card-head"><h2>Pay information request</h2><span class="badge phase">Phase 2 · planned add-on</span><span class="spacer"></span><div class="segmented" role="group" aria-label="Letter">' +
      '<button type="button" data-letter="req" aria-pressed="' + !showHr + '">Employee request</button><button type="button" data-letter="hr" aria-pressed="' + showHr + '">HR response (pre-filled)</button></div>' +
      '<button type="button" class="btn" data-action="copy-letter">Copy</button></div>' +
      '<div class="phase-note" role="note"><strong>Preview</strong><span>This feature is planned for a later phase. It would go live only after approval to use named employee data, including any AI-assisted drafting of responses. ' +
      'In this demo, both letters are fixed templates filled from the data. No AI is used and nothing is sent anywhere.</span></div>' +
      '<div class="letter" id="letter">' + esc(showHr ? responseLetter(me, ctx, avgs) : requestLetter(me, ctx)) + '</div></section></div>' +
      '<p class="disclaimer">Fictional data for demonstration. Not legal advice.</p>';
  }

  function mount(ctx, state, main) {
    main.onchange = (e) => { if ('emp' in e.target.dataset) { state.employeeId = e.target.value; PT.render(); } };
    main.onclick = (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.letter) { state.hrResponse = t.dataset.letter === 'hr'; PT.render(); }
      else if (t.dataset.action === 'copy-letter') {
        const text = document.getElementById('letter').textContent;
        if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => { t.textContent = 'Copied'; setTimeout(() => { t.textContent = 'Copy'; }, 1500); }, () => {});
      }
    };
    main.oninput = null;
  }

  PT.views.employee = { html, mount };
})(typeof globalThis !== 'undefined' ? globalThis : this);
