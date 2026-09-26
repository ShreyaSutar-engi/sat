/* ------------------------------------------------------------------
   app.js — bootstrap.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  function fail(msg) {
    var boot = document.getElementById('boot');
    if (boot) {
      boot.querySelector('.boot__msg').textContent = msg;
      boot.querySelector('.boot__msg').style.color = 'var(--bad)';
    }
  }

  function start() {
    if (!window.SAT_BANK || !window.SAT_BANK.questions) {
      fail('Question bank failed to load. Check that data/bank.js is present.');
      return;
    }

    var n = Bank.init();
    if (!n) { fail('No servable questions found in the bank.'); return; }

    // Surface template problems loudly in the console during development.
    if (window.location.search.indexOf('selftest') !== -1) {
      var res = Gen.selfTest();
      console.log('[generator] templates=' + res.templates + ' produced=' + res.produced +
                  ' failures=' + res.failures.length);
      res.failures.forEach(function (f) { console.warn('[generator] ' + f); });
    }

    UI.init();

    var boot = document.getElementById('boot');
    if (boot) boot.remove();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
