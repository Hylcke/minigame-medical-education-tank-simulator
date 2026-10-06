/* Binocular / sight picture shared by the range trainer and the exam.
   Angles are in mils. az grows to the right, el grows upwards, 0 el is the horizon. */
(function () {
  'use strict';
  var T = Phys.TARGETS;
  var OBS_H = 3; // eye height above the target's ground, metres

  // Scenery, seeded once so it never jumps between redraws.
  var rnd = U.rng(7331), props = [];
  for (var i = 0; i < 70; i++) {
    var d = 330 + Math.pow(rnd(), 1.4) * 2400;
    props.push({ d: d, az: (rnd() * 2 - 1) * 1000 * 60 / d * (d < 400 ? 1 : 2) + (rnd() * 2 - 1) * 60, kind: rnd() < 0.45 ? 'tree' : 'bush', size: rnd() < 0.5 ? 2 + rnd() * 3 : 6 + rnd() * 8 });
  }
  props.sort(function (a, b) { return b.d - a.d; });
  function ridge(az) {
    return 3.2 + 1.6 * Math.sin(az * 0.09) + 1.1 * Math.sin(az * 0.23 + 1) + 0.7 * Math.sin(az * 0.61 + 2) + 0.45 * Math.sin(az * 1.7);
  }
  function mix(a, b, t) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = Math.round(U.lerp(pa >> 16, pb >> 16, t)), g = Math.round(U.lerp((pa >> 8) & 255, (pb >> 8) & 255, t)), bl = Math.round(U.lerp(pa & 255, pb & 255, t));
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  /* Visible width of a target in metres. aspect: 'side', 'front' or 'oblique' (with squeeze 0..1 of length). */
  function widthM(t) {
    var v = T[t.key];
    if (t.aspect === 'front') return v.front;
    if (t.aspect === 'oblique') { var th = t.angle * Math.PI / 180; return v.length * Math.sin(th) + v.width * Math.abs(Math.cos(th)); }
    return v.length;
  }
  function baseEl(range) { return -OBS_H * 1000 / range; }
  /* Centre of the target in scope angles (az, el). */
  function centre(t) {
    var wm = widthM(t) * 1000 / t.range;
    return { az: t.az + wm / 2, el: baseEl(t.range) + T[t.key].height / 2 * 1000 / t.range };
  }

  /* o: { field, panAz, panEl, target, info: [lines], after: fn(ctx, api) } */
  function draw(ctx, w, h, o) {
    if (w < 40 || h < 40) return null; // hidden or not laid out yet
    var field = o.field || 112;
    var cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.47, k = 2 * R / field;
    var X = function (az) { return cx + (az - o.panAz) * k; };
    var Y = function (el) { return cy - (el - o.panEl) * k; };
    var api = { X: X, Y: Y, k: k, cx: cx, cy: cy, R: R };

    if (o.bg === false) ctx.clearRect(0, 0, w, h); else { ctx.fillStyle = '#0E100C'; ctx.fillRect(0, 0, w, h); }
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();

    var hy = Y(0);
    var sky = ctx.createLinearGradient(0, hy - 60 * k, 0, hy);
    sky.addColorStop(0, '#8E9A93'); sky.addColorStop(1, '#C9C8B2');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, Math.max(0, hy));
    var gr = ctx.createLinearGradient(0, hy, 0, hy + 70 * k);
    gr.addColorStop(0, '#8A8B6A'); gr.addColorStop(0.25, '#6E7150'); gr.addColorStop(1, '#4C5236');
    ctx.fillStyle = gr; ctx.fillRect(0, hy, w, Math.max(0, h - hy + 2));

    [450, 800, 1300, 2000].forEach(function (d, i) {
      var y = Y(baseEl(d));
      ctx.fillStyle = i % 2 ? 'rgba(90,96,58,0.25)' : 'rgba(150,140,95,0.18)';
      ctx.fillRect(0, y, w, Math.max(1, (OBS_H * 1000 / (d * 0.82) - OBS_H * 1000 / d) * k));
    });

    ctx.fillStyle = '#6F7660';
    ctx.beginPath(); ctx.moveTo(0, hy);
    for (var a = o.panAz - field; a <= o.panAz + field; a += 0.5) ctx.lineTo(X(a), Y(ridge(a)));
    ctx.lineTo(w, hy); ctx.closePath(); ctx.fill();

    var t = o.target, drawn = !t;
    function drawTarget() {
      drawn = true;
      var s = k * 1000 / t.range, base = Y(baseEl(t.range));
      var haze = Math.min(0.55, t.range / 2800);
      var fill = mix('#23261C', '#B8B9A2', haze), detail = mix('#15170F', '#A9AA92', haze);
      if (t.aspect === 'front') U.drawFront(ctx, t.key, X(t.az) + widthM(t) / 2 * s, base, s, { fill: fill });
      else if (t.aspect === 'oblique') {
        U.drawOblique(ctx, t.key, X(t.az), base, s, t.angle, { fill: fill, detail: detail, nose: mix('#191B13', '#AEB09A', haze), flip: !!t.flip });
      } else U.drawSide(ctx, t.key, X(t.az), base, s, { fill: fill, detail: detail, flip: !!t.flip });
    }
    props.forEach(function (p) {
      if (!drawn && p.d < t.range) drawTarget();
      var s = k * 1000 / p.d, x = X(p.az), y = Y(baseEl(p.d));
      if (x < -200 || x > w + 200) return;
      if (t && p.d < t.range) { // never hide the target behind nearer scenery
        var tw = widthM(t) * 1000 / t.range, tc = t.az + tw / 2, pw = p.size * 1000 / p.d * 0.5;
        var sweep = o.clearAz || 0;
        if (Math.abs(p.az - tc) < tw / 2 + pw + 2 + sweep) return;
      }
      var haze = Math.min(0.6, p.d / 2600);
      ctx.fillStyle = mix(p.kind === 'tree' ? '#2F3A25' : '#454C2E', '#B5B7A0', haze);
      if (p.kind === 'tree') {
        ctx.fillRect(x - 0.15 * s, y - p.size * 0.45 * s, 0.3 * s, p.size * 0.45 * s);
        ctx.beginPath(); ctx.ellipse(x, y - p.size * 0.62 * s, p.size * 0.28 * s, p.size * 0.38 * s, 0, 0, Math.PI * 2); ctx.fill();
      } else {
        var bs = Math.min(p.size, 3.2);
        ctx.beginPath(); ctx.ellipse(x, y - bs * 0.3 * s, bs * 0.7 * s, bs * 0.32 * s, 0, 0, Math.PI * 2); ctx.fill();
      }
    });
    if (!drawn) drawTarget();

    if (o.under) o.under(ctx, api);

    // reticle; labels get a pale halo so they stay readable over a dark hull
    var ink = 'rgba(16,18,12,0.92)';
    var label = function (txt, x, y) {
      ctx.save(); ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(205,204,184,0.85)';
      ctx.strokeText(txt, x, y); ctx.restore(); ctx.fillText(txt, x, y);
    };
    ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = Math.max(1, k * 0.12);
    ctx.font = '600 ' + U.clamp(Math.round(k * 2.4), 10, 18) + 'px Barlow Condensed, Arial Narrow, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.beginPath(); ctx.moveTo(cx - 50 * k, cy); ctx.lineTo(cx + 50 * k, cy); ctx.stroke();
    for (var m = -50; m <= 50; m++) {
      var L = m % 10 === 0 ? 4 : m % 5 === 0 ? 2.5 : 1.2;
      ctx.beginPath(); ctx.moveTo(cx + m * k, cy - L * k); ctx.lineTo(cx + m * k, cy + (m % 10 === 0 ? 0 : L * 0.4) * k); ctx.stroke();
      if (m % 10 === 0 && Math.abs(m * k) < R - 16) label(String(Math.abs(m)), cx + m * k, cy + 1.2 * k);
    }
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - 30 * k); ctx.stroke();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (var v = 1; v <= 30; v++) {
      var lv = v % 10 === 0 ? 3 : v % 5 === 0 ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(cx - lv * k * 0.5, cy - v * k); ctx.lineTo(cx + lv * k * 0.5, cy - v * k); ctx.stroke();
      if (v % 10 === 0) label(String(v), cx + 2.2 * k, cy - v * k);
    }

    if (o.after) o.after(ctx, api);
    ctx.restore();

    // lens rim
    ctx.save();
    var vg = ctx.createRadialGradient(cx, cy, R * 0.78, cx, cy, R);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#3A3F31'; ctx.beginPath(); ctx.arc(cx, cy, R + 1.5, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(180,185,138,0.35)'; ctx.beginPath(); ctx.arc(cx, cy, Math.max(1, Math.min(R + 6, Math.min(w, h) / 2 - 1)), 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    if (o.info && w - 2 * R > 220) {
      ctx.fillStyle = 'rgba(180,185,138,0.85)';
      ctx.font = '500 13px Barlow, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      o.info.forEach(function (line, i) { ctx.fillText(line, 14, 14 + i * 18); });
    }
    return api;
  }

  /* Drag and arrow-key panning. get() returns {panAz, panEl, field}; set(az, el) stores them. */
  function attachPan(cv, get, set, redraw) {
    var drag = null;
    function kNow() { var r = cv.getBoundingClientRect(); return 2 * Math.min(r.width, r.height) * 0.47 / get().field; }
    cv.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      var s = get(); drag = { x: e.clientX, y: e.clientY, az: s.panAz, el: s.panEl, id: e.pointerId };
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      cv.style.cursor = 'grabbing';
    });
    cv.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var k = kNow();
      set(drag.az - (e.clientX - drag.x) / k, drag.el + (e.clientY - drag.y) / k);
      redraw();
    });
    function end() { drag = null; cv.style.cursor = 'grab'; }
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end); cv.addEventListener('lostpointercapture', end);
    if (!window.PointerEvent) { // old iPads: touch and mouse instead
      var start = function (x, y) { var s = get(); drag = { x: x, y: y, az: s.panAz, el: s.panEl, id: 'legacy' }; };
      var move = function (x, y) { if (!drag) return; var k = kNow(); set(drag.az - (x - drag.x) / k, drag.el + (y - drag.y) / k); redraw(); };
      cv.addEventListener('touchstart', function (e) { var t = e.touches[0]; start(t.clientX, t.clientY); }, { passive: true });
      cv.addEventListener('touchmove', function (e) { var t = e.touches[0]; if (drag) e.preventDefault(); move(t.clientX, t.clientY); }, { passive: false });
      cv.addEventListener('touchend', end);
      cv.addEventListener('mousedown', function (e) { start(e.clientX, e.clientY); });
      window.addEventListener('mousemove', function (e) { move(e.clientX, e.clientY); });
      window.addEventListener('mouseup', end);
    }
    cv.style.cursor = 'grab';
    cv.addEventListener('keydown', function (e) {
      var st = e.shiftKey ? 5 : 0.5, s = get(), az = s.panAz, el = s.panEl, used = true;
      if (e.key === 'ArrowLeft') az += st;
      else if (e.key === 'ArrowRight') az -= st;
      else if (e.key === 'ArrowUp') el -= st;
      else if (e.key === 'ArrowDown') el += st;
      else used = false;
      if (used) { e.preventDefault(); set(az, el); redraw(); }
    });
  }

  /* Keep the pan inside sensible limits so the scale can never be lost. */
  function clampPan(az, el, t, field) {
    var c = t ? centre(t) : { az: 0, el: 0 }, f = field || 112;
    var w = t ? widthM(t) * 1000 / t.range : 0, hgt = t ? T[t.key].height * 1000 / t.range : 0;
    // keep the vehicle's middle within a circle, so part of it is always inside the round lens
    var lim = Math.max(4, f / 2 + Math.min(w, hgt) / 2 - 4);
    var dx = az - c.az, dy = el - c.el, d = Math.hypot(dx, dy);
    if (d > lim) { dx *= lim / d; dy *= lim / d; }
    return { az: c.az + dx, el: c.el + dy };
  }

  window.Scope = { OBS_H: OBS_H, draw: draw, attachPan: attachPan, widthM: widthM, baseEl: baseEl, centre: centre, clampPan: clampPan };
})();
