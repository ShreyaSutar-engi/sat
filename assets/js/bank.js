/* ------------------------------------------------------------------
   bank.js — the question pool and every selection strategy.

   Content weighting follows the REAL exam (35/35/15/15), not the
   corpus's own proportions. See docs/ANALYSIS.md §1.3 for why.
   ------------------------------------------------------------------ */
window.Bank = (function () {
  'use strict';

  var all = [];        // every parsed question
  var pool = [];       // servable questions (no image dependency)
  var bySkill = {};
  var byDomain = {};

  var DOMAINS = [
    'Algebra',
    'Advanced Math',
    'Problem-Solving and Data Analysis',
    'Geometry and Trigonometry'
  ];

  // Operational Math section weighting.
  var EXAM_MIX = {
    'Algebra': 0.35,
    'Advanced Math': 0.35,
    'Problem-Solving and Data Analysis': 0.15,
    'Geometry and Trigonometry': 0.15
  };

  var TIER_MIX = { easy: 0.30, medium: 0.45, hard: 0.25 };

  function init() {
    var src = (window.SAT_BANK && window.SAT_BANK.questions) || [];
    all = src;
    pool = src.filter(function (q) { return !q.needsImage; });

    bySkill = {}; byDomain = {};
    pool.forEach(function (q) {
      (bySkill[q.skill] = bySkill[q.skill] || []).push(q);
      (byDomain[q.domain] = byDomain[q.domain] || []).push(q);
    });
    return pool.length;
  }

  function skills() { return Object.keys(bySkill).sort(); }
  function skillsIn(domain) {
    return skills().filter(function (s) { return bySkill[s][0].domain === domain; });
  }
  function domains() { return DOMAINS.filter(function (d) { return byDomain[d]; }); }
  function counts() {
    return {
      total: all.length,
      servable: pool.length,
      withImage: all.length - pool.length
    };
  }

  /* --------------------------------------------------------- scoring */
  /**
   * Higher score = better to serve now.
   * Unseen questions come first; then ones previously missed; then the
   * least recently seen. A small random jitter stops the order feeling
   * mechanical when several items tie.
   */
  function freshness(q, now) {
    var h = Store.history(q.id);
    if (!h) return 1000 + Math.random() * 40;

    var days = (now - h.lastAt) / 86400000;
    var s = 0;

    if (h.lastCorrect === false) s += 420;                 // missed last time
    var acc = h.seen ? h.correct / h.seen : 0;
    s += (1 - acc) * 220;                                  // weak overall
    s += Math.min(days, 45) * 7;                           // spaced repetition
    s -= h.seen * 26;                                      // avoid over-drilling
    return s + Math.random() * 30;
  }

  function sortFresh(list) {
    var now = Date.now();
    return list.slice().map(function (q) {
      return { q: q, s: freshness(q, now) };
    }).sort(function (a, b) { return b.s - a.s; }).map(function (o) { return o.q; });
  }

  function take(list, n) { return sortFresh(list).slice(0, n); }

  /* ------------------------------------------------------- selection */

  /** Straight topic drill: one domain or one skill. */
  function drill(opts) {
    var n = opts.count || 10;
    var src;
    if (opts.skill) src = bySkill[opts.skill] || [];
    else if (opts.domain) src = byDomain[opts.domain] || [];
    else src = pool;

    var out = take(src, n);

    // Top up with generated items when the pool is thin or exhausted.
    if (out.length < n) {
      var need = n - out.length;
      var gen = Gen.many(need, { skill: opts.skill, domain: opts.domain });
      out = out.concat(gen);
    }
    return out;
  }

  /**
   * Adaptive: weight selection toward the student's weakest skills while
   * still touching everything, and lean slightly harder as mastery rises.
   */
  function adaptive(n) {
    n = n || 12;
    var ranked = Store.weakSkills(skills());
    if (!ranked.length) return drill({ count: n });

    // Build a weighted skill sequence: the weakest few dominate.
    var seq = [];
    ranked.forEach(function (r, i) {
      var w = i < 3 ? 5 : (i < 6 ? 3 : (i < 10 ? 2 : 1));
      if (r.level === 4) w = 1;                       // mastered: light touch
      for (var k = 0; k < w; k++) seq.push(r.skill);
    });

    var used = {};
    var out = [];
    var guard = 0;
    while (out.length < n && guard < n * 25) {
      guard++;
      var sk = seq[Math.floor(Math.random() * seq.length)];
      var candidates = (bySkill[sk] || []).filter(function (q) { return !used[q.id]; });
      if (!candidates.length) {
        var g = Gen.one({ skill: sk });
        if (g) { out.push(g); used[g.id] = 1; }
        continue;
      }
      var chosen = take(candidates, 1)[0];
      if (chosen) { out.push(chosen); used[chosen.id] = 1; }
    }
    return out;
  }

  /** Timed drill: exam-weighted across all domains. */
  function timed(n) {
    n = n || 10;
    return examMix(n);
  }

  /**
   * A full module: 22 questions, exam-weighted by domain and roughly
   * matching the corpus difficulty split, ordered easy-ish to hard.
   */
  function module(n) {
    n = n || 22;
    var qs = examMix(n);
    qs.sort(function (a, b) { return a.difficulty - b.difficulty; });
    return qs;
  }

  function examMix(n) {
    var used = {};
    var out = [];

    // Allocate slots per domain by the real exam weighting.
    var alloc = {};
    var assigned = 0;
    DOMAINS.forEach(function (d, i) {
      var c = (i === DOMAINS.length - 1) ? (n - assigned) : Math.round(n * EXAM_MIX[d]);
      alloc[d] = Math.max(0, c);
      assigned += alloc[d];
    });

    DOMAINS.forEach(function (d) {
      var want = alloc[d];
      if (!want) return;
      var src = (byDomain[d] || []).filter(function (q) { return !used[q.id]; });

      // Respect the difficulty mix inside each domain.
      var wantTier = {
        easy:   Math.round(want * TIER_MIX.easy),
        medium: Math.round(want * TIER_MIX.medium),
        hard:   0
      };
      wantTier.hard = want - wantTier.easy - wantTier.medium;

      ['easy', 'medium', 'hard'].forEach(function (tier) {
        var c = src.filter(function (q) { return q.tier === tier && !used[q.id]; });
        take(c, wantTier[tier]).forEach(function (q) { used[q.id] = 1; out.push(q); });
      });

      // Backfill from any tier in this domain if a tier ran dry.
      while (out.filter(function (q) { return q.domain === d; }).length < want) {
        var rest = src.filter(function (q) { return !used[q.id]; });
        if (!rest.length) break;
        var q2 = take(rest, 1)[0];
        used[q2.id] = 1; out.push(q2);
      }

      // Still short? generate for this domain.
      var have = out.filter(function (q) { return q.domain === d; }).length;
      if (have < want) {
        Gen.many(want - have, { domain: d }).forEach(function (g) { out.push(g); });
      }
    });

    return out;
  }

  /** Mixed practice with a share of freshly generated items. */
  function mixed(n, genShare) {
    n = n || 12;
    genShare = genShare == null ? 0.25 : genShare;
    var nGen = Math.round(n * genShare);
    var official = examMix(n - nGen);
    var generated = Gen.many(nGen);
    var out = official.concat(generated);
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }

  function byIdLookup(id) {
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  return {
    init: init, counts: counts,
    skills: skills, skillsIn: skillsIn, domains: domains,
    DOMAINS: DOMAINS,
    drill: drill, adaptive: adaptive, timed: timed, module: module, mixed: mixed,
    poolFor: function (o) { return o && o.skill ? (bySkill[o.skill] || []) : (o && o.domain ? (byDomain[o.domain] || []) : pool); },
    get: byIdLookup
  };
})();
