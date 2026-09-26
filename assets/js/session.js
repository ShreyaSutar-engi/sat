/* ------------------------------------------------------------------
   session.js — one practice run: queue, timing, grading, awards.
   ------------------------------------------------------------------ */
window.Session = (function () {
  'use strict';

  var PAR_MS = 95000;     // real digital SAT pacing: 35 min / 22 questions

  var cur = null;

  /* --------------------------------------------------- answer parsing */

  /** "3/4" -> 0.75, "-.5" -> -0.5, "1 1/2" not supported (SAT doesn't use it). */
  function toNumber(s) {
    if (s == null) return NaN;
    var t = String(s).trim().replace(/\s+/g, '').replace(/,/g, '');
    if (t === '') return NaN;
    var m = t.match(/^(-?\d*\.?\d+)\/(-?\d*\.?\d+)$/);
    if (m) {
      var d = parseFloat(m[2]);
      if (d === 0) return NaN;
      return parseFloat(m[1]) / d;
    }
    if (!/^-?\d*\.?\d+$/.test(t)) return NaN;
    return parseFloat(t);
  }

  /**
   * Grid-in grading. Accepts any listed value, in any equivalent form
   * (0.5 = 1/2 = .5). Comparison is numeric with a tolerance that scales
   * with magnitude, matching how the real test treats rounded entries.
   */
  function sprMatches(input, accepted) {
    if (input == null) return false;
    var raw = String(input).trim();
    if (!raw) return false;

    for (var i = 0; i < accepted.length; i++) {
      var a = String(accepted[i]).trim();
      if (raw.replace(/\s/g, '') === a.replace(/\s/g, '')) return true;

      var av = toNumber(a), iv = toNumber(raw);
      if (isNaN(av) || isNaN(iv)) continue;
      var tol = Math.max(1e-9, Math.abs(av) * 1e-6);
      if (Math.abs(av - iv) <= tol) return true;

      // Accept a correctly rounded 3-significant-figure entry.
      var rounded = Number(av.toPrecision(3));
      if (Math.abs(rounded - iv) <= Math.max(1e-9, Math.abs(rounded) * 1e-6)) return true;
    }
    return false;
  }

  function isCorrect(q, response) {
    if (q.format === 'spr') return sprMatches(response, q.accepted || []);
    return response === q.answer;      // response is a letter
  }

  /* ---------------------------------------------------- achievements */
  var ACHIEVEMENTS = [
    { id: 'first',        icon: '✦', name: 'First Steps',     desc: 'Answer your first question.',
      test: function (t) { return t.totals.answered >= 1; } },
    { id: 'ten',          icon: '◆', name: 'Warmed Up',        desc: 'Answer 10 questions.',
      test: function (t) { return t.totals.answered >= 10; } },
    { id: 'hundred',      icon: '❖', name: 'Century',          desc: 'Answer 100 questions.',
      test: function (t) { return t.totals.answered >= 100; } },
    { id: 'fivehundred',  icon: '✵', name: 'Five Hundred',     desc: 'Answer 500 questions.',
      test: function (t) { return t.totals.answered >= 500; } },
    { id: 'streak3',      icon: '▲', name: 'Three in a Row',   desc: 'Practise 3 days running.',
      test: function (t) { return t.streak >= 3; } },
    { id: 'streak7',      icon: '★', name: 'Full Week',        desc: 'Practise 7 days running.',
      test: function (t) { return t.streak >= 7; } },
    { id: 'streak30',     icon: '☀', name: 'Month Strong',     desc: 'Practise 30 days running.',
      test: function (t) { return t.streak >= 30; } },
    { id: 'xp1000',       icon: '⬢', name: 'Thousand Club',    desc: 'Earn 1,000 XP.',
      test: function (t) { return t.totals.xp >= 1000; } },
    { id: 'xp5000',       icon: '⬣', name: 'Five Thousand',    desc: 'Earn 5,000 XP.',
      test: function (t) { return t.totals.xp >= 5000; } },
    { id: 'firstMastery', icon: '◉', name: 'Skill Mastered',   desc: 'Reach Mastered on any skill.',
      test: function (t) { return t.maxLevel >= 4; } },
    { id: 'fiveMastery',  icon: '◎', name: 'Five Mastered',    desc: 'Master five different skills.',
      test: function (t) { return t.mastered >= 5; } },
    { id: 'allDomains',   icon: '⬟', name: 'Well Rounded',     desc: 'Practise all four content domains.',
      test: function (t) { return t.domainsTouched >= 4; } },
    { id: 'module',       icon: '▣', name: 'Module Complete',  desc: 'Finish a full timed module.',
      test: function (t) { return t.totals.modules >= 1; } },
    { id: 'perfectModule',icon: '✸', name: 'Flawless Module',  desc: 'Score 22/22 on a full module.',
      test: function (t) { return t.perfectModule; } },
    { id: 'hardRun',      icon: '⚡', name: 'Heavy Lifter',     desc: 'Get 10 hard questions right.',
      test: function (t) { return t.hardCorrect >= 10; } },
    { id: 'onPace',       icon: '⏱', name: 'On Pace',          desc: 'Answer 20 questions correctly under 95s each.',
      test: function (t) { return t.fastCorrect >= 20; } },
    { id: 'score700',     icon: '◈', name: 'Seven Hundred',    desc: 'Reach an estimated score of 700.',
      test: function (t) { return (t.score || 0) >= 700; } },
    { id: 'score800',     icon: '✹', name: 'Perfect Eight',    desc: 'Reach an estimated score of 800.',
      test: function (t) { return (t.score || 0) >= 800; } }
  ];

  function snapshot(extra) {
    var s = Store.load();
    var skills = Store.bySkill();
    var maxLevel = 0, mastered = 0;
    Object.keys(skills).forEach(function (k) {
      var lv = Store.masteryLevel(skills[k]);
      if (lv > maxLevel) maxLevel = lv;
      if (lv === 4) mastered++;
    });
    var domains = {}, hardCorrect = 0, fastCorrect = 0;
    s.events.forEach(function (e) {
      domains[e.domain] = 1;
      if (e.correct && e.tier === 'hard') hardCorrect++;
      if (e.correct && e.ms != null && e.ms < PAR_MS) fastCorrect++;
    });
    var t = {
      totals: Store.totals(),
      streak: Store.liveStreak(),
      score: Store.estimateScore(),
      maxLevel: maxLevel,
      mastered: mastered,
      domainsTouched: Object.keys(domains).length,
      hardCorrect: hardCorrect,
      fastCorrect: fastCorrect,
      perfectModule: false
    };
    if (extra) for (var k in extra) t[k] = extra[k];
    return t;
  }

  function checkAwards(extra) {
    var t = snapshot(extra);
    var won = [];
    ACHIEVEMENTS.forEach(function (a) {
      try {
        if (a.test(t) && Store.grant(a.id)) won.push(a);
      } catch (e) { /* a predicate must never break a session */ }
    });
    return won;
  }

  /* -------------------------------------------------------- lifecycle */

  function start(config) {
    var qs = config.questions || [];
    cur = {
      mode: config.mode,
      title: config.title,
      timed: !!config.timed,
      perQuestionMs: config.perQuestionMs || PAR_MS,
      totalMs: config.totalMs || null,
      isModule: !!config.isModule,
      questions: qs,
      index: 0,
      results: [],
      startedAt: Date.now(),
      qStartedAt: Date.now(),
      awards: []
    };
    return cur;
  }

  function current() { return cur; }
  function question() { return cur ? cur.questions[cur.index] : null; }
  function isLast() { return cur ? cur.index >= cur.questions.length - 1 : true; }
  function progress() {
    if (!cur) return { i: 0, n: 0, pct: 0 };
    return { i: cur.index + 1, n: cur.questions.length, pct: (cur.index / cur.questions.length) * 100 };
  }

  function markQuestionStart() { if (cur) cur.qStartedAt = Date.now(); }

  function answer(response) {
    if (!cur) return null;
    var q = cur.questions[cur.index];
    var ms = Date.now() - cur.qStartedAt;
    var ok = isCorrect(q, response);
    var xp = Store.record(q, ok, ms);

    var r = { q: q, response: response, correct: ok, ms: ms, xp: xp };
    cur.results.push(r);

    var extra = {};
    if (cur.isModule && cur.results.length === cur.questions.length) {
      extra.perfectModule = cur.results.every(function (x) { return x.correct; });
    }
    r.awards = checkAwards(extra);
    cur.awards = cur.awards.concat(r.awards);
    return r;
  }

  function next() {
    if (!cur) return false;
    if (cur.index >= cur.questions.length - 1) return false;
    cur.index += 1;
    markQuestionStart();
    return true;
  }

  function finish() {
    if (!cur) return null;
    Store.finishSession(cur.isModule);
    var total = cur.results.length;
    var ok = cur.results.filter(function (r) { return r.correct; }).length;
    var xp = cur.results.reduce(function (s, r) { return s + r.xp; }, 0);
    var ms = cur.results.reduce(function (s, r) { return s + r.ms; }, 0);
    var summary = {
      mode: cur.mode,
      title: cur.title,
      total: total,
      correct: ok,
      accuracy: total ? ok / total : 0,
      xp: xp,
      totalMs: ms,
      avgMs: total ? ms / total : 0,
      results: cur.results,
      awards: cur.awards,
      isModule: cur.isModule
    };
    return summary;
  }

  function abandon() { cur = null; }

  return {
    PAR_MS: PAR_MS,
    ACHIEVEMENTS: ACHIEVEMENTS,
    start: start, current: current, question: question,
    isLast: isLast, progress: progress,
    answer: answer, next: next, finish: finish, abandon: abandon,
    markQuestionStart: markQuestionStart,
    isCorrect: isCorrect, sprMatches: sprMatches, toNumber: toNumber,
    checkAwards: checkAwards, snapshot: snapshot
  };
})();
