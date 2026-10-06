(function () {
  'use strict';
  var $ = U.$, fmt = U.fmt, C = U.C, T = Phys.TARGETS;
  var S = { key: 't72', kmh: 30, ang: 70, dir: 1, R: 200, wpn: 'm72', vp: 200, lead: 0, answer: false, shot: null, anim: null };
  var stampEl = $('#stamp');
  var shotLog = U.log($('#log'), $('#score')); shotLog.clear();

  /* ---------- model ---------- */
  function model() {
    var th = S.ang * Math.PI / 180, vt = S.kmh / 3.6;
    var hx = S.dir * Math.sin(th), hy = -Math.cos(th);     // heading unit (approaching for angles under 90)
    var P0 = { x: 0, y: S.R }, V = { x: vt * hx, y: vt * hy };
    var A = { x: S.dir * S.lead, y: S.R };
    var aLen = Math.hypot(A.x, A.y), u = { x: A.x / aLen, y: A.y / aLen };
    var tI = Phys.interceptTime(P0.x, P0.y, V.x, V.y, S.vp);
    var I = tI != null ? { x: P0.x + V.x * tI, y: P0.y + V.y * tI } : null;
    var exact = I ? S.dir * I.x * S.R / I.y : NaN;
    var formula = Phys.leadMetres(S.kmh, S.ang, S.R, S.vp);
    var L = T[S.key].length, W = T[S.key].width;
    return { th: th, vt: vt, h: { x: hx, y: hy }, P0: P0, V: V, A: A, u: u, tI: tI, I: I, exact: exact, formula: formula, L: L, W: W, tof: S.R / S.vp };
  }
  function simulate(M) {
    var tEnd = (S.R + 60) / S.vp, n = 3000, best = { d: Infinity };
    for (var i = 0; i <= n; i++) {
      var t = tEnd * i / n;
      var px = M.u.x * S.vp * t, py = M.u.y * S.vp * t;
      var cx = M.P0.x + M.V.x * t, cy = M.P0.y + M.V.y * t;
      var rx = px - cx, ry = py - cy;
      var along = rx * M.h.x + ry * M.h.y, across = -rx * M.h.y + ry * M.h.x;
      if (Math.abs(along) <= M.L / 2 && Math.abs(across) <= M.W / 2) {
        return { hit: true, t: t, p: { x: px, y: py }, along: along, across: across };
      }
      var d = Math.hypot(rx, ry);
      if (d < best.d) best = { d: d, t: t, p: { x: px, y: py }, along: along, across: across };
    }
    best.hit = false;
    return best;
  }
  function apparentLength(M) { return M.L * Math.sin(M.th) + M.W * Math.abs(Math.cos(M.th)); }

  /* ---------- drawing ---------- */
  var view = U.canvas($('#view'), draw);

  function draw(ctx, w, h) {
    if (w < 120 || h < 90) return; // not laid out yet
    var M = model(), sh = S.shot, t = sh ? sh.tNow : 0;
    ctx.fillStyle = '#0E100C'; ctx.fillRect(0, 0, w, h);
    var gap = 6, mapW = Math.round(w * 0.38);
    var rx0 = mapW + gap, rW = w - rx0, cH = Math.round(h * 0.6), sH = h - cH - gap;
    drawMap(ctx, M, t, 0, 0, mapW, h);
    drawClose(ctx, M, t, rx0, 0, rW, cH);
    drawSight(ctx, M, rx0, cH + gap, rW, sH);
  }

  function label(ctx, txt, x, y) {
    ctx.save(); ctx.font = '500 12px Barlow, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    var tw = ctx.measureText(txt).width;
    ctx.fillStyle = 'rgba(14,16,12,0.75)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, tw + 12, 20, 6); else ctx.rect(x, y, tw + 12, 20); ctx.fill();
    ctx.fillStyle = C.sage; ctx.fillText(txt, x + 6, y + 3); ctx.restore();
  }

  function targetAt(M, t) { return { x: M.P0.x + M.V.x * t, y: M.P0.y + M.V.y * t }; }
  function headingAngle(M) { return Math.atan2(-M.h.y, M.h.x); } // screen angle (y down)

  function drawMap(ctx, M, t, x0, y0, W, H) {
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, W, H); ctx.clip();
    ctx.fillStyle = '#20241A'; ctx.fillRect(x0, y0, W, H);
    var pad = 18, ySpan = S.R + 40, xHalf = Math.max(S.R * 0.32, 25);
    var s = Math.min((H - 2 * pad) / ySpan, (W - 2 * pad) / (2 * xHalf));
    var ox = x0 + W / 2, oy = y0 + H - pad - 10 * s;
    var X = function (x) { return ox + x * s; }, Y = function (y) { return oy - y * s; };
    // range rings
    ctx.strokeStyle = 'rgba(180,185,138,0.12)'; ctx.lineWidth = 1; ctx.fillStyle = C.muted; ctx.font = '500 11px Barlow, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    var ring = S.R > 200 ? 100 : 50;
    for (var r = ring; r <= S.R + 40; r += ring) { ctx.beginPath(); ctx.arc(X(0), Y(0), r * s, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); ctx.fillText(r + ' m', X(0) + 4, Y(r) - 7); }
    // target track
    ctx.setLineDash([3, 5]); ctx.strokeStyle = 'rgba(224,71,62,0.5)';
    ctx.beginPath(); ctx.moveTo(X(M.P0.x - M.h.x * 400), Y(M.P0.y - M.h.y * 400)); ctx.lineTo(X(M.P0.x + M.h.x * 400), Y(M.P0.y + M.h.y * 400)); ctx.stroke();
    // line of sight and aim line
    ctx.strokeStyle = 'rgba(180,185,138,0.6)';
    ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(M.P0.x), Y(M.P0.y)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(240,168,48,0.55)';
    ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(M.u.x * (S.R + 40)), Y(M.u.y * (S.R + 40))); ctx.stroke();
    // target as hostile diamond around a to-scale footprint
    var c = targetAt(M, t);
    U.drawTop(ctx, S.key, X(c.x), Y(c.y), headingAngle(M), s, { accent: U.C.signal });
    ctx.strokeStyle = C.signal; ctx.lineWidth = 1.5; var dd = 9;
    ctx.beginPath(); ctx.moveTo(X(c.x), Y(c.y) - dd); ctx.lineTo(X(c.x) + dd, Y(c.y)); ctx.lineTo(X(c.x), Y(c.y) + dd); ctx.lineTo(X(c.x) - dd, Y(c.y)); ctx.closePath(); ctx.stroke();
    // velocity arrow
    if (M.vt > 0) arrow(ctx, X(c.x), Y(c.y), X(c.x + M.h.x * 22), Y(c.y + M.h.y * 22), C.signal);
    // projectile
    if (S.shot) {
      var d = S.vp * t, px = M.u.x * d, py = M.u.y * d;
      ctx.strokeStyle = C.tracer; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(px), Y(py)); ctx.stroke();
      ctx.fillStyle = '#FFE2A8'; ctx.beginPath(); ctx.arc(X(px), Y(py), 3, 0, Math.PI * 2); ctx.fill();
    }
    // firer, friendly blue frame
    ctx.fillStyle = '#12263A'; ctx.strokeStyle = C.friend; ctx.lineWidth = 1.5;
    ctx.fillRect(X(0) - 9, Y(0) - 6, 18, 12); ctx.strokeRect(X(0) - 9, Y(0) - 6, 18, 12);
    ctx.beginPath(); ctx.moveTo(X(0) - 9, Y(0) - 6); ctx.lineTo(X(0) + 9, Y(0) + 6); ctx.moveTo(X(0) + 9, Y(0) - 6); ctx.lineTo(X(0) - 9, Y(0) + 6); ctx.stroke();
    ctx.restore();
    label(ctx, 'Map', x0 + 8, y0 + H - 28);
  }

  function arrow(ctx, x1, y1, x2, y2, col) {
    var a = Math.atan2(y2 - y1, x2 - x1);
    ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - 8 * Math.cos(a - 0.4), y2 - 8 * Math.sin(a - 0.4)); ctx.lineTo(x2 - 8 * Math.cos(a + 0.4), y2 - 8 * Math.sin(a + 0.4)); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawClose(ctx, M, t, x0, y0, W, H) {
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, W, H); ctx.clip();
    ctx.fillStyle = '#5E6345'; ctx.fillRect(x0, y0, W, H);
    // framing: fire position, aim point, meeting point
    var pts = [M.P0, M.A, M.I || M.P0, targetAt(M, M.tof)];
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pts.forEach(function (p) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
    var cxm = (minX + maxX) / 2, cym = (minY + maxY) / 2;
    var span = Math.max(maxX - minX, (maxY - minY) * W / H) + M.L + 8;
    span = Math.max(span, 16);
    var k = Math.min(W / span, H / (span * H / W));
    var X = function (x) { return x0 + W / 2 + (x - cxm) * k; }, Y = function (y) { return y0 + H / 2 - (y - cym) * k; };
    // grass texture grid, 5 m
    ctx.strokeStyle = 'rgba(30,34,22,0.18)'; ctx.lineWidth = 1;
    var g0x = Math.floor((cxm - W / k) / 5) * 5, g0y = Math.floor((cym - H / k) / 5) * 5;
    for (var gx = g0x; gx < cxm + W / k; gx += 5) { ctx.beginPath(); ctx.moveTo(X(gx), y0); ctx.lineTo(X(gx), y0 + H); ctx.stroke(); }
    for (var gy = g0y; gy < cym + H / k; gy += 5) { ctx.beginPath(); ctx.moveTo(x0, Y(gy)); ctx.lineTo(x0 + W, Y(gy)); ctx.stroke(); }
    // track
    ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(40,20,18,0.45)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(M.P0.x - M.h.x * 200), Y(M.P0.y - M.h.y * 200)); ctx.lineTo(X(M.P0.x + M.h.x * 200), Y(M.P0.y + M.h.y * 200)); ctx.stroke();
    ctx.setLineDash([]);
    var ha = headingAngle(M);
    // where it was when you fired
    ctx.save(); ctx.globalAlpha = 0.35; U.drawTop(ctx, S.key, X(M.P0.x), Y(M.P0.y), ha, k, { fill: '#2A2D24', turret: '#3A3E31', tracks: '#1E201A' }); ctx.restore();
    // correct meeting point
    var showAns = S.answer || (S.shot && S.shot.done);
    if (showAns && M.I) {
      ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = C.paper; ctx.lineWidth = 1.5;
      ctx.translate(X(M.I.x), Y(M.I.y)); ctx.rotate(ha); ctx.strokeRect(-M.L / 2 * k, -M.W / 2 * k, M.L * k, M.W * k); ctx.restore();
      cross(ctx, X(M.P0.x + S.dir * M.exact), Y(M.P0.y), 9, C.paper, true);
    }
    // the vehicle now
    var c = targetAt(M, t);
    U.drawTop(ctx, S.key, X(c.x), Y(c.y), ha, k, { accent: U.C.signal });
    // aim point
    cross(ctx, X(M.A.x), Y(M.A.y), 12, C.tracer, false);
    // round
    if (S.shot) {
      var d = S.vp * t, px = M.u.x * d, py = M.u.y * d;
      var tail = Math.max(0, d - 30);
      ctx.strokeStyle = C.tracer; ctx.lineWidth = 3; ctx.shadowColor = 'rgba(240,168,48,0.7)'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(X(M.u.x * tail), Y(M.u.y * tail)); ctx.lineTo(X(px), Y(py)); ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#FFE2A8'; ctx.beginPath(); ctx.arc(X(px), Y(py), 4.5, 0, Math.PI * 2); ctx.fill();
      if (S.shot.done) {
        var r = S.shot.r;
        if (r.hit) burst(ctx, X(r.p.x), Y(r.p.y), C.tracer);
        else { ctx.strokeStyle = C.signal; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(r.p.x), Y(r.p.y), 7, 0, Math.PI * 2); ctx.stroke(); }
      }
    }
    // scale bar
    var bar = span > 60 ? 20 : span > 30 ? 10 : 5;
    ctx.fillStyle = '#14160F'; ctx.fillRect(x0 + W - 14 - bar * k, y0 + H - 16, bar * k, 3);
    ctx.font = '600 12px Barlow, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText(bar + ' m', x0 + W - 14, y0 + H - 20);
    ctx.restore();
    label(ctx, 'Close-up at the target' + (S.shot ? ', t = ' + fmt(t, 2) + ' s' : ''), x0 + 8, y0 + 8);
  }

  function cross(ctx, x, y, r, col, dashed) {
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2; if (dashed) ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, Math.PI * 2); ctx.moveTo(x - r, y); ctx.lineTo(x - r * 0.3, y); ctx.moveTo(x + r * 0.3, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y - r * 0.3); ctx.moveTo(x, y + r * 0.3); ctx.lineTo(x, y + r); ctx.stroke();
    ctx.restore();
  }
  function burst(ctx, x, y, col) {
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2.5;
    for (var i = 0; i < 12; i++) { var a = i / 12 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6); ctx.lineTo(x + Math.cos(a) * 16, y + Math.sin(a) * 16); ctx.stroke(); }
    ctx.fillStyle = '#FFE2A8'; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawSight(ctx, M, x0, y0, W, H) {
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, W, H); ctx.clip();
    var sky = ctx.createLinearGradient(0, y0, 0, y0 + H);
    sky.addColorStop(0, '#9AA290'); sky.addColorStop(0.62, '#C7C6B0'); sky.addColorStop(0.62, '#7D8160'); sky.addColorStop(1, '#5E6345');
    ctx.fillStyle = sky; ctx.fillRect(x0, y0, W, H);
    var app = apparentLength(M), Tm = T[S.key];
    var leadMils = S.lead * 1000 / S.R, exMils = M.exact * 1000 / S.R, appMils = app * 1000 / S.R;
    var lo = Math.min(-appMils / 2, leadMils, exMils) - 4, hi = Math.max(appMils / 2, leadMils, exMils) + 4;
    var half = Math.max(Math.abs(lo), Math.abs(hi), 12);
    var k = (W - 20) / (2 * half);
    k = Math.min(k, (H * 0.34) / (Tm.height * 1000 / S.R));
    var cx = x0 + W / 2, gy = y0 + H * 0.62;
    var X = function (mil) { return cx + S.dir * mil * k; };
    // vehicle silhouette, squeezed by aspect
    var sPx = k * 1000 / S.R;
    U.drawOblique(ctx, S.key, cx - app / 2 * sPx, gy, sPx, S.ang, { fill: '#23261C', nose: '#17190F', flip: S.dir < 0 });
    // mil scale along the horizon
    var ink = 'rgba(16,18,12,0.9)';
    ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 1;
    var aimY = gy - Tm.height / 2 * sPx;
    ctx.beginPath(); ctx.moveTo(x0, aimY); ctx.lineTo(x0 + W, aimY); ctx.stroke();
    ctx.font = '600 11px Barlow Condensed, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    var stepT = k < 0.6 ? 50 : k < 1.5 ? 10 : k < 4 ? 5 : 1;
    var labelEvery = [10, 50, 100, 500].filter(function (e) { return k * e >= 30; })[0] || 1000;
    for (var m = -Math.ceil(half / stepT) * stepT; m <= half; m += stepT) {
      var L = m % 10 === 0 ? 9 : m % 5 === 0 ? 6 : 3;
      ctx.beginPath(); ctx.moveTo(X(m), aimY - L); ctx.lineTo(X(m), aimY); ctx.stroke();
      if (m % labelEvery === 0 && X(m) > x0 + 12 && X(m) < x0 + W - 12) {
        ctx.save(); ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(205,204,184,0.85)';
        ctx.strokeText(String(Math.abs(m)), X(m), aimY + 4); ctx.restore();
        ctx.fillText(String(Math.abs(m)), X(m), aimY + 4);
      }
    }
    // aim marks
    if (S.answer || (S.shot && S.shot.done)) {
      ctx.strokeStyle = '#F4F1E6'; ctx.setLineDash([3, 3]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(X(exMils), y0 + 6); ctx.lineTo(X(exMils), y0 + H - 6); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.strokeStyle = '#C46A00'; ctx.fillStyle = C.tracer; ctx.lineWidth = 2;
    var ax = U.clamp(X(leadMils), x0 + 8, x0 + W - 8);
    ctx.beginPath(); ctx.moveTo(ax, aimY - 16); ctx.lineTo(ax, aimY - 4); ctx.moveTo(ax, aimY + 4); ctx.lineTo(ax, aimY + 16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax, aimY - 3); ctx.lineTo(ax - 6, aimY - 13); ctx.lineTo(ax + 6, aimY - 13); ctx.closePath(); ctx.fill();
    ctx.restore();
    label(ctx, 'Through the sight, lead ' + fmt(leadMils, 1) + ' mils', x0 + 8, y0 + 8);
  }

  /* ---------- working ---------- */
  function working() {
    var M = model(), r = simulate(M);
    var vt = M.vt, t = M.tof, s = Math.sin(M.th);
    var r3 = function (x) { return Math.round(x * 1000) / 1000; }, vr = r3(vt), tr = r3(t), sr = r3(s);
    var app = apparentLength(M);
    function v(x) { return '<span class="v">' + x + '</span>'; }
    var predicted = r.hit ? 'Hit' : 'Miss';
    var err = S.lead - M.exact;
    $('#working').innerHTML =
      '<div><div class="eq-label">1. Target speed in metres per second</div><div class="eq">v = <span class="frac"><span>' + v(S.kmh) + ' km/h</span><span>3.6</span></span> = <span class="res">' + fmt(vr, 3) + ' m/s</span></div></div>' +
      '<div><div class="eq-label">2. Time for the round to get there</div><div class="eq">t = <span class="frac"><span>R</span><span>v<sub>round</sub></span></span> = <span class="frac"><span>' + v(S.R) + ' m</span><span>' + v(S.vp) + ' m/s</span></span> = <span class="res">' + fmt(tr, 3) + ' s</span></div></div>' +
      '<div><div class="eq-label">3. Sideways distance it drives in that time (sin ' + S.ang + '° = ' + fmt(sr, 3) + ')</div><div class="eq">lead = v × t × sin θ = ' + v(fmt(vr, 3)) + ' × ' + v(fmt(tr, 3)) + ' × ' + v(fmt(sr, 3)) + ' = <span class="res">' + fmt(vr * tr * sr, 2) + ' m</span></div></div>' +
      '<div class="readouts">' +
        ro('Exact lead (true meeting point)', isFinite(M.exact) ? fmt(M.exact, 2) + ' m' : 'cannot catch it') +
        ro('In mils', fmt(M.formula * 1000 / S.R, 1) + ' mils') +
        ro('In vehicle lengths as seen', app > 0.05 ? fmt(M.formula / app, 1) : '0') +
        ro('Your lead is', (Math.abs(err) < 0.05 ? 'spot on' : fmt(Math.abs(err), 1) + ' m ' + (err > 0 ? 'too far ahead' : 'too short')), r.hit ? 'good' : 'bad') +
      '</div>' +
      '<p class="note"><strong>Note:</strong> at ' + S.ang + '° the vehicle moves ' + Math.round(s * 100) + '% of its speed across your view. If it drives straight at you, you don\'t need any lead, just the right range.</p>';
    var hint = $('#lead-hint');
    hint.textContent = fmt(S.lead * 1000 / S.R, 1) + ' mils, or ' + (app > 0.05 ? fmt(S.lead / app, 1) : '0') + ' vehicle lengths as you see it.';
    return { M: M, r: r, predicted: predicted };
  }
  function ro(k, v, cls) { return '<div class="readout ' + (cls || '') + '"><div class="k">' + k + '</div><div class="val">' + v + '</div></div>'; }

  /* ---------- fire ---------- */
  function reset() { if (S.anim) { S.anim(); S.anim = null; } S.shot = null; U.clearStamp(stampEl); $('#fire').disabled = false; }
  function fire() {
    reset();
    var M = model(), r = simulate(M);
    var tStop = r.hit ? r.t : Math.min((S.R + 60) / S.vp, r.t * 1.12 + 0.05);
    S.shot = { tNow: 0, done: false, r: r };
    $('#fire').disabled = true;
    var dur = U.clamp(tStop * 1800, 900, 3000);
    S.anim = U.animate(dur, function (p) { S.shot.tNow = tStop * p; view.redraw(); }, function () {
      S.shot.done = true; S.anim = null; view.redraw(); $('#fire').disabled = false;
      var sub;
      if (r.hit) {
        var part = r.along > M.L / 6 ? 'front' : r.along < -M.L / 6 ? 'rear' : 'middle';
        sub = 'Hit the ' + part + ' of the vehicle';
      } else {
        var beyond = Math.max(0, Math.abs(r.along) - M.L / 2);
        sub = r.along < 0 ? 'Passed ' + fmt(beyond, 1) + ' m behind' : 'Passed ' + fmt(beyond, 1) + ' m in front';
        if (Math.abs(r.along) <= M.L / 2) sub = 'Passed beside the hull';
      }
      U.stamp(stampEl, r.hit, r.hit ? 'HIT' : 'MISS', sub);
      U.say((r.hit ? 'Hit. ' : 'Miss. ') + sub + '.');
      shotLog.add(r.hit, r.hit ? 'HIT' : 'MISS', T[S.key].name.split(' ')[0] + ' at ' + S.kmh + ' km/h, ' + S.ang + '°, ' + S.R + ' m, lead ' + fmt(S.lead, 1) + ' m. ' + sub + '.');
    });
  }

  /* ---------- wiring ---------- */
  function changed() { reset(); view.redraw(); working(); }
  var velCtl = U.control('vel', function (v) {
    S.vp = v;
    var match = ['m72old', 'm72', 'apilas'].filter(function (k) { return Phys.WEAPONS[k].v === v; })[0];
    S.wpn = match || 'custom'; wpnCtl.set(S.wpn, true); changed();
  });
  var wpnCtl = U.radio('wpn', function (k) { S.wpn = k; if (k !== 'custom') { S.vp = Phys.WEAPONS[k].v; velCtl.set(S.vp, true); } changed(); });
  var spdCtl = U.control('spd', function (v) { S.kmh = v; changed(); });
  var angCtl = U.control('ang', function (v) { S.ang = v; changed(); });
  function leadMax() { return Math.max(20, Math.ceil(S.R * 0.25 / 5) * 5); }
  var rCtl = U.control('rng', function (v) { S.R = v; leadCtl.setMax(leadMax()); changed(); });
  var leadCtl = U.control('lead', function (v) { S.lead = v; changed(); });
  U.radio('tgt', function (k) { S.key = k; changed(); });
  U.radio('dir', function (v) { S.dir = +v; changed(); });
  $('#answer').addEventListener('change', function (e) { S.answer = e.target.checked; view.redraw(); });
  $('#fire').addEventListener('click', fire);
  $('#auto').addEventListener('click', function () { leadCtl.set(Math.round(model().formula * 10) / 10); });
  $('#scenario').addEventListener('click', function () {
    spdCtl.set(Math.round(10 + Math.random() * 40), true); S.kmh = spdCtl.get();
    angCtl.set(Math.round(30 + Math.random() * 60), true); S.ang = angCtl.get();
    rCtl.set(Math.round((80 + Math.random() * 170) / 5) * 5, true); S.R = rCtl.get(); leadCtl.setMax(leadMax());
    leadCtl.set(0, true); S.lead = 0;
    var d = Math.random() < 0.5 ? '1' : '-1';
    U.$$('input[name="dir"]').forEach(function (i) { i.checked = i.value === d; }); S.dir = +d;
    changed();
  });
  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT' && (e.target.type === 'text' || e.target.type === 'number')) return;
    if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat && !$('#fire').disabled) { e.preventDefault(); fire(); }
  });

  S.kmh = spdCtl.get(); S.ang = angCtl.get(); S.R = rCtl.get(); S.vp = velCtl.get(); leadCtl.setMax(leadMax()); S.lead = leadCtl.get();
  working(); view.redraw();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { view.redraw(); });
  window.__sim = { S: S, fire: fire, model: model, simulate: simulate };
})();
