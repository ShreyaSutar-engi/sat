/* ------------------------------------------------------------------
   store.js — all persistent student state (localStorage).

   Every read is defensive: private windows, blocked site data and
   quota errors must degrade to an in-memory session, never a crash.
   ------------------------------------------------------------------ */
window.Store = (function () {
  'use strict';

  var KEY = 'sat800.v1';
  var MAX_EVENTS = 4000;

  var TIER_XP   = { easy: 10, medium: 16, hard: 26 };
  var TIER_W    = { easy: 0.25, medium: 0.35, hard: 0.40 };
  var PAR_MS    = 95000;

  var mem = null;   // fallback when localStorage is unavailable

  function blank() {
    return {
      v: 1,
      createdAt: Date.now(),
      lastActive: 0,
      xp: 0,
      streak: { count: 0, best: 0, lastDay: null },
      history: {},
      events: [],
      awards: {},
      settings: { theme: 'auto' },
      sessions: 0,
      modulesDone: 0
    };
  }

  function load() {
    if (mem) return mem;
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { /* blocked */ }
    if (!raw) { mem = blank(); return mem; }
    try {
      var d = JSON.parse(raw);
      var b = blank();
      for (var k in b) if (!(k in d)) d[k] = b[k];
      if (!d.streak) d.streak = b.streak;
      mem = d;
    } catch (e) {
      mem = blank();
    }
    return mem;
  }

  function save() {
    if (!mem) return;
    try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* quota / blocked */ }
  }

  /* ------------------------------------------------------------ days */
  function dayKey(ts) {
    var d = new Date(ts == null ? Date.now() : ts);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  function daysBetween(a, b) {
    function mid(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).getTime(); }
    return Math.round((mid(b) - mid(a)) / 86400000);
  }

  function touchStreak() {
    var s = load();
    var today = dayKey();
    if (s.streak.lastDay === today) return s.streak.count;
    if (s.streak.lastDay && daysBetween(s.streak.lastDay, today) === 1) s.streak.count += 1;
    else s.streak.count = 1;
    s.streak.lastDay = today;
    if (s.streak.count > s.streak.best) s.streak.best = s.streak.count;
    save();
    return s.streak.count;
  }

  /** A streak is only "alive" if the last active day was today or yesterday. */
  function liveStreak() {
    var s = load();
    if (!s.streak.lastDay) return 0;
    var gap = daysBetween(s.streak.lastDay, dayKey());
    return gap <= 1 ? s.streak.count : 0;
  }

  /* ------------------------------------------------------- recording */
  function xpFor(q, correct, ms) {
    var base = TIER_XP[q.tier] || 12;
    if (!correct) return Math.round(base * 0.25);
    var bonus = (ms != null && ms < PAR_MS) ? 1.15 : 1;
    return Math.round(base * bonus);
  }

  function record(q, correct, ms) {
    var s = load();
    var h = s.history[q.id] || { seen: 0, correct: 0, lastAt: 0, lastCorrect: null, bestMs: null };
    h.seen += 1;
    if (correct) h.correct += 1;
    h.lastAt = Date.now();
    h.lastCorrect = !!correct;
    h.lastMs = ms;
    if (correct && (h.bestMs == null || ms < h.bestMs)) h.bestMs = ms;
    s.history[q.id] = h;

    s.events.push({
      id: q.id, skill: q.skill, domain: q.domain, tier: q.tier,
      correct: !!correct, ms: ms, at: Date.now(), gen: q.source === 'generated' ? 1 : 0
    });
    if (s.events.length > MAX_EVENTS) s.events = s.events.slice(-MAX_EVENTS);

    var gained = xpFor(q, correct, ms);
    s.xp += gained;
    s.lastActive = Date.now();
    touchStreak();
    save();
    return gained;
  }

  function finishSession(isModule) {
    var s = load();
    s.sessions += 1;
    if (isModule) s.modulesDone += 1;
    save();
  }

  /* --------------------------------------------------------- analysis */
  function bucket(events) {
    var b = {};
    events.forEach(function (e) {
      var k = e.skill;
      if (!b[k]) b[k] = { n: 0, ok: 0, ms: 0, domain: e.domain };
      b[k].n += 1;
      if (e.correct) b[k].ok += 1;
      if (e.ms) b[k].ms += e.ms;
    });
    return b;
  }

  function bySkill() { return bucket(load().events); }

  function byDomain() {
    var b = {};
    load().events.forEach(function (e) {
      var k = e.domain;
      if (!b[k]) b[k] = { n: 0, ok: 0 };
      b[k].n += 1;
      if (e.correct) b[k].ok += 1;
    });
    return b;
  }

  /** Mastery level 0-4 for a skill. */
  function masteryLevel(stat) {
    if (!stat || stat.n < 3) return 0;
    var acc = stat.ok / stat.n;
    if (stat.n >= 12 && acc >= 0.90) return 4;
    if (stat.n >= 8  && acc >= 0.78) return 3;
    if (acc >= 0.60) return 2;
    return 1;
  }

  var LEVEL_NAME = ['Untested', 'Shaky', 'Developing', 'Strong', 'Mastered'];

  /**
   * Estimated Math section score.
   * Accuracy is measured per difficulty tier over recent work and weighted
   * toward hard items, because the top of the scale is gated by them.
   */
  function estimateScore() {
    var ev = load().events;
    if (ev.length < 10) return null;
    var recent = ev.slice(-120);

    var t = { easy: { n: 0, ok: 0 }, medium: { n: 0, ok: 0 }, hard: { n: 0, ok: 0 } };
    recent.forEach(function (e) {
      var k = t[e.tier] ? e.tier : 'medium';
      t[k].n += 1;
      if (e.correct) t[k].ok += 1;
    });

    var num = 0, den = 0;
    ['easy', 'medium', 'hard'].forEach(function (k) {
      if (t[k].n === 0) return;
      num += TIER_W[k] * (t[k].ok / t[k].n);
      den += TIER_W[k];
    });
    if (den === 0) return null;

    var ability = num / den;
    var score = 200 + 600 * Math.pow(ability, 1.08);
    score = Math.round(score / 10) * 10;
    return Math.max(200, Math.min(800, score));
  }

  /** Confidence in the estimate, 0..1, purely a function of volume/spread. */
  function estimateConfidence() {
    var ev = load().events;
    var n = Math.min(ev.length, 120);
    var skills = {};
    ev.slice(-120).forEach(function (e) { skills[e.skill] = 1; });
    var spread = Math.min(Object.keys(skills).length / 12, 1);
    return Math.max(0, Math.min(1, (n / 120) * 0.65 + spread * 0.35));
  }

  /** Skills ordered weakest-first, for adaptive selection. */
  function weakSkills(allSkills) {
    var stats = bySkill();
    return allSkills.map(function (name) {
      var st = stats[name];
      var n = st ? st.n : 0;
      var acc = n ? st.ok / n : 0;
      // Unseen skills get a mid-priority so the student meets everything.
      var priority = n === 0 ? 0.55 : (1 - acc) * Math.min(1, 0.35 + n / 12);
      return { skill: name, n: n, acc: acc, priority: priority, level: masteryLevel(st) };
    }).sort(function (a, b) { return b.priority - a.priority; });
  }

  function accuracyOverall() {
    var ev = load().events;
    if (!ev.length) return null;
    var ok = 0;
    ev.forEach(function (e) { if (e.correct) ok += 1; });
    return ok / ev.length;
  }

  /** Daily answered counts for the last `days` days, oldest first. */
  function activity(days) {
    var out = [], byDay = {};
    load().events.forEach(function (e) {
      var k = dayKey(e.at);
      byDay[k] = (byDay[k] || 0) + 1;
    });
    for (var i = days - 1; i >= 0; i--) {
      var k = dayKey(Date.now() - i * 86400000);
      out.push({ day: k, n: byDay[k] || 0 });
    }
    return out;
  }

  function history(id) { return load().history[id] || null; }
  function totals() {
    var s = load();
    return { xp: s.xp, answered: s.events.length, sessions: s.sessions, modules: s.modulesDone };
  }

  /* -------------------------------------------------------- settings */
  function setting(k, v) {
    var s = load();
    if (v === undefined) return s.settings[k];
    s.settings[k] = v;
    save();
    return v;
  }

  function reset() {
    mem = blank();
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    save();
  }

  /* -------------------------------------------------------- awards */
  function grant(id) {
    var s = load();
    if (s.awards[id]) return false;
    s.awards[id] = Date.now();
    save();
    return true;
  }
  function awards() { return load().awards; }

  return {
    load: load, save: save, reset: reset,
    record: record, finishSession: finishSession, xpFor: xpFor,
    bySkill: bySkill, byDomain: byDomain, weakSkills: weakSkills,
    masteryLevel: masteryLevel, LEVEL_NAME: LEVEL_NAME,
    estimateScore: estimateScore, estimateConfidence: estimateConfidence,
    accuracyOverall: accuracyOverall, activity: activity,
    liveStreak: liveStreak, touchStreak: touchStreak,
    history: history, totals: totals, setting: setting,
    grant: grant, awards: awards, dayKey: dayKey
  };
})();
