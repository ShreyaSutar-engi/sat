/* ------------------------------------------------------------------
   math.js — turns the corpus's ASCII-math notation into KaTeX output.

   The corpus stores stems as prose with embedded math written without
   internal spaces ("5p+180=250", "x^2+6x+4", "(0,8)"). We locate those
   islands, convert them to LaTeX, and render. Everything else stays as
   escaped text, so a miss degrades to plain prose rather than garbage.
   ------------------------------------------------------------------ */
window.M = (function () {
  'use strict';

  var FUNCS = ['sqrt', 'cuberoot', 'sin', 'cos', 'tan', 'log', 'abs', 'pi'];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------------------------------------------- ASCII math -> LaTeX */
  function toTex(src) {
    var s = String(src);

    // roots
    s = s.replace(/cuberoot\s*\(([^()]*)\)/g, '\\sqrt[3]{$1}');
    s = s.replace(/sqrt\s*\(([^()]*)\)/g, '\\sqrt{$1}');
    s = s.replace(/sqrt\s*(\d+(?:\.\d+)?)/g, '\\sqrt{$1}');

    // constants & relations
    s = s.replace(/\bpi\b/g, '\\pi ');
    s = s.replace(/<=/g, '\\le ').replace(/>=/g, '\\ge ').replace(/!=/g, '\\ne ');
    s = s.replace(/\*/g, '\\cdot ');

    // exponents: x^-2, x^2, x^(1/2), x^{...}
    s = s.replace(/\^\(([^()]*)\)/g, '^{$1}');
    s = s.replace(/\^(-?\d+(?:\.\d+)?|-?[A-Za-z]\b)/g, '^{$1}');

    // parenthesised simple fractions -> \frac
    s = s.replace(/\((-?\d+)\s*\/\s*(\d+)\)/g, '\\frac{$1}{$2}');
    // bare numeric fractions, but not decimals or dates
    s = s.replace(/(^|[\s=+\-*(,])(-?\d+)\s*\/\s*(\d+)(?=$|[\s=+\-*),])/g, '$1\\frac{$2}{$3}');

    return s;
  }

  function render(tex, display) {
    if (typeof katex === 'undefined') return esc(tex);
    try {
      return katex.renderToString(tex, {
        throwOnError: false,
        displayMode: !!display,
        strict: false,
        output: 'html'
      });
    } catch (e) {
      return esc(tex);
    }
  }

  /* ------------------------------------------------ island detection */
  // Characters allowed inside a no-space math run.
  var RUN = /[A-Za-z0-9_.,^=<>+\-*/()[\]|√]+/g;

  function looksLikeMath(run) {
    if (run.length < 2) return false;

    // Any long alphabetic word (other than a known function) means prose:
    // this is what keeps "x-intercept", "one-time", "well-known" out.
    var words = run.match(/[A-Za-z]{2,}/g) || [];
    for (var i = 0; i < words.length; i++) {
      if (FUNCS.indexOf(words[i].toLowerCase()) === -1 && words[i].length >= 3) return false;
    }

    // Plain number, possibly with thousands separators or a decimal point.
    if (/^-?[\d.,]+$/.test(run)) return false;
    // Year ranges and similar "1234-5678".
    if (/^\d{3,4}-\d{3,4}$/.test(run)) return false;
    // Trailing/leading punctuation only.
    if (!/[A-Za-z0-9]/.test(run)) return false;

    var hasOp      = /[\^=<>/*]/.test(run);
    var hasParen   = /[()]/.test(run);
    var coeffVar   = /\d[A-Za-z]|[A-Za-z]\d/.test(run);   // 5p, 2x, x2
    var signedTerm = /[A-Za-z][+\-][A-Za-z0-9]/.test(run); // a+b, x-1

    return hasOp || hasParen || coeffVar || signedTerm;
  }

  // Trim punctuation that belongs to the sentence, not the expression.
  function trimEdges(run, start) {
    var s = run, off = start;
    while (s.length && /^[,.]/.test(s)) { s = s.slice(1); off++; }
    while (s.length && /[,.]$/.test(s)) {
      // keep a trailing dot if it is a decimal point inside a number
      if (/\d\.$/.test(s) && /\.\d/.test(s.slice(0, -1))) break;
      s = s.slice(0, -1);
    }
    // never strip a closing paren that has a matching opener
    return { text: s, start: off };
  }

  /**
   * Render prose that may contain embedded math.
   * Returns an HTML string.
   */
  function inline(src) {
    if (src == null) return '';
    var text = String(src);
    var out = '';
    var last = 0;
    var m;

    RUN.lastIndex = 0;
    while ((m = RUN.exec(text)) !== null) {
      var t = trimEdges(m[0], m.index);
      if (!t.text || !looksLikeMath(t.text)) continue;

      var a = t.start;
      var b = t.start + t.text.length;
      if (a < last) continue;

      out += esc(text.slice(last, a));
      out += '<span class="m">' + render(toTex(t.text), false) + '</span>';
      last = b;
    }
    out += esc(text.slice(last));
    return out;
  }

  /**
   * Render a string that is expected to be entirely mathematical
   * (an answer choice, a grid-in value). Falls back to inline handling
   * when the string is clearly prose.
   */
  function expr(src) {
    if (src == null) return '';
    var s = String(src).trim();
    if (!s) return '';

    // Choices such as "It must decrease by 24.5 units." are prose.
    var words = s.match(/[A-Za-z]{4,}/g) || [];
    var known = words.filter(function (w) { return FUNCS.indexOf(w.toLowerCase()) === -1; });
    if (known.length > 0) return inline(s);

    return '<span class="m">' + render(toTex(s), false) + '</span>';
  }

  /** Mount rendered HTML into an element. */
  function into(el, html) { if (el) el.innerHTML = html; }

  return { esc: esc, toTex: toTex, inline: inline, expr: expr, render: render, into: into };
})();
