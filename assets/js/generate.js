/* ------------------------------------------------------------------
   generate.js — new questions built from the templates catalogued in
   docs/ANALYSIS.md.

   Every template must:
     * compute the key exactly (integers wherever possible),
     * derive each distractor from a NAMED misconception (see §6 of the
       analysis), and
     * pass verify() — four distinct choices, exactly one of which is the
       key, all values finite and cleanly formatted.

   A template that fails verification is discarded and retried, so a bad
   parameter draw can never reach the student.
   ------------------------------------------------------------------ */
window.Gen = (function () {
  'use strict';

  /* ------------------------------------------------------------ util */
  function ri(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = b; b = a % b; a = t; } return a || 1; }

  function frac(n, d) {
    if (d < 0) { n = -n; d = -d; }
    var g = gcd(n, d);
    n /= g; d /= g;
    return d === 1 ? String(n) : (n + '/' + d);
  }
  function num(x) {
    if (!isFinite(x)) return null;
    var r = Math.round(x * 1000) / 1000;
    return String(r);
  }
  function money(x) { return (Math.round(x * 100) / 100).toFixed(2); }

  function shuffleInto(correct, wrongs) {
    // Returns { choices, answerIndex, order } with a uniformly random key slot.
    var all = [correct].concat(wrongs);
    var idx = [0, 1, 2, 3];
    for (var i = idx.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = idx[i]; idx[i] = idx[j]; idx[j] = t;
    }
    var choices = idx.map(function (k) { return all[k]; });
    return { choices: choices, answerIndex: idx.indexOf(0) };
  }

  var LETTERS = ['A', 'B', 'C', 'D'];

  /**
   * Assemble a multiple-choice question.
   * `wrongs` is an array of [value, misconceptionText] pairs.
   */
  function mcq(spec) {
    var wrongVals = spec.wrongs.map(function (w) { return w[0]; });
    var s = shuffleInto(spec.correct, wrongVals);
    var expl = {};
    s.choices.forEach(function (val, i) {
      var L = LETTERS[i];
      if (i === s.answerIndex) {
        expl[L] = 'Correct. ' + spec.correctWhy;
      } else {
        var w = spec.wrongs[wrongVals.indexOf(val)];
        expl[L] = w ? w[1] : 'Does not follow from the given information.';
      }
    });
    return {
      id: 'g' + Math.random().toString(36).slice(2, 10),
      source: 'generated',
      template: spec.template,
      skill: spec.skill,
      domain: spec.domain,
      difficulty: spec.difficulty,
      tier: spec.difficulty < 400 ? 'easy' : (spec.difficulty < 560 ? 'medium' : 'hard'),
      format: 'mcq',
      figure: null,
      needsImage: false,
      stem: spec.stem,
      choices: s.choices,
      answer: LETTERS[s.answerIndex],
      answerIndex: s.answerIndex,
      explanations: expl,
      method: spec.method || '',
      steps: spec.steps || []
    };
  }

  function spr(spec) {
    return {
      id: 'g' + Math.random().toString(36).slice(2, 10),
      source: 'generated',
      template: spec.template,
      skill: spec.skill,
      domain: spec.domain,
      difficulty: spec.difficulty,
      tier: spec.difficulty < 400 ? 'easy' : (spec.difficulty < 560 ? 'medium' : 'hard'),
      format: 'spr',
      figure: null,
      needsImage: false,
      stem: spec.stem,
      accepted: spec.accepted,
      answer: spec.accepted.join(', '),
      explanations: null,
      method: spec.method || '',
      steps: spec.steps || []
    };
  }

  /* --------------------------------------------------------- verify */
  function verify(q) {
    if (!q || !q.stem || !q.skill || !q.domain) return false;
    if (q.format === 'mcq') {
      if (!Array.isArray(q.choices) || q.choices.length !== 4) return false;
      var seen = {};
      for (var i = 0; i < 4; i++) {
        var c = q.choices[i];
        if (c == null || c === '' || c === 'null' || c === 'NaN') return false;
        if (/undefined|Infinity|NaN/.test(String(c))) return false;
        if (seen[c]) return false;           // duplicate choice => ambiguous
        seen[c] = 1;
      }
      if (q.answerIndex < 0 || q.answerIndex > 3) return false;
      for (var k = 0; k < 4; k++) {
        if (!q.explanations[LETTERS[k]]) return false;
      }
      return true;
    }
    if (q.format === 'spr') {
      if (!Array.isArray(q.accepted) || !q.accepted.length) return false;
      for (var j = 0; j < q.accepted.length; j++) {
        var a = String(q.accepted[j]);
        if (!a || /undefined|Infinity|NaN/.test(a)) return false;
      }
      return true;
    }
    return false;
  }

  /* ====================================================== TEMPLATES */
  var T = [];
  function def(o) { T.push(o); }

  var ALG = 'Algebra', ADV = 'Advanced Math';
  var PSDA = 'Problem-Solving and Data Analysis', GEO = 'Geometry and Trigonometry';

  /* ---- Algebra: solve for a transformed quantity (misconception D2) */
  def({
    id: 'lin-composite', skill: 'Linear Equations in One Variable', domain: ALG, weight: 3,
    make: function () {
      var a = pick([3, 4, 5, 6, 7]), x = ri(3, 14), c = ri(4, 30);
      var rhs = a * x - c;
      var shift = ri(2, 12);
      var target = x - shift;
      return mcq({
        template: 'lin-composite', skill: 'Linear Equations in One Variable', domain: ALG,
        difficulty: ri(380, 470),
        stem: 'If ' + a + 'x-' + c + '=' + rhs + ', what is the value of x-' + shift + '?',
        correct: String(target),
        correctWhy: 'Solving gives x=' + x + ', so x-' + shift + '=' + target + '.',
        wrongs: [
          [String(x), 'This is x itself. The question asks for x-' + shift + ', so one more subtraction is needed.'],
          [String(x + shift), 'Added ' + shift + ' instead of subtracting it.'],
          [String(rhs), 'Copied the constant from the right side of the equation.']
        ],
        steps: [
          a + 'x-' + c + '=' + rhs,
          a + 'x=' + (rhs + c),
          'x=' + x,
          'x-' + shift + '=' + target
        ]
      });
    }
  });

  /* ---- Algebra: slope of a perpendicular line (reciprocal error) */
  def({
    id: 'perp-slope', skill: 'Linear Equations in Two Variables', domain: ALG, weight: 2,
    make: function () {
      var p = pick([2, 3, 4, 5, 7, 8]), q = pick([3, 5, 7, 9, 11]);
      if (gcd(p, q) !== 1) return null;
      var b = ri(2, 20);
      var slope = frac(-p, q);          // line k slope = -p/q
      var perp = frac(q, p);            // negative reciprocal
      return mcq({
        template: 'perp-slope', skill: 'Linear Equations in Two Variables', domain: ALG,
        difficulty: ri(370, 450),
        stem: 'Line k is defined by y=-(' + p + '/' + q + ')x+' + b + '. Line j is perpendicular to line k. What is the slope of line j?',
        correct: perp,
        correctWhy: 'Perpendicular slopes are negative reciprocals, so the slope of j is ' + perp + '.',
        wrongs: [
          [frac(-p, q), 'This is the slope of line k itself, not of a perpendicular line.'],
          [frac(-q, p), 'Took the reciprocal but kept the negative sign. Perpendicular slopes must have opposite signs.'],
          [frac(p, q), 'Flipped the sign without taking the reciprocal.']
        ],
        steps: [
          'Slope of k is ' + slope + '.',
          'Perpendicular slope = negative reciprocal.',
          '-1 \\div (' + slope + ') = ' + perp
        ]
      });
    }
  });

  /* ---- Algebra: modelling, which equation (swapped variables D15) */
  def({
    id: 'model-two-rates', skill: 'Linear Equations in Two Variables', domain: ALG, weight: 2,
    make: function () {
      var itemA = pick(['sandwiches', 'notebooks', 'tickets', 'crates']);
      var itemB = pick(['salads', 'binders', 'passes', 'barrels']);
      var ra = ri(2, 9), rb = ri(2, 9);
      if (ra === rb) return null;
      var total = ra * ri(4, 12) + rb * ri(4, 12);
      return mcq({
        template: 'model-two-rates', skill: 'Linear Equations in Two Variables', domain: ALG,
        difficulty: ri(400, 480),
        stem: 'Each of the ' + itemA + ' takes ' + ra + ' minutes to prepare and each of the ' + itemB +
              ' takes ' + rb + ' minutes. A worker spent ' + total + ' minutes preparing x ' + itemA +
              ' and y ' + itemB + '. Which equation represents this situation?',
        correct: ra + 'x+' + rb + 'y=' + total,
        correctWhy: 'Each rate multiplies its own quantity, and the two times add to the total.',
        wrongs: [
          [rb + 'x+' + ra + 'y=' + total, 'The rates are attached to the wrong quantities.'],
          ['x+y=' + total, 'Ignores the rates and counts items as if each took one minute.'],
          [ra + 'x-' + rb + 'y=' + total, 'Subtracts one time from the other instead of adding them.']
        ],
        steps: [
          'Time on ' + itemA + ' = ' + ra + 'x',
          'Time on ' + itemB + ' = ' + rb + 'y',
          ra + 'x+' + rb + 'y=' + total
        ]
      });
    }
  });

  /* ---- Algebra: system, value of a composite */
  def({
    id: 'sys-sum', skill: 'Systems of Linear Equations', domain: ALG, weight: 3,
    make: function () {
      var x = ri(-9, 12), y = ri(-9, 12);
      var a = ri(2, 7), b = ri(2, 7);
      if (a === b) return null;
      var c1 = a * x + b * y, c2 = b * x + a * y;
      var sum = x + y;
      return mcq({
        template: 'sys-sum', skill: 'Systems of Linear Equations', domain: ALG,
        difficulty: ri(430, 520),
        stem: 'If ' + a + 'x+' + b + 'y=' + c1 + ' and ' + b + 'x+' + a + 'y=' + c2 +
              ', what is the value of x+y?',
        correct: String(sum),
        correctWhy: 'Adding the equations gives ' + (a + b) + '(x+y)=' + (c1 + c2) + ', so x+y=' + sum + '.',
        wrongs: [
          [String(x - y), 'This is x-y, which comes from subtracting the equations rather than adding them.'],
          [String(c1 + c2), 'This is the combined right-hand side; it still needs to be divided by ' + (a + b) + '.'],
          [String(sum * 2), 'Doubled the result, as if each equation contributed x+y separately.']
        ],
        steps: [
          'Add the two equations.',
          (a + b) + 'x+' + (a + b) + 'y=' + (c1 + c2),
          (a + b) + '(x+y)=' + (c1 + c2),
          'x+y=' + sum
        ]
      });
    }
  });

  /* ---- Algebra: inequality with a fixed fee (direction flip D18) */
  def({
    id: 'ineq-budget', skill: 'Linear Inequalities', domain: ALG, weight: 2,
    make: function () {
      var fee = ri(15, 60), per = pick([4, 5, 6, 8, 9, 12]);
      var k = ri(5, 25);
      var budget = fee + per * k + ri(0, per - 1);
      var maxN = Math.floor((budget - fee) / per);
      return mcq({
        template: 'ineq-budget', skill: 'Linear Inequalities', domain: ALG,
        difficulty: ri(400, 480),
        stem: 'A venue charges a one-time fee of ' + fee + ' dollars plus ' + per +
              ' dollars per guest. The budget is at most ' + budget +
              ' dollars. What is the greatest number of guests that can be invited?',
        correct: String(maxN),
        correctWhy: 'The guest budget is ' + (budget - fee) + ' dollars, and ' + (budget - fee) + '/' + per +
                    ' rounds down to ' + maxN + '.',
        wrongs: [
          [String(maxN + 1), 'Rounded up. Rounding up exceeds the budget, so it must round down here.'],
          [String(Math.floor(budget / per)), 'Forgot to subtract the one-time fee before dividing.'],
          [String(maxN - 1), 'Rounded down one step too far; ' + maxN + ' guests still fits the budget.']
        ],
        steps: [
          fee + '+' + per + 'n \\le ' + budget,
          per + 'n \\le ' + (budget - fee),
          'n \\le ' + num((budget - fee) / per),
          'n must be a whole number, so n=' + maxN
        ]
      });
    }
  });

  /* ---- Advanced: expand a binomial square (middle term D11) */
  def({
    id: 'binom-square', skill: 'Equivalent Expressions', domain: ADV, weight: 3,
    make: function () {
      var a = ri(2, 7), b = ri(2, 9), sign = pick([1, -1]);
      var s = sign > 0 ? '+' : '-';
      var mid = 2 * a * b * sign;
      var midS = (mid >= 0 ? '+' : '-') + Math.abs(mid);
      return mcq({
        template: 'binom-square', skill: 'Equivalent Expressions', domain: ADV,
        difficulty: ri(400, 480),
        stem: 'Which expression is equivalent to (' + a + 'x' + s + b + ')^2?',
        correct: (a * a) + 'x^2' + midS + 'x+' + (b * b),
        correctWhy: 'Squaring a binomial gives a^2x^2 plus twice the cross product plus b^2.',
        wrongs: [
          [(a * a) + 'x^2+' + (b * b), 'Squared each term separately and omitted the middle term 2ab.'],
          [(a * a) + 'x^2' + (mid >= 0 ? '-' : '+') + Math.abs(mid) + 'x+' + (b * b),
           'Correct terms but the middle term has the wrong sign.'],
          [(a * a) + 'x^2' + midS + 'x-' + (b * b),
           'A squared constant is always positive, so the last term cannot be negative.']
        ],
        steps: [
          '(' + a + 'x' + s + b + ')^2 = (' + a + 'x' + s + b + ')(' + a + 'x' + s + b + ')',
          'First: ' + (a * a) + 'x^2',
          'Middle: 2\\cdot' + a + '\\cdot' + (sign * b) + 'x = ' + mid + 'x',
          'Last: ' + (b * b)
        ]
      });
    }
  });

  /* ---- Advanced: factor a quadratic (sign-pair error D12) */
  def({
    id: 'factor-quad', skill: 'Equivalent Expressions', domain: ADV, weight: 2,
    make: function () {
      var p = ri(2, 11), q = ri(2, 11);
      if (p === q) return null;
      // (x+p)(x-q) = x^2 + (p-q)x - pq
      var mid = p - q, cst = -p * q;
      if (mid === 0) return null;
      var midS = (mid > 0 ? '+' : '-') + Math.abs(mid);
      return mcq({
        template: 'factor-quad', skill: 'Equivalent Expressions', domain: ADV,
        difficulty: ri(390, 470),
        stem: 'Which expression is equivalent to x^2' + midS + 'x-' + (p * q) + '?',
        correct: '(x+' + p + ')(x-' + q + ')',
        correctWhy: 'The factors must multiply to -' + (p * q) + ' and add to ' + mid + '.',
        wrongs: [
          ['(x-' + p + ')(x+' + q + ')', 'The signs are swapped, which produces a middle term of ' + (-mid) + 'x.'],
          ['(x+' + p + ')(x+' + q + ')', 'Both signs positive gives a constant of +' + (p * q) + ', not a negative one.'],
          ['(x-' + p + ')(x-' + q + ')', 'Both signs negative also gives a positive constant of +' + (p * q) + '.']
        ],
        steps: [
          'Need two numbers multiplying to -' + (p * q) + ' and adding to ' + mid + '.',
          'Those numbers are +' + p + ' and -' + q + '.',
          '(x+' + p + ')(x-' + q + ')'
        ]
      });
    }
  });

  /* ---- Advanced: exponential model (percent-as-factor D19) */
  def({
    id: 'exp-model', skill: 'Nonlinear Functions', domain: ADV, weight: 3,
    make: function () {
      var init = pick([1200, 2400, 3000, 5000, 8000, 12000]);
      var pct = pick([3, 4, 5, 6, 8, 12, 15, 20]);
      var grow = pick([true, false]);
      var factor = grow ? (1 + pct / 100) : (1 - pct / 100);
      var fStr = String(Math.round(factor * 100) / 100);
      var wrongFactor = grow ? String(1 - pct / 100) : String(1 + pct / 100);
      return mcq({
        template: 'exp-model', skill: 'Nonlinear Functions', domain: ADV,
        difficulty: ri(430, 520),
        stem: 'A population of ' + init + ' ' + (grow ? 'increases' : 'decreases') + ' by ' + pct +
              ' percent each year. Which function models the population after x years?',
        correct: 'f(x)=' + init + '(' + fStr + ')^x',
        correctWhy: 'A ' + pct + ' percent ' + (grow ? 'increase' : 'decrease') +
                    ' multiplies by ' + fStr + ' each year.',
        wrongs: [
          ['f(x)=' + init + '(' + (pct / 100) + ')^x',
           'Used the percent itself as the multiplier. That would shrink the population to ' + pct + ' percent of its value every year.'],
          ['f(x)=' + init + '(' + wrongFactor + ')^x',
           'Used the factor for the opposite direction, so this models ' + (grow ? 'decay' : 'growth') + '.'],
          ['f(x)=' + fStr + '(' + init + ')^x',
           'The starting value and the growth factor are swapped.']
        ],
        steps: [
          'Start with ' + init + '.',
          (grow ? 'Increase' : 'Decrease') + ' of ' + pct + ' percent means multiply by ' + fStr + '.',
          'f(x)=' + init + '(' + fStr + ')^x'
        ]
      });
    }
  });

  /* ---- Advanced: sum of the roots (grid-in) */
  def({
    id: 'root-sum', skill: 'Nonlinear Equations and Systems', domain: ADV, weight: 2,
    make: function () {
      var r1 = ri(-12, 12), r2 = ri(-12, 12);
      if (r1 === r2) return null;
      var b = -(r1 + r2), c = r1 * r2;
      var bS = (b >= 0 ? '+' : '-') + Math.abs(b);
      var cS = (c >= 0 ? '+' : '-') + Math.abs(c);
      return spr({
        template: 'root-sum', skill: 'Nonlinear Equations and Systems', domain: ADV,
        difficulty: ri(380, 460),
        stem: 'What is the sum of the solutions to x^2' + bS + 'x' + cS + '=0?',
        accepted: [String(r1 + r2)],
        method: 'For x^2+bx+c=0 the sum of the roots is -b.',
        steps: [
          'The roots are ' + r1 + ' and ' + r2 + '.',
          'Sum = -b = ' + (r1 + r2)
        ]
      });
    }
  });

  /* ---- Advanced: evaluate a composite function */
  def({
    id: 'func-eval', skill: 'Nonlinear Functions', domain: ADV, weight: 2,
    make: function () {
      var a = ri(2, 6), b = ri(1, 12), x = ri(2, 7);
      var val = a * x * x + b;
      return mcq({
        template: 'func-eval', skill: 'Nonlinear Functions', domain: ADV,
        difficulty: ri(370, 440),
        stem: 'The function f is defined by f(x)=' + a + 'x^2+' + b + '. What is the value of f(' + x + ')?',
        correct: String(val),
        correctWhy: 'Square the input first, then multiply by ' + a + ' and add ' + b + '.',
        wrongs: [
          [String(a * x * a * x + b), 'Multiplied by ' + a + ' before squaring, which squares the coefficient too.'],
          [String(a * x + b), 'Forgot to square the input.'],
          [String(a * x * x * b), 'Multiplied by ' + b + ' instead of adding it.']
        ],
        steps: [
          x + '^2 = ' + (x * x),
          a + '\\cdot' + (x * x) + ' = ' + (a * x * x),
          (a * x * x) + '+' + b + ' = ' + val
        ]
      });
    }
  });

  /* ---- PSDA: percent change (wrong base D20) */
  def({
    id: 'pct-change', skill: 'Percentages', domain: PSDA, weight: 3,
    make: function () {
      var base = pick([20, 25, 40, 50, 80, 125, 200, 250]);
      var pct = pick([10, 15, 20, 24, 25, 30, 40, 60]);
      var after = base * (1 + pct / 100);
      if (after % 1 !== 0) return null;
      var wrongBase = Math.round((after - base) / after * 1000) / 10;
      if (wrongBase === pct) return null;
      return mcq({
        template: 'pct-change', skill: 'Percentages', domain: PSDA,
        difficulty: ri(390, 470),
        stem: 'A subscription price rose from ' + base + ' dollars to ' + after +
              ' dollars. What was the percent increase?',
        correct: String(pct),
        correctWhy: 'The increase of ' + (after - base) + ' is divided by the ORIGINAL price, ' + base + '.',
        wrongs: [
          [String(wrongBase), 'Divided the increase by the NEW price instead of the original.'],
          [String(after - base), 'This is the raw increase in dollars, not a percent.'],
          [String(Math.round(after / base * 100)), 'This is the new price as a percent of the old one; the increase is that minus 100.']
        ],
        steps: [
          'Increase = ' + after + '-' + base + ' = ' + (after - base),
          'Percent = ' + (after - base) + '/' + base,
          '= ' + pct + ' percent'
        ]
      });
    }
  });

  /* ---- PSDA: unit rate (inverse operation D1) */
  def({
    id: 'unit-rate', skill: 'Ratios, Rates, Proportions, and Units', domain: PSDA, weight: 2,
    make: function () {
      var per = pick([12, 15, 18, 24, 25, 32, 40]);
      var n = ri(6, 40);
      var total = per * n;
      return mcq({
        template: 'unit-rate', skill: 'Ratios, Rates, Proportions, and Units', domain: PSDA,
        difficulty: ri(360, 430),
        stem: 'A machine produces ' + total + ' parts in ' + n + ' hours at a constant rate. How many parts does it produce per hour?',
        correct: String(per),
        correctWhy: 'Divide the total by the number of hours.',
        wrongs: [
          [String(total * n), 'Multiplied instead of dividing.'],
          [num(n / per), 'Inverted the rate: this is hours per part, not parts per hour.'],
          [String(total - n), 'Subtracted the hours from the total instead of dividing.']
        ],
        steps: [total + '\\div' + n + ' = ' + per]
      });
    }
  });

  /* ---- PSDA: median vs mode (D30) */
  def({
    id: 'median-list', skill: 'One-Variable Data', domain: PSDA, weight: 2,
    make: function () {
      var mode = ri(2, 6);
      var vals = [mode, mode, mode, ri(7, 9), ri(10, 13), ri(14, 18), ri(19, 30)];
      vals.sort(function (a, b) { return a - b; });
      var med = vals[3];
      var mean = vals.reduce(function (s, v) { return s + v; }, 0) / vals.length;
      var range = vals[6] - vals[0];
      if (med === mode || med === range) return null;
      var meanS = num(mean);
      if (meanS === String(med) || meanS === String(mode)) return null;
      return mcq({
        template: 'median-list', skill: 'One-Variable Data', domain: PSDA,
        difficulty: ri(400, 470),
        stem: 'What is the median of the data set ' + vals.join(', ') + '?',
        correct: String(med),
        correctWhy: 'With seven sorted values the median is the fourth one.',
        wrongs: [
          [String(mode), 'This is the mode, the most frequent value, not the middle value.'],
          [meanS, 'This is the mean. The median is the middle value after sorting.'],
          [String(range), 'This is the range, the largest value minus the smallest.']
        ],
        steps: [
          'Sorted: ' + vals.join(', '),
          'Seven values, so the median is the 4th: ' + med
        ]
      });
    }
  });

  /* ---- PSDA: proportional scaling (inverted ratio D9) */
  def({
    id: 'proportion', skill: 'Ratios, Rates, Proportions, and Units', domain: PSDA, weight: 2,
    make: function () {
      var k = pick([2, 3, 4, 5, 6]);
      var a = ri(3, 15), b = a * k;
      var c = ri(4, 20), d = c * k;
      return mcq({
        template: 'proportion', skill: 'Ratios, Rates, Proportions, and Units', domain: PSDA,
        difficulty: ri(380, 460),
        stem: 'The ratio of a to b is ' + a + ' to ' + b + '. If a equals ' + c + ', what is the value of b?',
        correct: String(d),
        correctWhy: 'The ratio simplifies to 1 to ' + k + ', so b is ' + k + ' times a.',
        wrongs: [
          [num(c / k), 'Divided by ' + k + ' instead of multiplying: this inverts the ratio.'],
          [String(c + (b - a)), 'Added the difference between a and b instead of scaling by the ratio.'],
          [String(b), 'Copied b from the original ratio without rescaling it.']
        ],
        steps: [
          a + ':' + b + ' simplifies to 1:' + k,
          'b = ' + k + '\\cdot' + c + ' = ' + d
        ]
      });
    }
  });

  /* ---- Geometry: scale factor and area (wrong power D8) */
  def({
    id: 'scale-area', skill: 'Area and Volume', domain: GEO, weight: 3,
    make: function () {
      var k = pick([2, 3, 4, 5, 6]);
      var areaA = pick([6, 8, 12, 15, 20, 24, 30]);
      var areaB = areaA * k * k;
      return mcq({
        template: 'scale-area', skill: 'Area and Volume', domain: GEO,
        difficulty: ri(420, 500),
        stem: 'Triangle P is similar to triangle Q, and each side of Q is ' + k +
              ' times the corresponding side of P. The area of P is ' + areaA +
              ' square inches. What is the area of Q, in square inches?',
        correct: String(areaB),
        correctWhy: 'Areas scale by the SQUARE of the linear scale factor, so multiply by ' + (k * k) + '.',
        wrongs: [
          [String(areaA * k), 'Scaled the area by ' + k + '. Lengths scale by ' + k + ', but areas scale by ' + k + '^2.'],
          [String(areaA * k * k * k), 'Used ' + k + '^3, which is the factor for VOLUME, not area.'],
          [String(areaA + k), 'Added the scale factor instead of multiplying by it.']
        ],
        steps: [
          'Linear factor = ' + k,
          'Area factor = ' + k + '^2 = ' + (k * k),
          areaA + '\\cdot' + (k * k) + ' = ' + areaB
        ]
      });
    }
  });

  /* ---- Geometry: cylinder volume from a diameter (D6) */
  def({
    id: 'cyl-diameter', skill: 'Area and Volume', domain: GEO, weight: 2,
    make: function () {
      var d = pick([4, 6, 8, 10, 12, 14]);
      var h = ri(3, 15);
      var r = d / 2;
      return mcq({
        template: 'cyl-diameter', skill: 'Area and Volume', domain: GEO,
        difficulty: ri(400, 480),
        stem: 'A right circular cylinder has a diameter of ' + d + ' inches and a height of ' + h +
              ' inches. What is the volume, in cubic inches?',
        correct: (r * r * h) + 'pi',
        correctWhy: 'The radius is half the diameter, so V = pi(' + r + ')^2(' + h + ').',
        wrongs: [
          [(d * d * h) + 'pi', 'Used the diameter as the radius. The radius is ' + r + ', not ' + d + '.'],
          [(r * r) + 'pi', 'Computed the base area but forgot to multiply by the height.'],
          [(r * h) + 'pi', 'Did not square the radius.']
        ],
        steps: [
          'r = ' + d + '/2 = ' + r,
          'V = \\pi r^2 h',
          'V = \\pi(' + r + ')^2(' + h + ') = ' + (r * r * h) + '\\pi'
        ]
      });
    }
  });

  /* ---- Geometry: right triangle side (Pythagorean) */
  def({
    id: 'pythag', skill: 'Right Triangles and Trigonometry', domain: GEO, weight: 2,
    make: function () {
      var trip = pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 40, 41]]);
      var m = pick([1, 1, 2, 3]);
      var a = trip[0] * m, b = trip[1] * m, c = trip[2] * m;
      return mcq({
        template: 'pythag', skill: 'Right Triangles and Trigonometry', domain: GEO,
        difficulty: ri(390, 470),
        stem: 'A right triangle has legs of length ' + a + ' and ' + b + '. What is the length of the hypotenuse?',
        correct: String(c),
        correctWhy: 'a^2+b^2 = ' + (a * a) + '+' + (b * b) + ' = ' + (c * c) + ', and the square root of that is ' + c + '.',
        wrongs: [
          [String(a + b), 'Added the legs. The hypotenuse is always shorter than the sum of the legs.'],
          [String(c * c), 'This is c^2. The square root still needs to be taken.'],
          [String(b - a), 'Subtracted the legs, which is the Pythagorean relation applied backwards.']
        ],
        steps: [
          a + '^2+' + b + '^2 = ' + (a * a) + '+' + (b * b),
          '= ' + (c * c),
          '\\sqrt{' + (c * c) + '} = ' + c
        ]
      });
    }
  });

  /* ---- Geometry: circle equation, centre and radius (D24 / D7) */
  def({
    id: 'circle-eq', skill: 'Circles', domain: GEO, weight: 2,
    make: function () {
      var h = ri(-9, 9), k = ri(-9, 9), r = ri(2, 12);
      if (h === 0 && k === 0) return null;
      var hs = h >= 0 ? '-' + h : '+' + (-h);
      var ks = k >= 0 ? '-' + k : '+' + (-k);
      return mcq({
        template: 'circle-eq', skill: 'Circles', domain: GEO,
        difficulty: ri(390, 470),
        stem: 'In the xy-plane, the graph of (x' + hs + ')^2+(y' + ks + ')^2=' + (r * r) +
              ' is a circle. What are the coordinates of the center and the length of the radius?',
        correct: 'center (' + h + ',' + k + '), radius ' + r,
        correctWhy: 'In (x-h)^2+(y-k)^2=r^2 the center is (h,k) and the radius is the square root of the constant.',
        wrongs: [
          ['center (' + (-h) + ',' + (-k) + '), radius ' + r,
           'Read the signs straight off the equation. The equation subtracts h and k, so the signs flip.'],
          ['center (' + h + ',' + k + '), radius ' + (r * r),
           'Gave r^2 as the radius. The constant on the right is the square of the radius.'],
          ['center (' + (-h) + ',' + (-k) + '), radius ' + (r * r),
           'Both the sign of the center and the square root of the radius are wrong.']
        ],
        steps: [
          'Compare with (x-h)^2+(y-k)^2=r^2.',
          'h = ' + h + ', k = ' + k,
          'r = \\sqrt{' + (r * r) + '} = ' + r
        ]
      });
    }
  });

  /* ---- Geometry: parallel lines, supplementary vs corresponding (D23) */
  def({
    id: 'parallel-angle', skill: 'Lines, Angles, and Triangles', domain: GEO, weight: 2,
    make: function () {
      var a = ri(25, 155);
      if (a === 90) return null;
      var sup = 180 - a;
      if (sup === a) return null;
      return mcq({
        template: 'parallel-angle', skill: 'Lines, Angles, and Triangles', domain: GEO,
        difficulty: ri(440, 540),
        stem: 'Lines m and n are parallel and are cut by a transversal. One of the angles formed at line m measures ' +
              a + ' degrees. A co-interior (same-side interior) angle at line n measures w degrees. What is the value of w?',
        correct: String(sup),
        correctWhy: 'Co-interior angles on parallel lines are supplementary, so w = 180 - ' + a + '.',
        wrongs: [
          [String(a), 'This would be true for corresponding or alternate angles, but co-interior angles are supplementary, not equal.'],
          [String(90 - a > 0 ? 90 - a : a - 90), 'Used the complement rather than the supplement.'],
          [String(360 - a), 'Subtracted from 360. A straight line gives 180 degrees.']
        ],
        steps: [
          'Co-interior angles sum to 180.',
          'w = 180-' + a + ' = ' + sup
        ]
      });
    }
  });

  /* ---- Advanced: no-solution parameter */
  def({
    id: 'no-solution', skill: 'Systems of Linear Equations', domain: ALG, weight: 2,
    make: function () {
      var m = pick([2, 3, 4, 5, 6, 7]);
      var b1 = ri(1, 12), b2 = ri(1, 12);
      if (b1 === b2) return null;
      return mcq({
        template: 'no-solution', skill: 'Systems of Linear Equations', domain: ALG,
        difficulty: ri(430, 520),
        stem: 'The system y=' + m + 'x+' + b1 + ' and y=ax+' + b2 +
              ' has no solution. What is the value of a?',
        correct: String(m),
        correctWhy: 'No solution means the lines are parallel, so the slopes must be equal and the intercepts must differ.',
        wrongs: [
          [String(-m), 'A negative slope would make the lines intersect, which gives exactly one solution.'],
          [String(b2), 'This is the y-intercept of the second line, not its slope.'],
          [frac(1, m), 'This is the reciprocal of the slope, which is unrelated to parallel lines.']
        ],
        steps: [
          'Parallel lines have equal slopes.',
          'a = ' + m,
          'The intercepts ' + b1 + ' and ' + b2 + ' differ, so there is no solution.'
        ]
      });
    }
  });

  /* ---- PSDA: probability from a two-way table */
  def({
    id: 'prob-conditional', skill: 'Probability', domain: PSDA, weight: 2,
    make: function () {
      var a = ri(8, 40), b = ri(8, 40), c = ri(8, 40), d = ri(8, 40);
      var rowA = a + b, total = a + b + c + d;
      if (gcd(a, rowA) === rowA) return null;      // avoid a trivial 1/1
      var correct = frac(a, rowA);
      var w1 = frac(a, total), w2 = frac(a, a + c), w3 = frac(rowA, total);
      if (w1 === correct || w2 === correct || w3 === correct) return null;
      if (w1 === w2 || w1 === w3 || w2 === w3) return null;
      return mcq({
        template: 'prob-conditional', skill: 'Probability', domain: PSDA,
        difficulty: ri(500, 600),
        stem: 'Of ' + total + ' surveyed students, ' + rowA + ' ride the bus; of those, ' + a +
              ' also play a sport. Given that a randomly chosen student rides the bus, what is the probability that the student plays a sport?',
        correct: correct,
        correctWhy: 'A conditional probability uses the given group as the denominator, so divide by ' + rowA + '.',
        wrongs: [
          [w1, 'Used the grand total ' + total + ' as the denominator, which ignores the given condition.'],
          [w2, 'Used the sport column total instead of the bus row total.'],
          [w3, 'This is the probability of riding the bus, not the conditional probability asked for.']
        ],
        steps: [
          'Condition on bus riders: ' + rowA + ' students.',
          'Of those, ' + a + ' play a sport.',
          'P = ' + a + '/' + rowA + ' = ' + correct
        ]
      });
    }
  });

  /* ==================================================== public API */
  var byId = {};
  T.forEach(function (t) { byId[t.id] = t; });

  function expand(list) {
    var out = [];
    list.forEach(function (t) { for (var i = 0; i < (t.weight || 1); i++) out.push(t); });
    return out;
  }

  /**
   * Produce one verified question.
   * `filter` may supply { domain, skill } to constrain the template pool.
   */
  function one(filter) {
    var pool = T;
    if (filter && filter.skill) pool = T.filter(function (t) { return t.skill === filter.skill; });
    else if (filter && filter.domain) pool = T.filter(function (t) { return t.domain === filter.domain; });
    if (!pool.length) pool = T;
    var weighted = expand(pool);

    for (var attempt = 0; attempt < 60; attempt++) {
      var t = pick(weighted);
      var q;
      try { q = t.make(); } catch (e) { q = null; }
      if (q && verify(q)) return q;
    }
    return null;
  }

  function many(n, filter) {
    var out = [], guard = 0;
    while (out.length < n && guard < n * 40) {
      guard++;
      var q = one(filter);
      if (q) out.push(q);
    }
    return out;
  }

  function skills() {
    var s = {};
    T.forEach(function (t) { s[t.skill] = 1; });
    return Object.keys(s);
  }

  function selfTest() {
    var fails = [], made = 0;
    T.forEach(function (t) {
      for (var i = 0; i < 40; i++) {
        var q;
        try { q = t.make(); } catch (e) { fails.push(t.id + ': threw ' + e.message); continue; }
        if (q === null) continue;              // deliberate reject, fine
        made++;
        if (!verify(q)) fails.push(t.id + ': failed verify');
      }
    });
    return { templates: T.length, produced: made, failures: fails };
  }

  return { one: one, many: many, verify: verify, skills: skills, templates: T, selfTest: selfTest };
})();
