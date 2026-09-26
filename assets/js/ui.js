/* ------------------------------------------------------------------
   ui.js — views and rendering.
   ------------------------------------------------------------------ */
window.UI = (function () {
  'use strict';

  var view, tabbar, topbar;
  var state = { page: 'home', selected: null, graded: null, timerId: null, deadline: null };

  var DOMAIN_SHORT = {
    'Algebra': 'Algebra',
    'Advanced Math': 'Advanced Math',
    'Problem-Solving and Data Analysis': 'Problem-Solving & Data',
    'Geometry and Trigonometry': 'Geometry & Trig'
  };
  var LETTERS = ['A', 'B', 'C', 'D'];

  function el(id) { return document.getElementById(id); }
  function h(html) { return html; }
  function pct(x) { return Math.round(x * 100); }

  function fmtMs(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    var m = Math.floor(s / 60);
    s = s % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function fmtSecs(ms) { return Math.round(ms / 1000) + 's'; }

  /* ============================================================ chrome */
  function refreshChrome() {
    var t = Store.totals();
    var score = Store.estimateScore();
    var streak = Store.liveStreak();
    var b = document.querySelector('[data-bind="streak"]');
    if (b) b.textContent = streak;
    b = document.querySelector('[data-bind="xp"]');
    if (b) b.textContent = t.xp >= 10000 ? (Math.round(t.xp / 100) / 10) + 'k' : t.xp;
    b = document.querySelector('[data-bind="score"]');
    if (b) b.textContent = score == null ? '—' : score;

    Array.prototype.forEach.call(tabbar.querySelectorAll('button'), function (btn) {
      if (btn.dataset.nav === state.page) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });
  }

  function showChrome(on) {
    topbar.hidden = !on;
    tabbar.hidden = !on;
  }

  /* ============================================================ home */
  function pageHome() {
    var score = Store.estimateScore();
    var conf = Store.estimateConfidence();
    var t = Store.totals();
    var acc = Store.accuracyOverall();
    var streak = Store.liveStreak();
    var c = Bank.counts();

    var toGoal = score == null ? 0 : Math.max(0, 800 - score);
    var fill = score == null ? 0 : ((score - 200) / 600) * 100;

    var html = '<div class="stack">';

    html += '<section class="hero">' +
      '<div class="hero__label">Estimated Math score</div>' +
      '<div class="hero__score">' + (score == null ? '—' : score) + '</div>' +
      '<div class="hero__sub">' +
        (score == null
          ? 'Answer ' + Math.max(0, 10 - t.answered) + ' more questions to unlock your estimate.'
          : (toGoal === 0 ? 'You are tracking at the top of the scale. Hold it.'
                          : toGoal + ' points to 800 · confidence ' + pct(conf) + '%')) +
      '</div>' +
      '<div class="hero__bar"><div class="hero__fill" style="width:' + fill + '%"></div></div>' +
      '</section>';

    html += '<div class="grid3">' +
      tile(streak, streak === 1 ? 'Day streak' : 'Day streak') +
      tile(acc == null ? '—' : pct(acc) + '%', 'Accuracy') +
      tile(t.answered, 'Answered') +
      '</div>';

    html += '<section class="card"><div class="card__head"><h2>Practise</h2>' +
      '<span class="tiny">' + c.servable + ' questions ready</span></div>' +
      '<div class="modes">' +
      mode('adaptive', '◎', 'Adaptive', 'Targets your weakest skills first. The fastest route up.') +
      mode('topic', '◈', 'Topic drill', 'Pick a domain or a single skill and grind it.') +
      mode('timed', '⏱', 'Timed practice', 'Real SAT pacing: 95 seconds a question.') +
      mode('module', '▣', 'Full module', '22 questions, 35 minutes, exam weighting.') +
      '</div></section>';

    var weak = Store.weakSkills(Bank.skills()).filter(function (w) { return w.n >= 3; }).slice(0, 3);
    if (weak.length) {
      html += '<section class="card"><div class="card__head"><h2>Weakest right now</h2></div><div class="bars">';
      weak.forEach(function (w) {
        html += bar(w.skill, w.acc, accColor(w.acc), pct(w.acc) + '% of ' + w.n);
      });
      html += '</div><button class="btn btn--primary btn--block" style="margin-top:14px" data-start="weak">Drill these</button></section>';
    }

    html += '</div>';
    view.innerHTML = html;
  }

  function tile(val, label) {
    return '<div class="tile"><div class="tile__val">' + val + '</div><div class="tile__label">' + label + '</div></div>';
  }
  function mode(id, icon, title, desc) {
    return '<button class="mode" data-mode="' + id + '" type="button">' +
      '<span class="mode__icon" aria-hidden="true">' + icon + '</span>' +
      '<span><span class="mode__title">' + title + '</span>' +
      '<span class="mode__desc">' + desc + '</span></span>' +
      '<span class="mode__go" aria-hidden="true">›</span></button>';
  }
  function accColor(a) {
    if (a >= 0.85) return 'var(--ok)';
    if (a >= 0.65) return 'var(--brand)';
    if (a >= 0.45) return 'var(--warn)';
    return 'var(--bad)';
  }
  function bar(name, frac, color, right) {
    return '<div class="bar"><div class="bar__top"><span class="bar__name">' + M.esc(name) + '</span>' +
      '<span class="bar__val">' + right + '</span></div>' +
      '<div class="bar__track"><div class="bar__fill" style="width:' + pct(frac) + '%;background:' + color + '"></div></div></div>';
  }

  /* ======================================================== practice */
  function pagePractice() {
    var html = '<div class="stack">';
    html += '<h1>Practise</h1>';
    html += '<section class="card"><div class="modes">' +
      mode('adaptive', '◎', 'Adaptive', 'Weighted to your weakest skills.') +
      mode('timed', '⏱', 'Timed practice', '95 seconds a question, exam weighting.') +
      mode('module', '▣', 'Full module', '22 questions in 35 minutes. No explanations until the end.') +
      mode('mixed', '✦', 'Mixed + generated', 'Official questions plus freshly generated ones.') +
      '</div></section>';

    html += '<section class="card"><div class="card__head"><h2>By domain</h2></div><div class="modes">';
    Bank.domains().forEach(function (d) {
      var n = Bank.poolFor({ domain: d }).length;
      html += '<button class="mode" data-domain="' + M.esc(d) + '" type="button">' +
        '<span class="mode__icon" aria-hidden="true">◆</span>' +
        '<span><span class="mode__title">' + M.esc(DOMAIN_SHORT[d] || d) + '</span>' +
        '<span class="mode__desc">' + n + ' questions</span></span>' +
        '<span class="mode__go" aria-hidden="true">›</span></button>';
    });
    html += '</div></section>';

    html += '<section class="card"><div class="card__head"><h2>By skill</h2>' +
      '<span class="tiny">19 College Board skills</span></div><div class="chips">';
    Bank.skills().forEach(function (s) {
      var lv = Store.masteryLevel(Store.bySkill()[s]);
      html += '<button class="chip" data-skill="' + M.esc(s) + '" type="button">' + M.esc(s) +
        (lv ? ' <span class="lvl lvl--' + lv + '">' + Store.LEVEL_NAME[lv] + '</span>' : '') + '</button>';
    });
    html += '</div></section></div>';
    view.innerHTML = html;
  }

  /* ========================================================= runner */
  function startRun(cfg) {
    if (!cfg.questions || !cfg.questions.length) {
      alert('No questions available for that selection.');
      return;
    }
    Session.start(cfg);
    Session.markQuestionStart();
    state.selected = null;
    state.graded = null;
    state.page = 'run';
    if (cfg.totalMs) state.deadline = Date.now() + cfg.totalMs;
    else state.deadline = null;
    showChrome(false);
    renderRun();
    startTimer();
  }

  function startTimer() {
    stopTimer();
    state.timerId = setInterval(tickTimer, 250);
    tickTimer();
  }
  function stopTimer() {
    if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
  }

  function tickTimer() {
    var s = Session.current();
    if (!s) return stopTimer();
    var node = document.querySelector('[data-timer]');
    if (!node) return;

    if (s.totalMs) {
      var left = state.deadline - Date.now();
      node.textContent = fmtMs(left);
      node.className = 'timer' + (left < 60000 ? ' timer--over' : (left < 300000 ? ' timer--warn' : ''));
      if (left <= 0) { stopTimer(); finishRun(); }
    } else {
      var used = Date.now() - s.qStartedAt;
      node.textContent = fmtMs(used);
      node.className = 'timer' + (used > s.perQuestionMs ? ' timer--over' : (used > s.perQuestionMs * 0.75 ? ' timer--warn' : ''));
    }
  }

  function renderRun() {
    var s = Session.current();
    var q = Session.question();
    var p = Session.progress();
    var showExplain = state.graded && !s.isModule;

    var html = '<div class="stack">';

    html += '<div class="qhead"><div class="qhead__left">' +
      '<button class="btn btn--ghost" data-action="quit" type="button" style="padding:8px 12px;font-size:.8rem">Exit</button>' +
      '<span class="qprog">' + p.i + ' / ' + p.n + '</span></div>' +
      '<div class="row" style="gap:8px">' +
      '<button class="btn btn--ghost" data-action="calc" type="button" style="padding:8px 12px;font-size:.8rem">Calculator</button>' +
      (s.timed ? '<span class="timer" data-timer>0:00</span>' : '') +
      '</div></div>';

    html += '<div class="qbar"><div class="qbar__fill" style="width:' + p.pct + '%"></div></div>';

    html += '<div class="qmeta" style="margin-bottom:12px">' +
      '<span class="tag">' + M.esc(DOMAIN_SHORT[q.domain] || q.domain) + '</span>' +
      '<span class="tag">' + M.esc(q.skill) + '</span>' +
      '<span class="tag tag--' + q.tier + '">' + q.tier + '</span>' +
      (q.source === 'generated' ? '<span class="tag tag--gen">generated</span>' : '') +
      '</div>';

    html += '<div class="stem">' + M.inline(q.stem) + '</div>';

    if (q.format === 'mcq') {
      html += '<div class="choices" data-choices>';
      q.choices.forEach(function (c, i) {
        html += renderChoice(q, c, i);
      });
      html += '</div>';
    } else {
      var val = state.graded ? M.esc(state.graded.response || '') : '';
      html += '<div class="spr">' +
        '<input class="spr__input" data-spr type="text" inputmode="text" autocomplete="off" ' +
        'placeholder="Type your answer" value="' + val + '"' + (state.graded ? ' disabled' : '') + '>' +
        '<div class="spr__hint">Enter an integer, decimal, or fraction (for example 3/4 or 0.75).</div>' +
        '</div>';
    }

    if (!state.graded) {
      html += '<div class="qactions">' +
        '<button class="btn btn--primary btn--lg btn--block" data-action="check" type="button">' +
        (s.isModule ? 'Submit' : 'Check answer') + '</button></div>';
    } else {
      if (showExplain) html += renderExplain(q, state.graded);
      html += '<div class="qactions">' +
        '<button class="btn btn--primary btn--lg btn--block" data-action="next" type="button">' +
        (Session.isLast() ? 'See results' : 'Next question') + '</button></div>';
    }

    html += '</div>';
    view.innerHTML = html;

    var inp = view.querySelector('[data-spr]');
    if (inp && !state.graded) inp.focus();
  }

  function renderChoice(q, c, i) {
    var L = LETTERS[i];
    var cls = 'choice';
    var mark = '';
    var disabled = '';
    var pressed = 'false';

    if (state.graded) {
      disabled = ' disabled';
      var isKey = (i === q.answerIndex);
      var isPicked = (state.graded.response === L);
      if (isKey) { cls += ' choice--correct'; mark = '✓'; }
      else if (isPicked) { cls += ' choice--wrong'; mark = '✕'; }
      else { cls += ' choice--muted'; }
    } else if (state.selected === L) {
      pressed = 'true';
    }

    return '<button class="' + cls + '" data-choice="' + L + '" type="button" aria-pressed="' + pressed + '"' + disabled + '>' +
      '<span class="choice__key">' + L + '</span>' +
      '<span class="choice__body">' + M.expr(c) + '</span>' +
      '<span class="choice__mark">' + mark + '</span></button>';
  }

  /* ---------------------------------------------------- explanation */
  function renderExplain(q, r) {
    var html = '';

    html += '<div class="verdict ' + (r.correct ? 'verdict--ok' : 'verdict--bad') + '" style="margin-top:20px">' +
      '<span class="verdict__icon">' + (r.correct ? '✓' : '✕') + '</span>' +
      '<span><span class="verdict__title">' + (r.correct ? 'Correct' : 'Not quite') + '</span>' +
      '<span class="verdict__sub" style="display:block">' +
        (q.format === 'spr' ? 'Answer: ' + M.expr(q.answer) : 'Answer: ' + q.answer) +
        ' · ' + fmtSecs(r.ms) + (r.ms < Session.PAR_MS ? ' (on pace)' : ' (over pace)') +
      '</span></span>' +
      '<span class="verdict__xp">+' + r.xp + ' XP</span></div>';

    var steps = q.steps && q.steps.length ? q.steps : deriveSteps(q);
    if (steps.length) {
      html += '<section class="card card--flat" style="margin-top:14px"><div class="card__head"><h3>Worked solution</h3></div>' +
        '<div class="solution">';
      steps.forEach(function (st, i) {
        html += '<div class="step"><span class="step__n">' + (i + 1) + '</span>' +
          '<span class="step__body">' + M.inline(st) + '</span></div>';
      });
      html += '</div></section>';
    }

    if (q.format === 'mcq' && q.explanations) {
      html += '<section class="card card--flat" style="margin-top:12px">' +
        '<div class="card__head"><h3>Why each choice</h3>' +
        '<span class="tiny">every wrong option is a specific error</span></div><div class="whys">';
      q.choices.forEach(function (c, i) {
        var L = LETTERS[i];
        var isKey = (i === q.answerIndex);
        var isPicked = (r.response === L);
        var cls = 'why' + (isKey ? ' why--correct' : (isPicked ? ' why--picked' : ''));
        html += '<div class="' + cls + '"><span class="why__key">' + L + '</span><span>' +
          '<span class="why__val">' + M.expr(c) + '</span> — ' +
          '<span class="why__txt">' + M.inline(q.explanations[L] || '') + '</span></span></div>';
      });
      html += '</div></section>';
    } else if (q.format === 'spr' && q.method) {
      html += '<section class="card card--flat" style="margin-top:12px">' +
        '<div class="card__head"><h3>Method</h3></div>' +
        '<p class="muted">' + M.inline(q.method) + '</p></section>';
    }

    if (r.awards && r.awards.length) {
      html += '<section class="card" style="margin-top:12px;border-color:var(--brand)">' +
        '<div class="card__head"><h3>Achievement unlocked</h3></div><div class="awards">';
      r.awards.forEach(function (a) {
        html += '<div class="award"><div class="award__icon">' + a.icon + '</div>' +
          '<div class="award__name">' + M.esc(a.name) + '</div>' +
          '<div class="award__desc">' + M.esc(a.desc) + '</div></div>';
      });
      html += '</div></section>';
    }

    return html;
  }

  /** Fall back to a one-line method when a corpus item has no step list. */
  function deriveSteps(q) {
    var out = [];
    if (q.method) out.push(q.method);
    if (q.format === 'mcq' && q.explanations) {
      var L = q.answer;
      var why = q.explanations[L] || '';
      why = why.replace(/^Correct\.\s*/, '');
      if (why && out.indexOf(why) === -1) out.push(why);
    }
    return out;
  }

  /* ------------------------------------------------------- grading */
  function doCheck() {
    var s = Session.current();
    var q = Session.question();
    var response;

    if (q.format === 'mcq') {
      if (!state.selected) return;
      response = state.selected;
    } else {
      var inp = view.querySelector('[data-spr]');
      response = inp ? inp.value.trim() : '';
      if (!response) { if (inp) inp.focus(); return; }
    }

    state.graded = Session.answer(response);
    refreshChrome();
    renderRun();
    if (!s.totalMs) { /* per-question timer pauses while reading */ }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function doNext() {
    state.selected = null;
    state.graded = null;
    if (Session.next()) {
      renderRun();
      window.scrollTo({ top: 0 });
    } else {
      finishRun();
    }
  }

  function finishRun() {
    stopTimer();
    var summary = Session.finish();
    Session.abandon();
    state.page = 'summary';
    state.summary = summary;
    showChrome(true);
    refreshChrome();
    pageSummary(summary);
    window.scrollTo({ top: 0 });
  }

  /* ======================================================== summary */
  function pageSummary(s) {
    if (!s) { go('home'); return; }
    var accPct = pct(s.accuracy);
    var color = accColor(s.accuracy);

    var html = '<div class="stack">';
    html += '<section class="card" style="text-align:center">' +
      '<div class="tiny" style="text-transform:uppercase;letter-spacing:.08em;font-weight:700">' + M.esc(s.title || 'Session') + ' complete</div>' +
      '<div class="summary__score" style="color:' + color + ';margin:10px 0 4px">' + s.correct + '/' + s.total + '</div>' +
      '<div class="muted">' + accPct + '% accuracy · +' + s.xp + ' XP · ' + fmtMs(s.totalMs) + ' total</div>' +
      '<div class="muted tiny" style="margin-top:6px">Average ' + fmtSecs(s.avgMs) + ' per question' +
        (s.avgMs < Session.PAR_MS ? ' — inside SAT pacing.' : ' — above the 95s target.') + '</div>' +
      '</section>';

    // Per-domain breakdown for this session.
    var dom = {};
    s.results.forEach(function (r) {
      var d = r.q.domain;
      if (!dom[d]) dom[d] = { n: 0, ok: 0 };
      dom[d].n += 1;
      if (r.correct) dom[d].ok += 1;
    });
    var keys = Object.keys(dom);
    if (keys.length > 1) {
      html += '<section class="card"><div class="card__head"><h2>By domain</h2></div><div class="bars">';
      keys.forEach(function (d) {
        var a = dom[d].ok / dom[d].n;
        html += bar(DOMAIN_SHORT[d] || d, a, accColor(a), dom[d].ok + '/' + dom[d].n);
      });
      html += '</div></section>';
    }

    if (s.awards && s.awards.length) {
      html += '<section class="card" style="border-color:var(--brand)"><div class="card__head"><h2>Unlocked</h2></div><div class="awards">';
      s.awards.forEach(function (a) {
        html += '<div class="award"><div class="award__icon">' + a.icon + '</div>' +
          '<div class="award__name">' + M.esc(a.name) + '</div></div>';
      });
      html += '</div></section>';
    }

    html += '<section class="card"><div class="card__head"><h2>Review</h2>' +
      '<span class="tiny">tap to see the full explanation</span></div><div class="review">';
    s.results.forEach(function (r, i) {
      html += '<button class="rev" data-review="' + i + '" type="button">' +
        '<span class="rev__n ' + (r.correct ? 'rev__n--ok' : 'rev__n--bad') + '">' + (r.correct ? '✓' : '✕') + '</span>' +
        '<span class="rev__skill">' + (i + 1) + '. ' + M.esc(r.q.skill) + '</span>' +
        '<span class="rev__time">' + fmtSecs(r.ms) + '</span></button>';
    });
    html += '</div></section>';

    html += '<div class="grid2">' +
      '<button class="btn btn--primary" data-action="again" type="button">Practise again</button>' +
      '<button class="btn" data-nav="home" type="button">Home</button>' +
      '</div>';

    html += '</div>';
    view.innerHTML = html;
  }

  function pageReview(i) {
    var s = state.summary;
    if (!s || !s.results[i]) return;
    var r = s.results[i];
    var q = r.q;

    var html = '<div class="stack">';
    html += '<div class="row row--between"><button class="btn btn--ghost" data-action="back-summary" type="button">‹ Back</button>' +
      '<span class="qprog">' + (i + 1) + ' / ' + s.total + '</span></div>';
    html += '<div class="qmeta">' +
      '<span class="tag">' + M.esc(DOMAIN_SHORT[q.domain] || q.domain) + '</span>' +
      '<span class="tag">' + M.esc(q.skill) + '</span>' +
      '<span class="tag tag--' + q.tier + '">' + q.tier + '</span></div>';
    html += '<div class="stem">' + M.inline(q.stem) + '</div>';

    if (q.format === 'mcq') {
      html += '<div class="choices">';
      var saved = state.graded;
      state.graded = r;
      q.choices.forEach(function (c, k) { html += renderChoice(q, c, k); });
      state.graded = saved;
      html += '</div>';
    } else {
      html += '<div class="spr"><input class="spr__input" value="' + M.esc(r.response || '') + '" disabled></div>';
    }

    var saved2 = state.graded;
    state.graded = r;
    html += renderExplain(q, r);
    state.graded = saved2;

    html += '<div class="qactions">' +
      (i > 0 ? '<button class="btn" data-review="' + (i - 1) + '" type="button">‹ Previous</button>' : '') +
      (i < s.total - 1 ? '<button class="btn btn--primary" data-review="' + (i + 1) + '" type="button">Next ›</button>' : '') +
      '</div>';

    html += '</div>';
    view.innerHTML = html;
    window.scrollTo({ top: 0 });
  }

  /* ======================================================= progress */
  function pageProgress() {
    var skills = Store.bySkill();
    var doms = Store.byDomain();
    var t = Store.totals();
    var acts = Store.activity(21);
    var maxAct = Math.max.apply(null, acts.map(function (a) { return a.n; }).concat([1]));

    var html = '<div class="stack"><h1>Progress</h1>';

    html += '<div class="grid3">' +
      tile(t.answered, 'Answered') +
      tile(t.sessions, 'Sessions') +
      tile(t.modules, 'Modules') +
      '</div>';

    html += '<section class="card"><div class="card__head"><h2>Last 21 days</h2>' +
      '<span class="tiny">questions answered</span></div>' +
      '<div style="display:flex;align-items:flex-end;gap:4px;height:70px">';
    acts.forEach(function (a) {
      var hgt = a.n === 0 ? 3 : Math.max(6, (a.n / maxAct) * 68);
      html += '<div title="' + a.day + ': ' + a.n + '" style="flex:1;height:' + hgt + 'px;border-radius:3px;background:' +
        (a.n ? 'linear-gradient(180deg,var(--brand),var(--brand-2))' : 'var(--line)') + '"></div>';
    });
    html += '</div></section>';

    var dk = Object.keys(doms);
    if (dk.length) {
      html += '<section class="card"><div class="card__head"><h2>By domain</h2></div><div class="bars">';
      Bank.DOMAINS.forEach(function (d) {
        if (!doms[d]) return;
        var a = doms[d].ok / doms[d].n;
        html += bar(DOMAIN_SHORT[d] || d, a, accColor(a), doms[d].ok + '/' + doms[d].n);
      });
      html += '</div></section>';
    }

    html += '<section class="card"><div class="card__head"><h2>Skill mastery</h2>' +
      '<span class="tiny">19 skills</span></div><div class="mastery">';
    Bank.skills().forEach(function (sk) {
      var st = skills[sk];
      var lv = Store.masteryLevel(st);
      var pips = '';
      for (var i = 1; i <= 4; i++) pips += '<span class="pip' + (i <= lv ? ' pip--on' : '') + '"></span>';
      html += '<div class="msk"><span class="msk__name">' + M.esc(sk) + '</span>' +
        '<span class="msk__pips" title="' + Store.LEVEL_NAME[lv] + '">' + pips + '</span>' +
        '<span class="msk__meta">' + (st ? (st.ok + '/' + st.n + ' correct · ' + pct(st.ok / st.n) + '%') : 'not started') +
        ' · <span class="lvl lvl--' + lv + '">' + Store.LEVEL_NAME[lv] + '</span></span></div>';
    });
    html += '</div></section>';

    html += '<section class="card"><div class="card__head"><h2>Data</h2></div>' +
      '<p class="muted" style="margin-bottom:12px">Everything is stored on this device only. Nothing is uploaded.</p>' +
      '<button class="btn" data-action="reset" type="button">Reset all progress</button></section>';

    html += '</div>';
    view.innerHTML = html;
  }

  /* ========================================================= awards */
  function pageAwards() {
    var won = Store.awards();
    var n = Object.keys(won).length;
    var html = '<div class="stack"><h1>Achievements</h1>' +
      '<p class="muted">' + n + ' of ' + Session.ACHIEVEMENTS.length + ' unlocked</p>' +
      '<div class="awards">';
    Session.ACHIEVEMENTS.forEach(function (a) {
      var got = !!won[a.id];
      html += '<div class="award' + (got ? '' : ' award--locked') + '">' +
        '<div class="award__icon">' + (got ? a.icon : '🔒') + '</div>' +
        '<div class="award__name">' + M.esc(a.name) + '</div>' +
        '<div class="award__desc">' + M.esc(a.desc) + '</div></div>';
    });
    html += '</div></div>';
    view.innerHTML = html;
  }

  /* ==================================================== topic picker */
  function pageTopic() {
    var html = '<div class="stack"><h1>Topic drill</h1>' +
      '<p class="muted">Choose a domain for a broad drill, or a single skill to go deep.</p>';
    html += '<section class="card"><div class="card__head"><h2>Domains</h2></div><div class="modes">';
    Bank.domains().forEach(function (d) {
      var st = Store.byDomain()[d];
      html += '<button class="mode" data-domain="' + M.esc(d) + '" type="button">' +
        '<span class="mode__icon" aria-hidden="true">◆</span>' +
        '<span><span class="mode__title">' + M.esc(DOMAIN_SHORT[d] || d) + '</span>' +
        '<span class="mode__desc">' + Bank.poolFor({ domain: d }).length + ' questions' +
        (st ? ' · ' + pct(st.ok / st.n) + '% so far' : '') + '</span></span>' +
        '<span class="mode__go" aria-hidden="true">›</span></button>';
    });
    html += '</div></section>';

    Bank.domains().forEach(function (d) {
      html += '<section class="card"><div class="card__head"><h2>' + M.esc(DOMAIN_SHORT[d] || d) + '</h2></div><div class="chips">';
      Bank.skillsIn(d).forEach(function (s) {
        var lv = Store.masteryLevel(Store.bySkill()[s]);
        html += '<button class="chip" data-skill="' + M.esc(s) + '" type="button">' + M.esc(s) +
          (lv ? ' <span class="lvl lvl--' + lv + '">' + lv + '</span>' : '') + '</button>';
      });
      html += '</div></section>';
    });

    html += '</div>';
    view.innerHTML = html;
  }

  /* =========================================================== calc */
  var calcLoaded = false, calcInstance = null;
  function toggleCalc() {
    var box = el('calc');
    if (!box.hidden) { box.hidden = true; return; }
    box.hidden = false;
    if (calcLoaded) return;
    calcLoaded = true;

    var s = document.createElement('script');
    s.src = 'https://www.desmos.com/api/v1.11/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6';
    s.onload = function () {
      try {
        calcInstance = Desmos.GraphingCalculator(el('calc-host'), {
          expressions: true, settingsMenu: false, zoomButtons: true,
          border: false, lockViewport: false
        });
      } catch (e) { box.classList.add('calc--failed'); }
    };
    s.onerror = function () { box.classList.add('calc--failed'); };
    document.head.appendChild(s);
  }

  /* ========================================================= router */
  function go(page) {
    state.page = page;
    showChrome(true);
    if (page === 'home') pageHome();
    else if (page === 'practice') pagePractice();
    else if (page === 'progress') pageProgress();
    else if (page === 'awards') pageAwards();
    else if (page === 'topic') pageTopic();
    else if (page === 'summary') pageSummary(state.summary);
    refreshChrome();
    window.scrollTo({ top: 0 });
  }

  /* ======================================================= launchers */
  function launch(kind, opts) {
    opts = opts || {};
    var cfg;
    if (kind === 'adaptive') {
      cfg = { mode: 'adaptive', title: 'Adaptive', questions: Bank.adaptive(12), timed: true, perQuestionMs: Session.PAR_MS };
    } else if (kind === 'timed') {
      cfg = { mode: 'timed', title: 'Timed practice', questions: Bank.timed(10), timed: true, perQuestionMs: Session.PAR_MS };
    } else if (kind === 'module') {
      cfg = { mode: 'module', title: 'Full module', questions: Bank.module(22), timed: true, isModule: true, totalMs: 35 * 60 * 1000 };
    } else if (kind === 'mixed') {
      cfg = { mode: 'mixed', title: 'Mixed practice', questions: Bank.mixed(12, 0.3), timed: true, perQuestionMs: Session.PAR_MS };
    } else if (kind === 'domain') {
      cfg = { mode: 'drill', title: DOMAIN_SHORT[opts.domain] || opts.domain, questions: Bank.drill({ domain: opts.domain, count: 10 }), timed: false };
    } else if (kind === 'skill') {
      cfg = { mode: 'drill', title: opts.skill, questions: Bank.drill({ skill: opts.skill, count: 10 }), timed: false };
    } else if (kind === 'weak') {
      cfg = { mode: 'adaptive', title: 'Weak spots', questions: Bank.adaptive(10), timed: true, perQuestionMs: Session.PAR_MS };
    } else {
      cfg = { mode: 'drill', title: 'Practice', questions: Bank.mixed(10), timed: false };
    }
    state.lastLaunch = { kind: kind, opts: opts };
    startRun(cfg);
  }

  /* ========================================================= events */
  function bind() {
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-nav],[data-mode],[data-domain],[data-skill],[data-action],[data-choice],[data-review],[data-start]');
      if (!t) return;

      if (t.dataset.nav) { go(t.dataset.nav); return; }

      if (t.dataset.mode) {
        var m = t.dataset.mode;
        if (m === 'topic') go('topic');
        else launch(m);
        return;
      }
      if (t.dataset.domain) { launch('domain', { domain: t.dataset.domain }); return; }
      if (t.dataset.skill)  { launch('skill',  { skill: t.dataset.skill }); return; }
      if (t.dataset.start === 'weak') { launch('weak'); return; }

      if (t.dataset.choice && !state.graded) {
        state.selected = t.dataset.choice;
        Array.prototype.forEach.call(view.querySelectorAll('[data-choice]'), function (b) {
          b.setAttribute('aria-pressed', b.dataset.choice === state.selected ? 'true' : 'false');
        });
        return;
      }

      if (t.dataset.review != null) { pageReview(parseInt(t.dataset.review, 10)); return; }

      var a = t.dataset.action;
      if (a === 'check') doCheck();
      else if (a === 'next') doNext();
      else if (a === 'quit') {
        if (confirm('End this session? Answers you have already submitted are saved.')) {
          stopTimer(); Session.abandon(); go('home');
        }
      }
      else if (a === 'again') { var l = state.lastLaunch || { kind: 'adaptive' }; launch(l.kind, l.opts); }
      else if (a === 'back-summary') { pageSummary(state.summary); }
      else if (a === 'calc' || a === 'calc-close') toggleCalc();
      else if (a === 'theme') cycleTheme();
      else if (a === 'reset') {
        if (confirm('Erase all progress on this device? This cannot be undone.')) {
          Store.reset(); go('home');
        }
      }
    });

    document.addEventListener('keydown', function (e) {
      if (state.page !== 'run') return;
      var q = Session.question();
      if (!q) return;
      var tag = (e.target.tagName || '').toLowerCase();
      var typing = tag === 'input' || tag === 'textarea';

      if (e.key === 'Enter') {
        e.preventDefault();
        if (state.graded) doNext(); else doCheck();
        return;
      }
      if (typing) return;
      if (q.format === 'mcq' && !state.graded) {
        var k = e.key.toUpperCase();
        var idx = LETTERS.indexOf(k);
        if (idx === -1 && /^[1-4]$/.test(e.key)) idx = parseInt(e.key, 10) - 1;
        if (idx >= 0) {
          e.preventDefault();
          state.selected = LETTERS[idx];
          Array.prototype.forEach.call(view.querySelectorAll('[data-choice]'), function (b) {
            b.setAttribute('aria-pressed', b.dataset.choice === state.selected ? 'true' : 'false');
          });
        }
      }
    });
  }

  /* ========================================================== theme */
  function applyTheme(mode) {
    if (mode === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', mode);
  }
  function cycleTheme() {
    var cur = Store.setting('theme') || 'auto';
    var next = cur === 'auto' ? 'light' : (cur === 'light' ? 'dark' : 'auto');
    Store.setting('theme', next);
    applyTheme(next);
  }

  /* =========================================================== init */
  function init() {
    view = el('view');
    tabbar = document.querySelector('.tabbar');
    topbar = document.querySelector('.topbar');
    applyTheme(Store.setting('theme') || 'auto');
    bind();
    view.hidden = false;
    go('home');
  }

  return { init: init, go: go, launch: launch, refreshChrome: refreshChrome };
})();
