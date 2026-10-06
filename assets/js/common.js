/* Shared helpers: canvas sizing, controls, silhouettes, verdicts. */
(function () {
  'use strict';
  var U = {};
  U.reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    var upd = function () { U.reduced = mq.matches; };
    if (mq.addEventListener) mq.addEventListener('change', upd); else if (mq.addListener) mq.addListener(upd);
  }

  U.css = function (name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); };
  U.C = {
    ground: '#1A1C17', panel: '#23261F', line: '#3A3F31', paper: '#E8E4D8', sage: '#B4B98A',
    muted: '#8E9277', olive: '#4B5320', olive2: '#626B2C', signal: '#E0473E', tracer: '#F0A830', friend: '#4FA3E0'
  };

  U.fmt = function (n, d) {
    if (!isFinite(n)) return '∞';
    d = d == null ? 1 : d;
    var s = Number(n).toFixed(d);
    if (s === '-0' || /^-0\.0*$/.test(s)) s = s.slice(1);
    return s.replace('-', '−');
  };
  U.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.$ = function (s, r) { return (r || document).querySelector(s); };
  U.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* Seeded random so scenery is stable between redraws. */
  U.rng = function (seed) {
    var s = seed >>> 0 || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s % 100000) / 100000; };
  };

  /* Canvas that tracks its CSS size and device pixel ratio. */
  U.canvas = function (el, draw) {
    var ctx = el.getContext('2d');
    var state = { el: el, ctx: ctx, w: 0, h: 0, dpr: 1 };
    function fit() {
      var r = el.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      var w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
      if (w !== state.w || h !== state.h || dpr !== state.dpr) {
        state.w = w; state.h = h; state.dpr = dpr;
        el.width = Math.round(w * dpr); el.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    state.redraw = function () { fit(); draw(ctx, state.w, state.h); };
    if ('ResizeObserver' in window) new ResizeObserver(function () { state.redraw(); }).observe(el);
    else window.addEventListener('resize', state.redraw);
    return state;
  };

  /* Slider + editable number pair. Returns getter/setter. */
  /* Number typed in a box: accepts a comma as the decimal mark and a Unicode minus. */
  U.num = function (str) {
    var t = String(str == null ? '' : str).trim().replace(/[\u2212\u2013]/g, '-').replace(/\s+/g, '');
    t = /^[+-]?\d{1,3}(,\d{3})+$/.test(t) ? t.replace(/,/g, '') : t.replace(',', '.');   // 1,200 is twelve hundred; 2,5 is two and a half
    if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) return NaN;
    return parseFloat(t);
  };
  U.control = function (id, onChange) {
    var range = document.getElementById(id);
    var num = document.getElementById(id + '-n');
    var step = +range.step || 1;
    function paint() {
      var min = +range.min, max = +range.max;
      range.style.setProperty('--fill', ((+range.value - min) / (max - min) * 100) + '%');
    }
    var unitEl = num && num.parentNode.querySelector('.u'), unit = unitEl ? unitEl.textContent.trim() : '';
    function show() {
      if (num) { num.value = String(+(+range.value).toFixed(2)); num.setAttribute('aria-valuenow', +range.value); }
      if (unit) range.setAttribute('aria-valuetext', (+range.value) + ' ' + unit);
    }
    if (num) {
      num.setAttribute('role', 'spinbutton'); num.setAttribute('aria-valuemin', range.min); num.setAttribute('aria-valuemax', range.max);
      num.setAttribute('enterkeyhint', 'done');
    }
    function set(v, silent) {
      v = U.clamp(+v, +range.min, +range.max);
      if (!isFinite(v)) return;
      range.value = v; paint();
      if (num && document.activeElement !== num) show();
      if (!silent && onChange) onChange(+range.value);
    }
    range.addEventListener('input', function () { show(); paint(); onChange && onChange(+range.value); });
    if (num) {
      num.addEventListener('input', function () {
        // only act on a value that is already in range: "2" on the way to "250" must not be applied
        var v = U.num(num.value);
        if (!isFinite(v) || v < +range.min || v > +range.max) return;
        range.value = v; paint(); num.setAttribute('aria-valuenow', v); onChange && onChange(+range.value);
      });
      num.addEventListener('change', function () { var v = U.num(num.value); set(isFinite(v) ? v : range.value); show(); });
      num.addEventListener('blur', show);
      num.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        var v = U.num(num.value); if (!isFinite(v)) v = +range.value;
        set(v + (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1)); show();
      });
      show();
    }
    paint();
    return { get: function () { return +range.value; }, set: set, el: range,
      setMax: function (mx) {
        var old = U.num(num ? num.value : range.value); if (!isFinite(old)) old = +range.value;
        range.max = mx; if (num) { num.max = mx; num.setAttribute('aria-valuemax', mx); }
        if (old > mx) set(mx); else { range.value = old; paint(); }
      } };
  };

  /* Radio group value. */
  U.radio = function (name, onChange) {
    var inputs = U.$$('input[name="' + name + '"]');
    inputs.forEach(function (i) { i.addEventListener('change', function () { if (i.checked) onChange && onChange(i.value); }); });
    return {
      get: function () { var c = inputs.filter(function (i) { return i.checked; })[0]; return c ? c.value : null; },
      set: function (v, silent) { inputs.forEach(function (i) { i.checked = i.value === v; }); if (!silent && onChange) onChange(v); }
    };
  };

  /* Verdict stamp over the view. */
  /* Verdict stamp. After a moment it settles into a small corner badge so the picture is visible again. */
  U.stamp = function (el, ok, text, sub, opt) {
    clearTimeout(el._settle);
    el.className = 'stamp';
    el.innerHTML = text + (sub ? '<small>' + sub + '</small>' : '');
    void el.offsetWidth;
    el.className = 'stamp show ' + (opt && opt.variant ? opt.variant : ok ? 'hit' : 'miss');
    var delay = opt && opt.settle != null ? opt.settle : 2400;
    if (delay !== false) el._settle = setTimeout(function () { if (/\bshow\b/.test(el.className)) el.classList.add('settle'); }, U.reduced ? 1200 : delay);
  };
  U.clearStamp = function (el) { clearTimeout(el._settle); el.className = 'stamp'; el.innerHTML = ''; };

  /* Sticky bits: publish their heights so focused fields and scroll targets are never hidden under them. */
  U.sticky = function () {
    var root = document.documentElement, bar = document.querySelector('.bar');
    var hdr = bar && getComputedStyle(bar).position === 'sticky' ? bar.offsetHeight : 0;
    var exam = document.querySelector('.exam-bar');
    var examH = exam && exam.offsetParent !== null && getComputedStyle(exam).position === 'sticky' ? exam.offsetHeight : 0;
    var vw = document.querySelector('.sim:not(.exam-grid) .view-wrap');
    var viewH = vw && getComputedStyle(vw).position === 'sticky' ? vw.offsetHeight : 0;
    root.style.setProperty('--hdr', hdr + 'px');
    root.style.setProperty('--stick-top', (hdr + examH) + 'px');
    root.style.setProperty('--scroll-pad', (hdr + examH + viewH + 12) + 'px');
  };
  (function () {
    var go = function () { U.sticky(); };
    window.addEventListener('resize', go);
    window.addEventListener('load', go);
    document.addEventListener('DOMContentLoaded', go);
    if ('ResizeObserver' in window) document.addEventListener('DOMContentLoaded', function () {
      var ro = new ResizeObserver(go);
      ['.bar', '.exam-bar', '.view-wrap'].forEach(function (q) { var el = document.querySelector(q); if (el) ro.observe(el); });
    });
  })();

  /* A short message for screen readers (results, not every slider step). */
  U.say = function (msg) {
    var el = document.getElementById('sr-status');
    if (!el) { el = document.createElement('div'); el.id = 'sr-status'; el.className = 'sr-only'; el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); }
    el.textContent = ''; setTimeout(function () { el.textContent = msg; }, 40);
  };

  /* Shot log */
  U.log = function (listEl, scoreEl) {
    var n = 0, hits = 0;
    return {
      add: function (ok, label, detail) {
        n++; if (ok) hits++;
        var empty = listEl.querySelector('.empty'); if (empty) empty.remove();
        var li = document.createElement('li');
        li.className = ok ? 'hit' : 'miss';
        li.innerHTML = '<span class="i">' + n + '</span><span>' + detail + '</span><span class="r">' + label + '</span>';
        listEl.insertBefore(li, listEl.firstChild);
        if (scoreEl) scoreEl.innerHTML = '<span><b>' + hits + '</b>' + (hits === 1 ? 'hit' : 'hits') + '</span><span><b>' + (n - hits) + '</b>' + (n - hits === 1 ? 'miss' : 'misses') + '</span><span><b>' + Math.round(hits / n * 100) + '%</b> on target</span>';
      },
      clear: function () {
        n = 0; hits = 0;
        listEl.innerHTML = '<li class="empty">No shots yet.</li>';
        if (scoreEl) scoreEl.innerHTML = '<span><b>0</b>hits</span><span><b>0</b>misses</span>';
      }
    };
  };

  /* ---------- Silhouettes (metres, facing right, origin at rear bottom) ---------- */
  var SIDE = Phys.PROFILES;

  function poly(ctx, pts, ox, oy, s, flip, L) {
    ctx.beginPath();
    pts.forEach(function (p, i) {
      var x = flip ? (L - p[0]) : p[0];
      var X = ox + x * s, Y = oy - p[1] * s;
      if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
    });
    ctx.closePath();
  }

  /* Side view: x = left edge of hull in px, y = ground line px, s = px per metre. */
  U.drawSide = function (ctx, key, x, y, s, opt) {
    opt = opt || {};
    var fill = opt.fill || '#2A2D24', detail = opt.detail || 'rgba(0,0,0,0.35)';
    var flip = !!opt.flip;
    if (key === 'soldier') { U.drawSoldier(ctx, x, y, s, fill); return; }
    var d = SIDE[key], L = Phys.TARGETS[key].length;
    ctx.save();
    ctx.fillStyle = fill;
    if (d.gun) {
      var g = d.gun, gx0 = flip ? L - g[2] : g[0], gx1 = flip ? L - g[0] : g[2];
      ctx.fillRect(x + gx0 * s, y - g[3] * s, (gx1 - gx0) * s, Math.max(1, (g[3] - g[1]) * s));
    }
    if (d.track) { poly(ctx, d.track, x, y, s, flip, L); ctx.fill(); }
    poly(ctx, d.hull, x, y, s, flip, L); ctx.fill();
    poly(ctx, d.turret, x, y, s, flip, L); ctx.fill();
    if (d.extra) { poly(ctx, d.extra, x, y, s, flip, L); ctx.fill(); }
    if (s > 3) {
      ctx.fillStyle = detail;
      d.wheels.xs.forEach(function (wx) {
        var X = x + (flip ? L - wx : wx) * s;
        ctx.beginPath(); ctx.arc(X, y - d.wheels.y * s, d.wheels.r * s * (d.track ? 0.85 : 1), 0, Math.PI * 2); ctx.fill();
      });
      if (!d.track) {
        ctx.fillStyle = fill;
        d.wheels.xs.forEach(function (wx) {
          var X = x + (flip ? L - wx : wx) * s;
          ctx.beginPath(); ctx.arc(X, y - d.wheels.y * s, d.wheels.r * s * 0.45, 0, Math.PI * 2); ctx.fill();
        });
      }
    } else {
      d.wheels.xs.forEach(function (wx) {
        var X = x + (flip ? L - wx : wx) * s;
        ctx.beginPath(); ctx.arc(X, y - d.wheels.y * s, d.wheels.r * s, 0, Math.PI * 2); ctx.fill();
      });
    }
    ctx.restore();
  };

  /* A vehicle at a crossing angle: the side squeezed by sin(angle) plus the nose plate you can see.
     x = left edge, y = ground line, s = px per metre. Total width = L sin(a) + W |cos(a)|. */
  U.drawOblique = function (ctx, key, x, y, s, angleDeg, opt) {
    opt = opt || {};
    var sh = Phys.obliqueShape(key, angleDeg), W = sh.width, flip = !!opt.flip;
    var X = function (u) { return flip ? x + (W - u) * s : x + u * s; };
    ctx.save();
    ctx.fillStyle = opt.fill || '#2A2D24';
    sh.polys.forEach(function (p) {
      ctx.beginPath();
      p.forEach(function (q, i) { if (i) ctx.lineTo(X(q[0]), y - q[1] * s); else ctx.moveTo(X(q[0]), y - q[1] * s); });
      ctx.closePath(); ctx.fill();
    });
    // road wheels and hubs, purely visual
    if (opt.detail && s > 3) {
      ctx.fillStyle = opt.detail;
      sh.wheels.forEach(function (w) {
        if (w.rx * s < 0.8) return;
        var k = sh.tracked ? 0.85 : 0.45;
        ctx.beginPath(); ctx.ellipse(X(w.x), y - w.y * s, w.rx * s * k, w.ry * s * k, 0, 0, Math.PI * 2); ctx.fill();
      });
    }
    ctx.restore();
  };

  /* Front view, centred on x. */
  U.drawFront = function (ctx, key, cx, y, s, opt) {
    opt = opt || {};
    var fill = opt.fill || '#2A2D24';
    if (key === 'soldier') { U.drawSoldier(ctx, cx - 0.25 * s, y, s, fill); return; }
    var W = Phys.TARGETS[key].front, x = cx - W / 2 * s;
    ctx.save(); ctx.fillStyle = fill;
    Phys.frontPolys(key, true).forEach(function (p) {
      ctx.beginPath();
      p.forEach(function (q, i) { if (i) ctx.lineTo(x + q[0] * s, y - q[1] * s); else ctx.moveTo(x + q[0] * s, y - q[1] * s); });
      ctx.closePath(); ctx.fill();
    });
    ctx.restore();
  };

  U.drawSoldier = function (ctx, x, y, s, fill) {
    ctx.save(); ctx.fillStyle = fill;
    ctx.beginPath(); ctx.arc(x + 0.25 * s, y - 1.66 * s, 0.13 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 0.08 * s, y - 1.5 * s); ctx.lineTo(x + 0.42 * s, y - 1.5 * s); ctx.lineTo(x + 0.4 * s, y - 0.9 * s);
    ctx.lineTo(x + 0.45 * s, y); ctx.lineTo(x + 0.3 * s, y); ctx.lineTo(x + 0.25 * s, y - 0.75 * s);
    ctx.lineTo(x + 0.2 * s, y); ctx.lineTo(x + 0.05 * s, y); ctx.lineTo(x + 0.1 * s, y - 0.9 * s); ctx.closePath(); ctx.fill();
    ctx.restore();
  };

  /* Top-down: centre (cx, cy), heading angle a (radians, 0 = +x), s px per metre. */
  U.drawTop = function (ctx, key, cx, cy, a, s, opt) {
    opt = opt || {};
    var T = Phys.TARGETS[key], L = T.length, W = T.width;
    var hull = opt.fill || '#4A4D3A', tracks = opt.tracks || '#24261F', top = opt.turret || '#66694F';
    var line = opt.stroke || 'rgba(12,13,9,0.75)', accent = opt.accent || null;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1, s * 0.06);
    function rr(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
    var x0 = -L / 2 * s, y0 = -W / 2 * s;
    if (key === 'ural') {
      // wheels, cargo body, cab
      ctx.fillStyle = tracks;
      [1.0, 2.45, 6.2].forEach(function (wx) { rr(x0 + (wx - 0.55) * s, y0 - 0.05 * s, 1.1 * s, 0.45 * s, 0.15 * s); ctx.fill(); rr(x0 + (wx - 0.55) * s, -y0 - 0.4 * s, 1.1 * s, 0.45 * s, 0.15 * s); ctx.fill(); });
      ctx.fillStyle = hull; ctx.strokeStyle = accent || line; ctx.lineWidth = Math.max(1, s * (accent ? 0.09 : 0.06));
      rr(x0, y0, 4.6 * s, W * s, 0.12 * s); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      for (var bx = 0.9; bx < 4.6; bx += 0.9) { ctx.beginPath(); ctx.moveTo(x0 + bx * s, y0 + 0.15 * s); ctx.lineTo(x0 + bx * s, -y0 - 0.15 * s); ctx.stroke(); }
      ctx.fillStyle = top; ctx.strokeStyle = accent || line;
      rr(x0 + 4.85 * s, y0 + W * 0.06 * s, 2.5 * s, W * 0.88 * s, 0.35 * s); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(160,190,200,0.35)'; rr(x0 + 6.1 * s, y0 + W * 0.15 * s, 0.5 * s, W * 0.7 * s, 0.1 * s); ctx.fill();
    } else {
      var tracked = key !== 'btr82', tw = tracked ? 0.6 : 0.45;
      // running gear
      ctx.fillStyle = tracks;
      if (tracked) {
        rr(x0, y0, L * s, tw * s, 0.2 * s); ctx.fill(); rr(x0, -y0 - tw * s, L * s, tw * s, 0.2 * s); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = Math.max(0.6, s * 0.03);
        for (var tx2 = 0.3; tx2 < L; tx2 += 0.35) { ctx.beginPath(); ctx.moveTo(x0 + tx2 * s, y0); ctx.lineTo(x0 + tx2 * s, y0 + tw * s); ctx.moveTo(x0 + tx2 * s, -y0 - tw * s); ctx.lineTo(x0 + tx2 * s, -y0); ctx.stroke(); }
      } else {
        [1.25, 2.75, 4.75, 6.25].forEach(function (wx) { rr(x0 + (wx - 0.5) * s, y0 - 0.05 * s, 1.0 * s, tw * s, 0.18 * s); ctx.fill(); rr(x0 + (wx - 0.5) * s, -y0 - tw * s + 0.05 * s, 1.0 * s, tw * s, 0.18 * s); ctx.fill(); });
      }
      // hull with a chamfered nose
      var inset = tracked ? tw * 0.85 : 0.1, hx0 = x0 + 0.1 * s, hx1 = -x0 - 0.05 * s, hy0 = y0 + inset * s, hy1 = -y0 - inset * s, ch = (key === 'btr82' ? 1.0 : 0.5) * s;
      ctx.fillStyle = hull; ctx.strokeStyle = accent || line; ctx.lineWidth = Math.max(1, s * (accent ? 0.09 : 0.06));
      ctx.beginPath(); ctx.moveTo(hx0, hy0); ctx.lineTo(hx1 - ch, hy0); ctx.lineTo(hx1, hy0 + ch * 0.6); ctx.lineTo(hx1, hy1 - ch * 0.6); ctx.lineTo(hx1 - ch, hy1); ctx.lineTo(hx0, hy1); ctx.closePath();
      ctx.fill(); ctx.stroke();
      // engine deck: at the rear on the tank and BTR, front right on the BMP-2 (troop doors at the back)
      ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = Math.max(0.6, s * 0.04);
      if (key === 'bmp2') {
        for (var gb = 0.6; gb < 1.8; gb += 0.3) { ctx.beginPath(); ctx.moveTo(hx1 - (gb + 0.6) * s, 0.15 * s); ctx.lineTo(hx1 - (gb + 0.6) * s, hy1 - 0.25 * s); ctx.stroke(); }
        ctx.strokeRect(hx0 + 0.05 * s, hy0 + 0.35 * s, 0.25 * s, 0.9 * s); ctx.strokeRect(hx0 + 0.05 * s, hy1 - 1.25 * s, 0.25 * s, 0.9 * s);
      } else {
        for (var gx = 0.35; gx < 1.6; gx += 0.3) { ctx.beginPath(); ctx.moveTo(hx0 + gx * s, hy0 + 0.35 * s); ctx.lineTo(hx0 + gx * s, hy1 - 0.35 * s); ctx.stroke(); }
      }
      // turret and gun
      var tx = key === 't72' ? 0.25 : key === 'bmp2' ? -0.1 : 1.0, tr = key === 't72' ? 1.15 : key === 'bmp2' ? 0.8 : 0.6;
      var gun = key === 't72' ? 5.2 : key === 'bmp2' ? 3.1 : 1.7, gw = key === 't72' ? 0.2 : 0.12;
      ctx.fillStyle = top; ctx.strokeStyle = line; ctx.lineWidth = Math.max(1, s * 0.06);
      rr(tx * s, -gw / 2 * s, gun * s, gw * s, gw / 2 * s); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(tx * s, 0, tr * 1.1 * s, tr * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc((tx - tr * 0.35) * s, -tr * 0.35 * s, tr * 0.28 * s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };

  /* Animation helper honouring reduced motion. */
  U.animate = function (duration, step, done) {
    if (U.reduced || duration <= 0) { step(1); done && done(); return function () {}; }
    var start = null, id, stopped = false;
    function f(ts) {
      if (stopped) return;
      if (start == null) start = ts;
      var t = Math.min(1, (ts - start) / duration);
      step(t);
      if (t < 1) id = requestAnimationFrame(f); else done && done();
    }
    id = requestAnimationFrame(f);
    return function () { stopped = true; cancelAnimationFrame(id); };
  };

  window.U = U;
})();
