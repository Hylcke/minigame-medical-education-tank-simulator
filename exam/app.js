(function () {
  'use strict';
  var $ = U.$, fmt = U.fmt, E = ExamCore, T = Phys.TARGETS, W = Phys.WEAPONS;
  var STORE_KEY = 'tanksim.exam.v2';
  var NB = ' '; // keeps a number and its unit on one line

  var S = {
    phase: 'intro',     // intro | brief | active | firing | debrief | results
    code: '', levels: [], idx: 0, results: [], repeat: false,
    t0: 0, elapsed: 0, field: 112, panAz: 0, panEl: 0,
    anim: null, fx: null, readyAt: 0, resultsAt: 0, userField: 112, parCrossed: false
  };

  /* ---------- helpers ---------- */
  function clock(sec) {
    var t = Math.round(Math.max(0, sec) * 10) / 10, m = Math.floor(t / 60), s = t - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
  }
  function parClock(sec) { var m = Math.floor(sec / 60), s = Math.round(sec - m * 60); return m + ':' + (s < 10 ? '0' : '') + s; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function announce(msg) { var a = $('#announce'); a.textContent = ''; setTimeout(function () { a.textContent = msg; }, 30); }
  function show(id) { ['intro', 'stage', 'results'].forEach(function (s) { $('#' + s).hidden = s !== id; }); if (id !== 'stage') document.body.classList.remove('exam-running'); window.scrollTo(0, 0); }
  function dirWord(d) { return d > 0 ? 'left to right' : 'right to left'; }
  function scen() { return S.levels[S.idx]; }
  function u(n, unit) { return n + NB + unit; }
  function size(x) { return fmt(x, Math.round(x * 10) === x * 10 ? 1 : 2); } // 2.2 but 2.45
  function targetNow(s, extraAz) {
    return { key: s.key, aspect: s.aspect, angle: s.angle, range: s.R, az: s.az + (extraAz || 0), flip: s.flip };
  }

  /* Best scores, per code, in this browser. Every access can throw (private mode, blocked storage). */
  var Store = {
    read: function () {
      var raw;
      try { raw = localStorage.getItem(STORE_KEY); } catch (e) { return null; }      // storage blocked
      var v = null;
      try { v = raw ? JSON.parse(raw) : null; } catch (e) { v = null; }              // corrupt: start again
      var clean = { codes: {} };
      if (v && typeof v === 'object' && v.codes && typeof v.codes === 'object') {
        Object.keys(v.codes).forEach(function (c) {
          var r = v.codes[c], code = E.normaliseCode(c);
          if (!code || !r || typeof r !== 'object') return;
          clean.codes[code] = { best: isFinite(r.best) ? +r.best : null, first: isFinite(r.first) ? +r.first : null, plays: isFinite(r.plays) ? +r.plays : 0, started: !!r.started };
        });
      }
      return clean;
    },
    write: function (v) { try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };
  function bestOverall(db) {
    var best = null;
    if (!db) return null;
    Object.keys(db.codes).forEach(function (c) { var r = db.codes[c]; if (r && typeof r.best === 'number' && (!best || r.best > best.score)) best = { score: r.best, code: c }; });
    return best;
  }

  /* One deliberate press per action: ignore held keys and very quick repeats. */
  document.addEventListener('keydown', function (e) {
    if (e.repeat && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  /* ---------- intro ---------- */
  var BLURBS = [
    'Read a vehicle that is not moving against the scale and give its range.',
    'Your sight is stuck on the wrong mark. Work out how far above the middle of the tank to aim.',
    'A vehicle is crossing your front. Work out how far ahead of it to aim.',
    'Read the range of a crossing vehicle, then work out how far ahead to aim.',
    'A tank at an angle and a slow rocket. Range from its height, then how far ahead to aim.'
  ];
  var MEASURE = '<b><span class="ptr-fine">Drag, or use the arrow keys,</span><span class="ptr-coarse">Drag with your finger</span></b> ';
  var CAPTIONS = [
    MEASURE + 'to put one end of the hull on the centre line, then count mils to the other end. Small ticks 1 mil, numbers every 10.',
    'Nothing to measure here. It is all in the orders. After you fire, the circle shows where you aimed and the X where the round went.',
    'Nothing to measure here. It is all in the orders. After you fire, the dashed box shows where the vehicle was when you pressed Fire.',
    MEASURE + 'to put one end of the hull on the centre line, then count mils to the other end. Small ticks 1 mil, numbers every 10.',
    MEASURE + 'to sit the tracks on the zero of the vertical scale, then read the top of the turret.'
  ];
  function pulse(el) { if (!el || U.reduced) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  function showBest() {
    var b = bestOverall(Store.read());
    $('#best').hidden = !b;
    if (b) $('#best').textContent = 'Your best in this browser: ' + b.score + ' (exam code ' + b.code + ').';
  }
  function buildIntro() {
    $('#level-list').innerHTML = E.LEVELS.map(function (l, i) {
      return '<li><span class="ll-n">' + l.id + '</span><span><b>' + l.name + '</b><span>' + BLURBS[i] + '</span></span><span class="ll-par">par ' + parClock(l.par) + '</span></li>';
    }).join('');
    var code = E.normaliseCode(new URLSearchParams(location.search).get('code') || '') || E.makeCode();
    $('#code').value = code;
    showBest();
  }
  $('#new-code').addEventListener('click', function () { $('#code').value = E.makeCode(); codeError(''); $('#code').focus(); });
  $('#code').addEventListener('input', function () {
    var c = $('#code'), pos = c.selectionStart, v = c.value.toUpperCase();
    if (v !== c.value) { c.value = v; try { c.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } }
    codeError('');
  });
  $('#code').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); begin(); } });
  $('#begin').addEventListener('click', function () { begin(); });
  function codeError(msg) { $('#code-err').textContent = msg; $('#code').setAttribute('aria-invalid', msg ? 'true' : 'false'); }

  function begin(forceCode) {
    var raw = forceCode || $('#code').value, code = E.normaliseCode(raw);
    if (!String(raw).trim()) { code = E.makeCode(); $('#code').value = code; }
    else if (code.length < 3) { codeError('Exam codes are at least 3 letters or numbers. Check the code, or press New code.'); $('#code').focus(); return; }
    var cleaned = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleaned.length > 8) { codeError('Exam codes are up to 8 letters or numbers. Check the code.'); $('#code').focus(); return; }
    $('#code').value = code; codeError('');
    var db = Store.read();
    S.repeat = !!(db && db.codes[code]);
    if (db && !db.codes[code]) { db.codes[code] = { best: null, first: null, plays: 0, started: true }; Store.write(db); }
    S.code = code; S.levels = E.scenarios(code); S.results = []; S.idx = 0;
    try { history.replaceState(null, '', '?code=' + code); } catch (e) { /* file:// may refuse */ }
    show('stage');
    loadLevel();
  }

  /* ---------- level ---------- */
  function buildPips(animateTotal) {
    $('#pips').innerHTML = E.LEVELS.map(function (l, i) {
      var st = i < S.idx ? 'done' : i === S.idx ? 'now' : '';
      var r = S.results[i];
      return '<li data-i="' + i + '" class="' + st + '"' + (i === S.idx ? ' aria-current="step"' : '') + '><span class="pip-n">' + l.id + '</span><span class="pip-name">' + l.name + '</span>' + (r ? '<span class="pip-score">' + r.total + '</span>' : '') + '</li>';
    }).join('');
    var tot = S.results.reduce(function (t, r) { return t + (r ? r.total : 0); }, 0), el = $('#running');
    if (animateTotal && !U.reduced) { countUp(el, +el.textContent || 0, tot); pulse(el); } else el.textContent = tot;
    U.$$('#pips .pip-score').forEach(function (p) { var i = +p.parentNode.getAttribute('data-i'); if (S.results[i] && S.results[i].total === 0) p.classList.add('zero'); if (animateTotal && i === S.idx) p.classList.add('fresh'); });
  }
  function closeConfirm() { $('#quit-confirm').hidden = true; $('#quit').hidden = false; }

  function loadLevel() {
    stopAnim(); closeConfirm();
    var s = scen(), lv = E.LEVELS[S.idx];
    S.phase = 'brief'; S.elapsed = 0; S.fx = null; S.readyAt = performance.now() + 350;
    buildPips();
    U.clearStamp($('#stamp'));
    $('#debrief').hidden = true;
    $('#clock').textContent = clock(0);
    $('#par').textContent = 'par ' + parClock(lv.par);
    $('#clock-fill').style.width = '0%';
    $('#clock-box').classList.remove('over', 'late');
    S.parCrossed = false;
    setZoom(S.userField);
    $('#how').innerHTML = CAPTIONS[S.idx];
    document.body.classList.remove('exam-running', 'exam-debrief');
    $('#veil').hidden = false;
    $('#view').tabIndex = -1;
    $('#veil-kicker').textContent = 'Level ' + lv.id + ' of 5';
    $('#veil-title').textContent = lv.name;
    $('#veil-text').textContent = BLURBS[S.idx];
    $('#veil-par').textContent = 'Par ' + parClock(lv.par) + '. The clock starts when you press Start.';
    $('#start').textContent = 'Start level ' + lv.id;
    $('#orders-body').innerHTML = '<p class="note">Your orders appear when you press Start. Have your pen ready.</p>';
    $('#fields').innerHTML = '';
    $('#fire').disabled = true;
    $('#answer-form').hidden = true;
    $('#quick').hidden = true;
    // starting view: horizon in view, vehicle off the scale so you have to line it up
    var c = Scope.centre(targetNow(s));
    S.panAz = c.az + Math.min(14, S.userField * 0.18); S.panEl = c.el + Math.min(6, S.userField * 0.08);
    view.redraw();
    $('#start').focus({ preventScroll: true });
  }

  $('#start').addEventListener('click', startLevel);
  function startLevel() {
    if (S.phase !== 'brief' || performance.now() < S.readyAt) return;
    var s = scen();
    S.phase = 'active';
    $('#veil').hidden = true;
    $('#view').tabIndex = 0;
    $('#orders-body').innerHTML = orders(s);
    $('#fields').innerHTML = fields(s);
    $('#dock-facts').textContent = dockFacts(s);
    $('#answer-form').hidden = false;
    $('#fire').disabled = false;
    document.body.classList.add('exam-running');
    S.t0 = performance.now();
    view.redraw();
    tick();
    var first = $('#fields input');
    if (first) first.focus({ preventScroll: true });
    announce('Level ' + s.level + ' started. The clock is running.');
  }

  function tick() {
    if (S.phase !== 'active') return;
    S.elapsed = (performance.now() - S.t0) / 1000;
    var par = E.LEVELS[S.idx].par;
    $('#clock').textContent = clock(S.elapsed);
    $('#clock-fill').style.width = Math.min(100, S.elapsed / (par * 4) * 100) + '%';
    $('#clock-box').classList.toggle('over', S.elapsed > par);
    $('#clock-box').classList.toggle('late', S.elapsed > par * 2);
    if (S.elapsed > par && !S.parCrossed) { S.parCrossed = true; pulse($('#clock')); }
    requestAnimationFrame(tick);
  }

  /* ---------- orders and fields ---------- */
  function fact(k, v) { return '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>'; }
  function vName(key) { return { t72: 'T-72 tank', bmp2: 'BMP-2', btr82: 'BTR-82A', ural: 'Ural truck' }[key]; }
  function hullLen(key) { return key === 't72' || key === 'bmp2' ? 'Hull ' + u(size(T[key].length), 'm') + ' long, not counting the gun' : u(size(T[key].length), 'm') + ' long'; }
  function orders(s) {
    var v = T[s.key], w = W[s.weapon], f = [];
    var wpn = w.name + ', ' + u(w.v, 'm/s');
    if (s.level === 1) {
      f.push(fact('Target', vName(s.key) + ', side on, not moving'));
      f.push(fact('Measure', 'Its length in mils'));
      f.push(fact('Known size', hullLen(s.key)));
      f.push(fact('Weapon', w.name + '. Your sight is set to the range you give.'));
    } else if (s.level === 2) {
      f.push(fact('Target', 'T-72 tank, side on, not moving, ' + u(size(v.height), 'm') + ' high'));
      f.push(fact('Range', u(s.R, 'm') + ', measured with a laser rangefinder'));
      f.push(fact('Weapon', wpn));
      f.push(fact('Problem', 'Your sight is stuck at ' + u(s.Rs, 'm') + ', so it only corrects for the drop at ' + u(s.Rs, 'm') + '.'));
    } else if (s.level === 3) {
      f.push(fact('Target', vName(s.key) + ', driving ' + dirWord(s.dir) + ' at ' + u(s.kmh, 'km/h')));
      f.push(fact('Crossing angle', s.angle + '°' + (s.angle === 90 ? ' (straight across)' : '')));
      f.push(fact('Range', u(s.R, 'm') + '. Your sight is set to it.'));
      f.push(fact('Weapon', wpn));
    } else if (s.level === 4) {
      f.push(fact('Target', vName(s.key) + ', side on, driving ' + dirWord(s.dir) + ' at ' + u(s.kmh, 'km/h')));
      f.push(fact('Crossing angle', '90° (straight across)'));
      f.push(fact('Measure', 'Its length in mils'));
      f.push(fact('Known size', hullLen(s.key)));
      f.push(fact('Weapon', wpn + '. Your sight is set to the range you give.'));
    } else {
      f.push(fact('Target', vName(s.key) + ', driving ' + dirWord(s.dir) + ' at ' + u(s.kmh, 'km/h')));
      f.push(fact('Crossing angle', s.angle + '°. You see some of its front, so measure its height, not its length.'));
      f.push(fact('Measure', 'Its height in mils'));
      f.push(fact('Known size', u(size(v.height), 'm') + ' high'));
      f.push(fact('Weapon', wpn + '. Your sight is set to the range you give.'));
    }
    return '<dl class="facts">' + f.join('') + '</dl><div class="formula-card"><div class="fc-title">Formulas</div>' + formulas(s) + '</div>';
  }
  function formulas(s) {
    var L = [];
    if (s.level === 1 || s.level >= 4) L.push('range = size × 1000 ÷ mils');
    if (s.level === 2) {
      L.push('aim above = <span class="nw">9.81 × R</span> <span class="nw">× (R − sight)</span> <span class="nw">÷ (2 × v²)</span>');
      L.push('<span class="fc-short">R = range in m, v = rocket speed in m/s. Keep 4 decimal places until the end.</span>');
      L.push('<span class="fc-short">Same thing in steps: t = R ÷ v, drop = ½ × 9.81 × t², the sight lifts by the drop at its mark × R ÷ mark, aim above = drop − lift.</span>');
    }
    if (s.kmh > 0) {
      L.push('speed in m/s = km/h ÷ 3.6');
      L.push('t = range ÷ rocket speed');
      L.push('lead = speed × t × sin(crossing angle)');
    }
    return '<ul>' + L.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>';
  }
  /* One line for the phone dock, so the key numbers are always in sight. */
  function dockFacts(s) {
    var v = T[s.key], w = W[s.weapon], bits = [];
    if (s.level === 1 || s.level === 4) bits.push(vName(s.key) + ', hull ' + u(size(v.length), 'm'));
    if (s.level === 5) bits.push(vName(s.key) + ', ' + u(size(v.height), 'm') + ' high');
    if (s.level === 2) bits.push(u(s.R, 'm') + ', sight at ' + u(s.Rs, 'm'));
    if (s.level === 3) bits.push(u(s.R, 'm'));
    if (s.kmh > 0) bits.push(u(s.kmh, 'km/h') + ' at ' + s.angle + '\u00B0');
    bits.push(u(w.v, 'm/s'));
    return bits.join(', ');
  }
  function field(id, label, hint) {
    return '<div class="field answer"><label for="' + id + '">' + label + '</label>' +
      '<div class="answer-input"><input id="' + id + '" name="' + id + '" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" aria-describedby="' + id + '-hint ' + id + '-err" aria-invalid="false"><span class="u">m</span></div>' +
      '<p class="hint" id="' + id + '-hint">' + hint + '</p><p class="err" id="' + id + '-err" role="alert"></p></div>';
  }
  function fields(s) {
    var h = '';
    if (s.level === 1 || s.level >= 4) h += field('a-range', 'Range', 'Metres. Whole metres are fine.');
    if (s.level === 2) h += field('a-hold', 'Hold over', 'Metres above the middle, 1 decimal place, e.g. 2.4');
    if (s.kmh > 0) h += field('a-lead', 'Lead', 'Metres ahead of the middle, 1 decimal place, e.g. 6.5');
    return h;
  }

  $('#fields').addEventListener('input', function (e) {
    if (e.target.tagName !== 'INPUT') return;
    var err = $('#' + e.target.id + '-err');
    if (err && err.textContent) { err.textContent = ''; e.target.setAttribute('aria-invalid', 'false'); }
  });

  /* ---------- fire ---------- */
  $('#answer-form').addEventListener('submit', function (e) { e.preventDefault(); fire(); });

  function readAnswers(s) {
    var ids = [];
    if (s.level === 1 || s.level >= 4) ids.push(['a-range', 'range']);
    if (s.level === 2) ids.push(['a-hold', 'hold']);
    if (s.kmh > 0) ids.push(['a-lead', 'lead']);
    var a = {}, raw = {}, firstBad = null;
    ids.forEach(function (p) {
      var inp = $('#' + p[0]), r = E.parseNum(inp.value), msg = '';
      var example = p[1] === 'range' ? 'for example 250' : 'for example 2.4';
      if (!r.ok) msg = String(inp.value).trim() ? 'Type a number of metres, ' + example + '.' : 'Type your answer in metres, ' + example + '.';
      else if (r.unit === 'mils') msg = p[1] === 'range' ? 'That looks like mils. Give the range in metres: size × 1000 ÷ mils.' : 'Give this in metres, not mils.';
      else if (r.unit && r.unit !== 'm') msg = 'Give this in metres.';
      else if (p[1] === 'range' && r.thousands && r.value < 10) msg = 'Did you mean ' + Math.round(r.value * 1000) + '? Type it without a separator.';
      else if (p[1] === 'range' && (r.value < 10 || r.value > 1000)) msg = 'A range between 10 and 1000 m, please.';
      else if (p[1] === 'hold' && (r.value < -20 || r.value > 20)) msg = 'Between −20 and 20 m, please.';
      else if (p[1] === 'lead' && (r.value < -60 || r.value > 60)) msg = 'Between −60 and 60 m, please.';
      $('#' + p[0] + '-err').textContent = msg; inp.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (msg && !firstBad) firstBad = inp;
      a[p[1]] = r.value;
      raw[p[1]] = String(inp.value).trim();
    });
    if (firstBad) { firstBad.focus(); return null; }
    a._raw = raw;
    return a;
  }

  function fire() {
    if (S.phase !== 'active') return;
    var s = scen(), a = readAnswers(s);
    if (!a) return;
    var seconds = (performance.now() - S.t0) / 1000;
    S.phase = 'firing'; S.elapsed = seconds;
    closeConfirm();
    $('#clock').textContent = clock(seconds);
    $('#view').focus({ preventScroll: true });
    $('#fire').disabled = true;
    U.$$('#fields input').forEach(function (i) { i.readOnly = true; });
    var res = E.score(s, a, seconds);
    res.answers = a; res.level = s.level; res.name = E.LEVELS[S.idx].name;
    S.results[S.idx] = res;
    // make sure the shot is on screen
    var vw = $('.view-wrap').getBoundingClientRect(), top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--stick-top')) || 0;
    if (vw.top < top - 4 || vw.top > window.innerHeight * 0.5) window.scrollTo({ top: Math.max(0, window.scrollY + vw.top - top - 8), behavior: U.reduced ? 'auto' : 'smooth' });
    playShot(s, res, function () {
      S.phase = 'debrief';
      document.body.classList.add('exam-debrief');
      var lucky = res.shot.hit && !res.hitPts;
      U.stamp($('#stamp'), res.shot.hit && !lucky, lucky ? 'LUCKY' : res.shot.hit ? 'HIT' : 'MISS', lucky ? 'It hit, but your answer was too far out' : res.shot.why, { settle: 2600, variant: lucky ? 'lucky' : null });
      debrief(s, res);
      buildPips(true);
      announce((lucky ? 'Lucky hit, no marks for it. ' : res.shot.hit ? 'Hit. ' : 'Miss. ') + res.shot.why + '. Level score ' + res.total + ' of 1000.');
    });
  }

  /* ---------- shot animation in the sight ---------- */
  function stopAnim() { if (S.anim) { S.anim(); S.anim = null; } }
  function playShot(s, res, done) {
    var sh = res.shot, R = s.R, mPerMil = R / 1000;
    var t0 = targetNow(s), c0 = Scope.centre(t0);
    var lead = s.kmh > 0 ? res.answers.lead : 0, hold = s.level === 2 ? res.answers.hold : 0;
    var aimAz = c0.az + s.dir * lead / mPerMil, aimEl = c0.el + hold / mPerMil;
    var travel = s.dir * sh.exact / mPerMil;                     // how far the vehicle moves while the round flies
    var impEl = c0.el + sh.vertical / mPerMil, groundEl = Scope.baseEl(R);
    var short = impEl < groundEl;
    var wM = Scope.widthM(t0) * 1000 / R, hM = T[s.key].height * 1000 / R;
    // frame both the aim point and where the vehicle ends up
    var endAz = c0.az + travel, spanAz = Math.abs(aimAz - endAz) + wM;
    if (spanAz > S.field * 0.7 && S.field < 112) setZoom(112, true);   // just for this shot
    var viewAz = (aimAz + endAz) / 2, viewEl = (Math.max(aimEl, impEl) + Math.min(aimEl, impEl, c0.el)) / 2;
    // a wild answer must not leave an empty lens: keep the vehicle in view and point at the rest
    if (spanAz > S.field * 0.9) viewAz = endAz;
    if (Math.abs(impEl - c0.el) > S.field * 0.4 || Math.abs(aimEl - c0.el) > S.field * 0.4) viewEl = c0.el;
    var startAz = S.panAz, startEl = S.panEl;
    var aimDur = 550, flyDur = U.clamp(sh.tof * 1100, 900, 2200);
    S.fx = { travel: 0, round: null, impact: null, aimAz: aimAz, aimEl: aimEl, impAz: aimAz, impEl: short ? groundEl : impEl, hit: sh.hit, short: short,
      ghost: { az: t0.az, el: groundEl, w: wM, h: hM } };
    var ease = function (t) { return 1 - Math.pow(1 - t, 3); };
    if (U.reduced) {
      S.panAz = viewAz; S.panEl = viewEl; S.fx.travel = travel; S.fx.impact = 1; view.redraw(); done(); return;
    }
    S.anim = U.animate(aimDur, function (p) {
      var e = ease(p); S.panAz = U.lerp(startAz, viewAz, e); S.panEl = U.lerp(startEl, viewEl, e); view.redraw();
    }, function () {
      S.anim = U.animate(flyDur, function (p) { S.fx.travel = travel * p; S.fx.round = p; view.redraw(); }, function () {
        S.fx.round = null; S.fx.impact = 0;
        if (sh.hit && !U.reduced) { var vb = $('#view-box'); vb.classList.remove('shake'); void vb.offsetWidth; vb.classList.add('shake'); }
        S.anim = U.animate(600, function (p) { S.fx.impact = p; view.redraw(); }, function () { S.anim = null; S.fx.impact = 1; view.redraw(); done(); });
      });
    });
  }

  function drawFx(ctx, api) {
    var fx = S.fx;
    if (!fx) return;
    ctx.save();
    // where the vehicle was when you fired
    if (Math.abs(fx.travel) > 0.5) {
      ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(232,228,216,0.7)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(api.X(fx.ghost.az), api.Y(fx.ghost.el + fx.ghost.h), fx.ghost.w * api.k, fx.ghost.h * api.k);
      ctx.setLineDash([]);
    }
    // where you aimed
    ctx.strokeStyle = U.C.tracer; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(api.X(fx.aimAz), api.Y(fx.aimEl), 7, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    if (fx.round != null) {
      var p = fx.round;
      var x0 = api.cx, y0 = api.cy + api.R * 0.98, x1 = api.X(fx.impAz), y1 = api.Y(fx.impEl);
      var x = U.lerp(x0, x1, p), y = U.lerp(y0, y1, p) - Math.sin(p * Math.PI) * api.R * 0.12;
      ctx.save(); ctx.shadowColor = 'rgba(242,172,58,0.9)'; ctx.shadowBlur = 18;
      ctx.fillStyle = '#FFD580'; ctx.beginPath(); ctx.arc(x, y, Math.max(1, U.lerp(10, 2.5, p)), 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (fx.impact != null) offLens(ctx, api, fx);
    if (fx.impact != null) {
      var q = fx.impact, ix = api.X(fx.impAz), iy = api.Y(fx.impEl);
      ctx.save();
      if (fx.hit) {
        var rad = Math.max(1, (6 + q * 26) * api.k / 3);
        var g = ctx.createRadialGradient(ix, iy, 0, ix, iy, rad);
        g.addColorStop(0, 'rgba(255,242,201,' + (1 - q * 0.6) + ')'); g.addColorStop(0.4, 'rgba(242,172,58,' + (0.9 - q * 0.6) + ')'); g.addColorStop(1, 'rgba(242,172,58,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ix, iy, rad, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(120,108,80,' + (0.75 - q * 0.45) + ')';
        var dr = Math.max(1, (3 + q * 9) * api.k / 3);
        ctx.beginPath(); ctx.ellipse(ix, iy - dr * 0.4, dr * 1.4, dr, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = fx.hit ? U.C.tracer : U.C.signal; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(ix - 6, iy - 6); ctx.lineTo(ix + 6, iy + 6); ctx.moveTo(ix + 6, iy - 6); ctx.lineTo(ix - 6, iy + 6); ctx.stroke();
      ctx.restore();
    }
  }

  /* If the round landed outside the lens, draw an arrow on the rim pointing at it. */
  function offLens(ctx, api, fx) {
    var ix = api.X(fx.impAz), iy = api.Y(fx.impEl), dx = ix - api.cx, dy = iy - api.cy, d = Math.hypot(dx, dy);
    if (d < api.R - 10) return;
    var ux = dx / d, uy = dy / d, ex = api.cx + ux * (api.R - 18), ey = api.cy + uy * (api.R - 18), a = Math.atan2(uy, ux);
    ctx.save(); ctx.fillStyle = U.C.signal; ctx.translate(ex, ey); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, -9); ctx.lineTo(-6, 9); ctx.closePath(); ctx.fill(); ctx.restore();
  }

  /* ---------- debrief ---------- */
  function errWord(p) {
    var pct = Math.round(p.rel * 100);
    if (pct === 0) return 'spot on';
    if (p.key === 'range') return pct + '% too ' + (p.yours > p.model ? 'long' : 'short');
    if (p.key === 'hold') return 'aimed ' + fmt(Math.abs(p.yours - p.model), 2) + NB + 'm too ' + (p.yours > p.model ? 'high' : 'low');
    if (p.yours > 0 && p.yours / p.model > 1.9 && p.yours / p.model < 2.1) return 'twice as far ahead as needed';
    return pct + '% ' + (p.yours > p.model ? 'too far ahead' : 'not far enough ahead');
  }
  function debrief(s, res) {
    var parts = res.marks.parts;
    var rows = parts.map(function (p) {
      var dp = p.key === 'range' ? 0 : 1;
      var typed = res.answers._raw && res.answers._raw[p.key] ? esc(res.answers._raw[p.key].replace(/\s*(m|metres?|meters?)$/i, '')) : fmt(p.yours, dp);
      return '<tr><th scope="row">' + p.label + '</th><td>' + u(typed, p.unit) + '</td><td>' + u(fmt(p.model, p.key === 'range' ? 0 : 2), p.unit) +
        (p.basis && Math.round(p.basis) !== s.R ? '<span class="sub">using your range of ' + u(fmt(p.basis, 0), 'm') + '</span>' : '') +
        '</td><td class="' + (p.frac >= 0.999 ? 'good' : p.frac <= 0 ? 'bad' : '') + '">' + errWord(p) + '</td></tr>';
    }).join('');
    var lvPar = E.LEVELS[s.level - 1].par;
    var accSub = parts.map(function (p, i) { return (i ? p.label.toLowerCase() : p.label) + ' ' + errWord(p); }).join(', ');
    var accPct = Math.round(res.marks.acc * 100);
    var spdSub = clock(res.seconds) + (res.seconds <= lvPar ? ', inside the ' + parClock(lvPar) + ' par' : ', over the ' + parClock(lvPar) + ' par') +
      (accPct < 100 ? '. Speed only counts in full when the answer is close' : '');
    var h = '<div class="db-score">' +
      tile('Accuracy', res.accuracy, 600, accSub) +
      tile('Speed', res.speed, 300, spdSub) +
      tile('Hit', res.hitPts, 100, res.shot.hit ? (res.hitPts ? 'On target' : 'Lucky. No marks for it') : 'Missed') +
      '</div>';
    h += '<p class="db-cause">' + cause(s, res) + '</p>';
    var tips = E.diagnose(s, res.answers);
    if (tips.length) h += '<div class="db-tips"><b>What probably went wrong</b><ul>' + tips.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>';
    h += '<div class="table-scroll"><table class="db-table"><thead><tr><th scope="col"><span class="sr-only">Answer</span></th><th scope="col">You</th><th scope="col">Model answer</th><th scope="col">Error</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    h += '<details class="working-steps" open><summary>The working</summary>' + working(s, res) + '</details>';
    $('#debrief-body').innerHTML = h;
    $('#debrief').hidden = false;
    var nextLabel = S.idx < 4 ? 'Next: level ' + (S.idx + 2) : 'See my results';
    $('#next').textContent = nextLabel; $('#next2').textContent = nextLabel;
    $('#quick-total').setAttribute('data-count', res.total);
    $('#answer-form').hidden = true; $('#quick').hidden = false;
    countUp($('#quick-total'));
    $('#quick-total').classList.toggle('zero', res.total === 0);
    $('#next2').focus({ preventScroll: true });
  }
  function tile(name, pts, max, sub) {
    var pc = Math.round(pts / max * 100);
    return '<div class="db-tile"><span class="k">' + name + '</span><b>' + pts + '<small> / ' + max + '</small></b><span class="meter"><i style="width:' + pc + '%"></i></span><span class="sub">' + sub + '</span></div>';
  }
  function countUp(el, from, to) {
    if (!el) return;
    var target = to != null ? to : +el.getAttribute('data-count'), start = from || 0;
    if (U.reduced) { el.textContent = target; return; }
    U.animate(700, function (p) { el.textContent = Math.round(start + (target - start) * (1 - Math.pow(1 - p, 3))); });
  }
  /* One plain story that agrees with the stamp. */
  function cause(s, res) {
    var sh = res.shot, a = res.answers, half = T[s.key].height / 2, out = [];
    var rangeOut = (s.level === 1 || s.level >= 4) && Math.abs(a.range - s.R) / s.R > 0.05;
    var inside = res.seconds <= E.LEVELS[s.level - 1].par;
    if (sh.hit && res.hitPts && res.marks.acc >= 0.999) return 'Clean hit, ' + (inside ? 'inside par.' : 'but slower than par.');
    if (sh.hit && res.hitPts) {
      var lostPts = 600 - res.accuracy;
      out.push(esc(sh.why) + ', but your answer was not spot on, so ' + lostPts + ' accuracy points went.');
    }
    else if (sh.hit) out.push('It hit, but only just. Your answer was too far out to earn marks.');
    else out.push(esc(sh.why) + '.');
    if (rangeOut && Math.abs(sh.vertical) > half * 0.6) {   // only when the range error actually moved the round up or down
      var d = Math.round(a.range - s.R);
      out.push('Your range was ' + u(Math.abs(d), 'm') + ' too ' + (d > 0 ? 'long, so the sight lifted the tube too far and the round went high.' : 'short, so the sight did not lift the tube enough and the round dropped.'));
    }
    if (s.level === 2) {
      var need = E.model(s).hold;
      if (Math.abs(a.hold - need) > 0.15) out.push('You aimed ' + u(fmt(a.hold, 2), 'm') + ' above the middle, but ' + u(fmt(need, 2), 'm') + ' was needed, so it went ' + (a.hold > need ? 'over.' : 'low.'));
    }
    if (s.kmh > 0 && Math.abs(sh.lateral) > 0.5) out.push((Math.abs(a.lead) < 0.05 ? 'You aimed at the middle with no lead' : 'You aimed ' + u(fmt(a.lead, 1), 'm') + ' ahead') + ', and it drove ' + u(fmt(sh.exact, 1), 'm') + ' sideways during the ' + u(fmt(sh.tof, 1), 's') + ' flight.');
    return out.join(' ');
  }
  function eq(label, body) { return '<div class="ws"><div class="eq-label">' + label + '</div><div class="eq">' + body + '</div></div>'; }
  function v(x) { return '<span class="v">' + x + '</span>'; }
  function r(x, d) { var p = Math.pow(10, d); return Math.round(x * p) / p; }
  /* Every line is worked from the numbers it shows, so a calculator gives the same answer. */
  function working(s, res) {
    var h = '', tg = T[s.key];
    if (s.level === 1 || s.level >= 4) {
      var sz = s.measure === 'height' ? tg.height : tg.length, mils = r(sz * 1000 / s.R, 3);
      var dimWord = s.measure === 'height' ? 'height' : (s.key === 't72' || s.key === 'bmp2' ? 'hull length' : 'length');
      h += eq('Range: its ' + dimWord + ' covered ' + fmt(mils, 3) + ' mils', 'range = ' + v(size(sz)) + ' × 1000 ÷ ' + v(fmt(mils, 3)) + ' = <span class="res">' + u(fmt(sz * 1000 / mils, 0), 'm') + '</span>');
    }
    if (s.level === 2) {
      var one = 9.81 * s.R * (s.R - s.Rs) / (2 * s.v * s.v);
      h += eq('In one go', '9.81 × ' + v(s.R) + ' × (' + v(s.R) + ' − ' + v(s.Rs) + ') ÷ (2 × ' + v(s.v) + '²) = <span class="res">' + u(fmt(one, 2), 'm') + '</span>');
      var t = r(s.R / s.v, 4), d = r(0.5 * 9.81 * t * t, 4), ts = r(s.Rs / s.v, 4), ds = r(0.5 * 9.81 * ts * ts, 4), lift = r(ds * s.R / s.Rs, 4);
      h += eq('Or in steps. Time to the target', 't = ' + v(s.R) + ' ÷ ' + v(s.v) + ' = <span class="res">' + u(fmt(t, 4), 's') + '</span>');
      h += eq('Drop at the target', '½ × 9.81 × ' + v(fmt(t, 4)) + '² = <span class="res">' + u(fmt(d, 4), 'm') + '</span>');
      h += eq('Drop at the ' + s.Rs + ' m mark', '½ × 9.81 × (' + v(s.Rs) + ' ÷ ' + v(s.v) + ')² = ½ × 9.81 × ' + v(fmt(ts, 4)) + '² = <span class="res">' + u(fmt(ds, 4), 'm') + '</span>');
      h += eq('What the sight lifts at ' + s.R + ' m', v(fmt(ds, 4)) + ' × ' + v(s.R) + ' ÷ ' + v(s.Rs) + ' = <span class="res">' + u(fmt(lift, 4), 'm') + '</span>');
      h += eq('Aim above the middle', fmt(d, 4) + ' − ' + fmt(lift, 4) + ' = <span class="res">' + u(fmt(d - lift, 2), 'm') + '</span>');
    }
    if (s.kmh > 0) {
      var R = s.level >= 4 ? Math.max(1, res.answers.range) : s.R, vt = r(s.kmh / 3.6, 4), tt = r(R / s.v, 4), sn = r(Math.sin(s.angle * Math.PI / 180), 4);
      var mine = s.level >= 4 && Math.round(R) !== s.R ? ' (with your range of ' + u(fmt(R, 0), 'm') + ')' : '';
      h += eq('Target speed', v(s.kmh) + ' ÷ 3.6 = <span class="res">' + u(fmt(vt, 4), 'm/s') + '</span>');
      h += eq('Time of flight' + mine, v(fmt(R, 0)) + ' ÷ ' + v(s.v) + ' = <span class="res">' + u(fmt(tt, 4), 's') + '</span>');
      h += eq('Lead', v(fmt(vt, 4)) + ' × ' + v(fmt(tt, 4)) + ' × ' + (s.angle === 90 ? v('1') + ' (sin 90°)' : v(fmt(sn, 4)) + ' (sin ' + s.angle + '°)') + ' = <span class="res">' + u(fmt(vt * tt * (s.angle === 90 ? 1 : sn), 2), 'm') + '</span>');
    }
    return h;
  }

  $('#next2').addEventListener('click', function () { $('#next').click(); });
  $('#next').addEventListener('click', function () {
    if (S.phase !== 'debrief') return;
    if (S.idx < 4) { S.idx++; loadLevel(); window.scrollTo(0, 0); }
    else results();
  });

  /* ---------- results ---------- */
  function results() {
    S.phase = 'results'; S.resultsAt = performance.now();
    var total = S.results.reduce(function (t, r) { return t + r.total; }, 0);
    var g = E.grade(total);
    $('#res-code').textContent = S.code;
    $('#res-total').setAttribute('data-count', total);
    $('#res-total').textContent = total;
    $('#res-grade').innerHTML = '<b>' + g.name + '</b><span>' + advice(total) + '</span>';
    var db = Store.read(), line;
    if (!db) line = 'Scores cannot be saved in this browser, so take a screenshot if you want to keep it.';
    else {
      var prev = db.codes[S.code], prevBest = prev && typeof prev.best === 'number' ? prev.best : null;
      db.codes[S.code] = { best: Math.max(total, prevBest == null ? -1 : prevBest), first: prev && typeof prev.first === 'number' ? prev.first : (S.repeat ? null : total), plays: ((prev && prev.plays) || 0) + 1, started: true };
      var saved = Store.write(db);
      if (!saved) line = 'Scores cannot be saved in this browser, so take a screenshot if you want to keep it.';
      else if (S.repeat) line = 'Another go at code ' + S.code + (db.codes[S.code].first != null ? '. Your first go scored ' + db.codes[S.code].first : '') + '. Your best is ' + db.codes[S.code].best + '.';
      else line = 'First go at code ' + S.code + '. Saved on this device.';
    }
    $('#res-best').textContent = line;
    $('#res-bars').innerHTML = S.results.map(function (r, i) {
      return '<li style="--i:' + i + '" class="' + (r.shot.hit && r.hitPts ? 'hit' : 'miss') + '"><span class="rb-name">' + r.level + '. ' + r.name + '</span><span class="rb-bar"><i style="width:' + (r.total / 10) + '%"></i></span><span class="rb-num">' + r.total + '</span></li>';
    }).join('');
    $('#res-table tbody').innerHTML = S.results.map(function (r) {
      return '<tr><th scope="row">' + r.level + '. ' + r.name + '</th><td>' + clock(r.seconds) + '</td><td>' + r.accuracy + '</td><td>' + r.speed + '</td><td>' + (r.shot.hit ? (r.hitPts ? 'Hit' : 'Lucky') : 'Miss') + '</td><td><b>' + r.total + '</b></td></tr>';
    }).join('') + '<tr class="sum"><th scope="row">Total</th><td>' + clock(S.results.reduce(function (t, r) { return t + r.seconds; }, 0)) + '</td><td>' +
      S.results.reduce(function (t, r) { return t + r.accuracy; }, 0) + '</td><td>' + S.results.reduce(function (t, r) { return t + r.speed; }, 0) + '</td><td>' +
      S.results.filter(function (r) { return r.shot.hit && r.hitPts; }).length + ' of 5</td><td><b>' + total + '</b></td></tr>';
    show('results');
    countUp($('#res-total'));
    $('#res-h').focus({ preventScroll: true });
    announce('Exam finished. ' + total + ' out of 5000. ' + g.name + '.');
  }
  /* Advice that follows the weakest part of the run. */
  /* Advice that follows the part of the run that lost most points. */
  function advice(total) {
    if (total >= 4900) return 'Fast, accurate and every round on target.';
    var acc = 0, spd = 0, hit = 0, misses = 0;
    S.results.forEach(function (r) { acc += 600 - r.accuracy; spd += 300 - r.speed; hit += 100 - r.hitPts; if (!(r.shot.hit && r.hitPts)) misses++; });
    // speed points are scaled by accuracy, so speed lost because of inaccuracy belongs to accuracy
    var slowOnly = 0;
    S.results.forEach(function (r) { slowOnly += 300 * (1 - r.speedFrac) * Math.pow(r.accuracy / 600, 2); });
    var accTotal = acc + (spd - slowOnly);
    if (accTotal >= slowOnly && accTotal >= hit) return 'You lost most marks on accuracy. Go back over the working in the debriefs, then try the same code again.';
    if (hit >= slowOnly) return 'The sums were mostly right, but ' + misses + ' round' + (misses === 1 ? '' : 's') + ' did not count as a hit. Check which ones in the table.';
    return 'Accurate. The marks you dropped were on speed, so practise the sums until they come quickly.';
  }
  function resultsSettled() { return performance.now() - S.resultsAt > 700; }
  $('#again').addEventListener('click', function () { if (S.phase !== 'results' || !resultsSettled()) return; begin(S.code); });
  $('#fresh').addEventListener('click', function () {
    if (S.phase !== 'results' || !resultsSettled()) return;
    var c = E.makeCode();
    $('#code').value = c; S.phase = 'intro';
    try { history.replaceState(null, '', '?code=' + c); } catch (e) { /* ignore */ }
    show('intro'); showBest(); $('#code').focus();
  });

  /* ---------- restart ---------- */
  $('#quit').addEventListener('click', function () { $('#quit-confirm').hidden = false; $('#quit').hidden = true; $('#quit-no').focus(); });
  $('#quit-no').addEventListener('click', function () { closeConfirm(); $('#quit').focus(); });
  $('#quit-yes').addEventListener('click', function () {
    stopAnim(); S.phase = 'intro'; closeConfirm();
    show('intro'); showBest(); $('#begin').focus();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('#quit-confirm').hidden) { closeConfirm(); $('#quit').focus(); } });
  $('.quit').addEventListener('focusout', function (e) { if (!$('#quit-confirm').hidden && e.relatedTarget && !e.relatedTarget.closest('.quit')) closeConfirm(); });
  document.addEventListener('pointerdown', function (e) { if (!$('#quit-confirm').hidden && !e.target.closest('.quit')) closeConfirm(); });

  /* Warn before leaving in the middle of an exam. */
  window.addEventListener('beforeunload', function (e) {
    if (S.phase === 'active' || S.phase === 'firing' || (S.phase !== 'intro' && S.phase !== 'results' && S.results.length)) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ---------- view ---------- */
  var view = U.canvas($('#view'), function (ctx, w, h) {
    var s = scen();
    if (!s) { ctx.fillStyle = '#0E100C'; ctx.fillRect(0, 0, w, h); return; }
    var travel = S.fx ? S.fx.travel : 0;
    Scope.draw(ctx, w, h, {
      field: S.field, panAz: S.panAz, panEl: S.panEl, target: targetNow(s, travel), clearAz: Math.abs(travel),
      info: S.phase === 'brief' ? null : ['Binocular, ' + S.field + ' mil field', 'Level ' + s.level + ' of 5'],
      after: drawFx
    });
  });
  Scope.attachPan($('#view'), function () { return { panAz: S.panAz, panEl: S.panEl, field: S.field }; }, function (az, el) {
    if (S.phase === 'firing' || S.phase === 'brief') return;
    var s = scen(); if (!s) return;
    var c = Scope.clampPan(az, el, targetNow(s), S.field); S.panAz = c.az; S.panEl = c.el;
  }, function () { view.redraw(); });
  function setZoom(f, temporary) {
    S.field = f;
    if (!temporary) S.userField = f;
    U.$$('.zoom-seg .chip').forEach(function (o) { o.setAttribute('aria-pressed', +o.getAttribute('data-zoom') === f ? 'true' : 'false'); });
    view.redraw();
  }
  U.$$('.zoom-seg .chip').forEach(function (b) { b.addEventListener('click', function () {
    var f = +b.getAttribute('data-zoom'), s = scen();
    setZoom(f);
    // after zooming in, make sure the vehicle is still in the lens
    if (s && S.phase !== 'firing') { var c = Scope.clampPan(S.panAz, S.panEl, targetNow(s, S.fx ? S.fx.travel : 0), f); S.panAz = c.az; S.panEl = c.el; view.redraw(); }
  }); });
  if (window.innerWidth < 600) setZoom(56);

  buildIntro();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { view.redraw(); });
  window.__exam = { S: S, E: E, begin: begin, startLevel: startLevel, fire: fire, clock: clock };
})();
