(function () {
  'use strict';
  var $ = U.$, fmt = U.fmt, G = Phys.G, C = U.C;
  var S = { wpn: 'm72', v: 200, R: 220, Rs: 150, key: 't72', ghost: true, shot: null, anim: null };
  var stampEl = $('#stamp');
  var shotLog = U.log($('#log'), $('#score')); shotLog.clear();

  function H() { return Phys.TARGETS[S.key].height; }
  function y(x, Rs) { return Phys.flatHeight(x, Rs == null ? S.Rs : Rs, S.v); }
  function dropAt(x) { return 0.5 * G * Math.pow(x / S.v, 2); }
  function groundHit(Rs) { // x where the round reaches the ground (y = -H/2)
    var h = H();
    return (Rs + Math.sqrt(Rs * Rs + 4 * h * S.v * S.v / G)) / 2;
  }
  function outcome() {
    var h = H(), yr = y(S.R);
    if (yr < -h / 2) { var xg = groundHit(S.Rs); return { hit: false, kind: 'short', yr: yr, xEnd: xg, gap: S.R - xg }; }
    if (yr > h / 2) { return { hit: false, kind: 'over', yr: yr, xEnd: groundHit(S.Rs), gap: yr - h / 2 }; }
    return { hit: true, kind: 'hit', yr: yr, xEnd: S.R };
  }

  /* ---------- drawing ---------- */
  var view = U.canvas($('#view'), draw);
  var layout = {};

  function draw(ctx, w, h) {
    if (w < 80 || h < 80) return; // not laid out yet
    var small = w < 520;
    var m = { l: small ? 40 : 56, r: 14, t: 14, b: small ? 30 : 36 };
    var pw = w - m.l - m.r, ph = h - m.t - m.b;
    var Ht = H();
    var xMax = Math.max(60, Math.max(S.R, S.Rs) * 1.14 + 12);
    var apex = function (Rs) { return G * Rs * Rs / (8 * S.v * S.v); };
    var slope0 = G * S.Rs / (2 * S.v * S.v);
    var bot = -Ht / 2 - 0.7;
    var sx = pw / xMax;
    // inset geometry, and keep the curves clear of it
    var rI = U.clamp(Math.min(w, h) * 0.13, 36, 86);
    var insetBottom = m.t + 2 * rI + 34, insetLeft = w - m.r - 2 * rI - 24;
    var xr0 = (insetLeft - m.l) / sx;
    var allMax = Ht / 2, rightMax = Ht / 2;
    for (var sxm = 0; sxm <= xMax; sxm += xMax / 160) {
      var cand = Math.max(y(sxm), sxm <= S.R ? slope0 * sxm : -99, S.ghost && sxm <= S.R ? y(sxm, S.R) : -99);
      allMax = Math.max(allMax, cand);
      if (sxm >= xr0) rightMax = Math.max(rightMax, cand);
    }
    var sy = Math.min(ph / (allMax + 0.6 - bot), (h - m.b - insetBottom) / (rightMax + 0.3 - bot), ph / 6);
    var top = bot + ph / sy;
    S.rI = rI;
    layout = { m: m, sx: sx, sy: sy, top: top };
    var X = function (x) { return m.l + x * sx; };
    var Y = function (v) { return m.t + (top - v) * sy; };
    $('#vx').textContent = Math.max(1, Math.round(sy / sx));

    // backdrop
    ctx.fillStyle = '#12140F'; ctx.fillRect(0, 0, w, h);
    var gy = Y(-Ht / 2);
    var sky = ctx.createLinearGradient(0, m.t, 0, gy);
    sky.addColorStop(0, '#171A13'); sky.addColorStop(1, '#232720');
    ctx.fillStyle = sky; ctx.fillRect(m.l, m.t, pw, gy - m.t);
    ctx.fillStyle = '#2E3322'; ctx.fillRect(m.l, gy, pw, h - m.b - gy);
    ctx.fillStyle = '#3B4129'; ctx.fillRect(m.l, gy, pw, 2);

    // grid
    ctx.font = '500 ' + (small ? 11 : 12) + 'px Barlow, sans-serif';
    ctx.fillStyle = C.muted; ctx.strokeStyle = 'rgba(180,185,138,0.08)'; ctx.lineWidth = 1;
    var span = top - bot, hs = [1, 2, 5, 10, 20, 50, 100, 200].filter(function (st) { return span / st <= 7; })[0] || 500;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var v = Math.ceil(bot / hs) * hs; v <= top; v += hs) {
      ctx.beginPath(); ctx.moveTo(m.l, Y(v)); ctx.lineTo(w - m.r, Y(v)); ctx.stroke();
      ctx.fillText((v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + ' m', m.l - 6, Y(v));
    }
    var ds = xMax > 320 ? 100 : xMax > 140 ? 50 : 25;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (var d = 0; d <= xMax; d += ds) {
      ctx.beginPath(); ctx.moveTo(X(d), m.t); ctx.lineTo(X(d), h - m.b); ctx.stroke();
      ctx.fillText(d + ' m', X(d), h - m.b + 8);
    }

    // line of sight
    ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(180,185,138,0.75)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(xMax), Y(0)); ctx.stroke();
    // bore line
    var slope = G * S.Rs / (2 * S.v * S.v);
    ctx.strokeStyle = 'rgba(240,168,48,0.45)';
    ctx.beginPath(); ctx.moveTo(X(0), Y(0)); var bx = Math.min(S.R, (top - 0.2) / slope); ctx.lineTo(X(bx), Y(bx * slope)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillStyle = C.sage;
    ctx.fillText('Line of sight to the aim point', X(4), Y(0) - 4);
    var lbx = Math.max(Math.min(bx, xMax * 0.32), Math.min(bx, 70 / sx));
    ctx.fillStyle = 'rgba(240,168,48,0.85)';
    // only label the tube line when it has pulled clear of the line of sight label
    if (Y(0) - Y(lbx * slope) > 24 && X(S.R) - X(0) > 160) { ctx.save(); ctx.translate(X(lbx), Y(lbx * slope) - 5); ctx.rotate(-Math.atan2(slope * sy, sx)); ctx.fillText('Tube points here', 0, 0); ctx.restore(); }

    // target face (true height on the stretched scale) with a label
    ctx.fillStyle = 'rgba(224,71,62,0.22)'; ctx.fillRect(X(S.R), Y(Ht / 2), Math.max(8, Phys.TARGETS[S.key].length * sx), Ht * sy);
    ctx.fillStyle = C.signal; ctx.fillRect(X(S.R) - 1.5, Y(Ht / 2), 3, Ht * sy);
    ctx.font = '600 ' + (small ? 12 : 14) + 'px Barlow Condensed, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText(Phys.TARGETS[S.key].name.split(' ')[0], X(S.R) + 4, Y(Ht / 2) - 3);
    ctx.font = '500 ' + (small ? 11 : 12) + 'px Barlow, sans-serif';
    // sight-range marker
    ctx.fillStyle = C.tracer; ctx.strokeStyle = C.tracer;
    ctx.beginPath(); ctx.arc(X(S.Rs), Y(0), 3.5, 0, Math.PI * 2); ctx.stroke();
    var sightLabel = function () {
      ctx.save(); ctx.font = '500 ' + (small ? 11 : 12) + 'px Barlow, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      var lx = Math.abs(X(S.Rs) - X(S.R)) < 50 ? X(S.Rs) - 34 : X(S.Rs), ly = Y(0) + 6;
      ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(18,20,15,0.9)'; ctx.strokeText('Sight ' + S.Rs + ' m', lx, ly);
      ctx.fillStyle = C.tracer; ctx.fillText('Sight ' + S.Rs + ' m', lx, ly); ctx.restore();
    };

    // ghost path
    if (S.ghost && S.Rs !== S.R) {
      ctx.setLineDash([2, 5]); ctx.strokeStyle = 'rgba(232,228,216,0.45)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (var gx = 0; gx <= S.R; gx += Math.max(0.5, S.R / 200)) { var py = Y(y(gx, S.R)); if (gx) ctx.lineTo(X(gx), py); else ctx.moveTo(X(gx), py); }
      ctx.stroke(); ctx.setLineDash([]);
    }

    // shooter
    ctx.fillStyle = C.friend;
    ctx.beginPath(); ctx.arc(X(0), Y(0), 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(X(0) - 2, Y(0), 4, gy - Y(0));

    // fired path
    var sh = S.shot;
    if (sh) {
      var xNow = sh.xNow;
      ctx.strokeStyle = C.tracer; ctx.lineWidth = 2.5; ctx.shadowColor = 'rgba(240,168,48,0.6)'; ctx.shadowBlur = 8;
      ctx.beginPath();
      var step = Math.max(0.5, xNow / 240);
      for (var x = 0; x <= xNow + 1e-6; x += step) { if (x) ctx.lineTo(X(x), Y(y(x))); else ctx.moveTo(X(x), Y(y(x))); }
      ctx.lineTo(X(xNow), Y(y(xNow)));
      ctx.stroke(); ctx.shadowBlur = 0;
      // projectile head
      ctx.fillStyle = '#FFE2A8'; ctx.beginPath(); ctx.arc(X(xNow), Y(y(xNow)), 4, 0, Math.PI * 2); ctx.fill();
      if (sh.done) {
        var o = sh.o;
        burst(ctx, X(o.xEnd > xMax ? xMax : o.xEnd), Y(Math.max(-Ht / 2, y(Math.min(o.xEnd, xMax)))), o.hit ? C.tracer : '#C9B48A');
        // drop bracket at the true range
        var yb = slope * S.R, yr = y(S.R);
        bracket(ctx, X(S.R) + 14, Y(yb), Y(yr), 'drop ' + fmt(dropAt(S.R), 2) + ' m', 'rgba(240,168,48,0.9)', small, Y(Ht / 2) - 10);
      }
    }
    sightLabel();

    inset(ctx, w, h, m);
  }

  function burst(ctx, x, yy, col) {
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2;
    for (var i = 0; i < 10; i++) { var a = i / 10 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 5, yy + Math.sin(a) * 5); ctx.lineTo(x + Math.cos(a) * 12, yy + Math.sin(a) * 12); ctx.stroke(); }
    ctx.restore();
  }
  function bracket(ctx, x, y1, y2, label, col, small, avoidY) {
    var hgt = ctx.canvas.height / (ctx.getTransform ? ctx.getTransform().d : 1);
    y1 = U.clamp(y1, 4, hgt - 40); y2 = U.clamp(y2, 4, hgt - 40);
    if (Math.abs(y2 - y1) < 6) return;
    ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x - 4, y1); ctx.lineTo(x + 4, y1); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.moveTo(x - 4, y2); ctx.lineTo(x + 4, y2); ctx.stroke();
    ctx.font = '600 ' + (small ? 12 : 14) + 'px Barlow Condensed, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    var tw = ctx.measureText(label).width, my = (y1 + y2) / 2;
    if (avoidY != null && Math.abs(my - avoidY) < 18) my = avoidY + 22;   // keep clear of the target's name
    if (x + 8 + tw > ctx.canvas.width / (window.devicePixelRatio > 2.5 ? 2.5 : (window.devicePixelRatio || 1)) - 4) { ctx.textAlign = 'right'; ctx.fillText(label, x - 8, my); }
    else ctx.fillText(label, x + 8, my);
    ctx.restore();
  }

  function inset(ctx, w, h, m) {
    var r = S.rI || 60;
    var cx = w - m.r - r - 10, cy = m.t + r + 10;
    var Ht = H(), k = r / 5.2;          // px per metre, about 10 m across
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#B9BBA2'; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    var gy = cy + Ht / 2 * k;
    ctx.fillStyle = '#6B6F4E'; ctx.fillRect(cx - r, gy, 2 * r, r * 2);
    var L = Phys.TARGETS[S.key].length;
    U.drawSide(ctx, S.key, cx - L / 2 * k, gy, k, { fill: '#2A2D24', flip: true });
    // aim mark
    ctx.strokeStyle = '#14160F'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx - 6, cy); ctx.moveTo(cx + 6, cy); ctx.lineTo(cx + r, cy); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy - 6); ctx.moveTo(cx, cy + 6); ctx.lineTo(cx, cy + r); ctx.stroke();
    var sh = S.shot;
    if (sh && sh.done) {
      var o = sh.o, iy = cy - o.yr * k;
      if (o.kind === 'short') iy = gy;
      var vis = o.kind !== 'short' && Math.abs(cy - iy) < r - 8;
      var col = o.hit ? C.tracer : C.signal;
      if (vis) {
        ctx.fillStyle = col; ctx.strokeStyle = '#14160F'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, iy, Math.max(5, 0.33 * k), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else {
        ctx.fillStyle = col;
        if (o.kind === 'short') iy = cy + r * 2;
        var ey = iy < cy ? cy - r + 10 : cy + r - 10, dir = iy < cy ? -1 : 1;
        ctx.beginPath(); ctx.moveTo(cx, ey + dir * 6); ctx.lineTo(cx - 9, ey - dir * 8); ctx.lineTo(cx + 9, ey - dir * 8); ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
    ctx.strokeStyle = '#3A3F31'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, r + 1.5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = C.sage; ctx.font = '500 12px Barlow, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('At the target', cx, cy + r + 6);
  }

  /* ---------- working ---------- */
  function r3(x) { return Math.round(x * 1000) / 1000; }
  function gapTxt(g) { return g < 1 ? fmt(g, 1) : String(Math.round(g)); }
  /* Each line is worked from the numbers it shows, so a calculator gives the same answer. */
  function working() {
    var o = outcome(), t = r3(S.R / S.v), dR = r3(0.5 * G * t * t), ts = r3(S.Rs / S.v), dS = r3(0.5 * G * ts * ts), lift = r3(dS * S.R / S.Rs), miss = lift - dR;
    var Ht = H(), win = Ht * S.v * S.v / (G * S.R);
    var lo = U.clamp(S.R - win, 25, 500), hi = U.clamp(S.R + win, 25, 500);
    var windowTxt = lo <= 25 && hi >= 500 ? 'Any setting, 25 to 500 m' : Math.round(lo) + ' to ' + Math.round(hi) + ' m';
    function v(x) { return '<span class="v">' + x + '</span>'; }
    var missTxt = fmt(Math.abs(miss), 2) + ' m ' + (miss < 0 ? 'low' : 'high');
    $('#working').innerHTML =
      '<div><div class="eq-label">1. Time of flight</div><div class="eq">t = <span class="frac"><span>R</span><span>v</span></span> = <span class="frac"><span>' + v(S.R) + ' m</span><span>' + v(S.v) + ' m/s</span></span> = <span class="res">' + fmt(t, 3) + ' s</span></div></div>' +
      '<div><div class="eq-label">2. How far it falls below the tube line in that time</div><div class="eq">drop = ½ × 9.81 × ' + v(fmt(t, 3)) + '² = <span class="res">' + fmt(dR, 3) + ' m</span></div></div>' +
      '<div><div class="eq-label">3. How much the sight lifted the tube at that range. At its ' + S.Rs + ' m mark it makes up for ½ × 9.81 × ' + fmt(ts, 3) + '² = ' + fmt(dS, 3) + ' m of drop</div><div class="eq">lift = ' + v(fmt(dS, 3)) + ' m × <span class="frac"><span>' + v(S.R) + '</span><span>' + v(S.Rs) + '</span></span> = <span class="res">' + fmt(lift, 3) + ' m</span></div></div>' +
      '<div><div class="eq-label">4. Where the round passes the aim point (lift minus drop)</div><div class="eq">' + fmt(lift, 3) + ' − ' + fmt(dR, 3) + ' = ' + fmt(miss, 3) + ', so <span class="res ' + (o.hit ? '' : 'bad') + '">' + (Math.abs(miss) < 0.005 ? 'dead centre' : missTxt) + '</span></div></div>' +
      '<div class="readouts">' +
        ro('Target half height', fmt(Ht / 2, 2) + ' m') +
        ro('Result', o.hit ? 'Hit' : o.kind === 'short' ? 'Short by ' + gapTxt(o.gap) + ' m' : 'Over by ' + fmt(o.gap, 1) + ' m', o.hit ? 'good' : 'bad') +
        ro('Sight settings that still hit', windowTxt) +
        ro('Peak above the aim line', fmt(G * S.Rs * S.Rs / (8 * S.v * S.v), 2) + ' m') +
      '</div>' +
      '<p class="note"><strong>Rule of thumb:</strong> miss ≈ g × R × (sight − R) ÷ 2v². A faster rocket gives you a lot more room for a bad range guess, because the margin goes up with the speed squared.</p>';
  }
  function ro(k, v, cls) { return '<div class="readout ' + (cls || '') + '"><div class="k">' + k + '</div><div class="val">' + v + '</div></div>'; }

  /* ---------- fire ---------- */
  function reset() {
    if (S.anim) { S.anim(); S.anim = null; }
    S.shot = null; U.clearStamp(stampEl);
    $('#fire').disabled = false;
  }
  function fire() {
    reset();
    var o = outcome();
    var xMax = Math.max(60, Math.max(S.R, S.Rs) * 1.14 + 12);
    var xEnd = Math.min(o.xEnd, xMax);
    S.shot = { o: o, xNow: 0, done: false };
    var dur = U.clamp(xEnd / S.v * 1400, 650, 2600);
    $('#fire').disabled = true;
    S.anim = U.animate(dur, function (p) { S.shot.xNow = xEnd * p; view.redraw(); }, function () {
      S.shot.done = true; S.anim = null; view.redraw();
      $('#fire').disabled = false;
      var wpn = S.wpn === 'custom' ? S.v + ' m/s' : Phys.WEAPONS[S.wpn].name;
      var sub = o.hit ? (Math.abs(o.yr) < 0.05 ? 'Dead centre' : fmt(Math.abs(o.yr), 1) + ' m ' + (o.yr < 0 ? 'low' : 'high') + ' of centre') : o.kind === 'short' ? 'Lands ' + gapTxt(o.gap) + ' m short' : 'Passes ' + fmt(o.gap, 1) + ' m over';
      U.stamp(stampEl, o.hit, o.hit ? 'HIT' : 'MISS', sub, { variant: null });
      U.say((o.hit ? 'Hit. ' : 'Miss. ') + sub + '.');
      shotLog.add(o.hit, o.hit ? 'HIT' : 'MISS', wpn + ', sight ' + S.Rs + ' m, true ' + S.R + ' m. ' + sub + '.');
    });
  }

  /* ---------- wiring ---------- */
  function changed() { reset(); view.redraw(); working(); }
  var velCtl = U.control('vel', function (v) {
    S.v = v;
    var match = Object.keys(Phys.WEAPONS).filter(function (k) { return Phys.WEAPONS[k].v === v; })[0];
    wpnCtl.set(match || 'custom', true); S.wpn = match || 'custom';
    changed();
  });
  var wpnCtl = U.radio('wpn', function (k) { S.wpn = k; if (k !== 'custom') { S.v = Phys.WEAPONS[k].v; velCtl.set(S.v, true); } changed(); });
  var rCtl = U.control('rng', function (v) { S.R = v; changed(); });
  var sCtl = U.control('sight', function (v) { S.Rs = v; changed(); });
  U.radio('tgt', function (k) { S.key = k; changed(); });
  $('#ghost').addEventListener('change', function (e) { S.ghost = e.target.checked; view.redraw(); });
  $('#fire').addEventListener('click', fire);
  $('#match').addEventListener('click', function () { sCtl.set(S.R); });
  $('#scenario').addEventListener('click', function () {
    var R = Math.round((90 + Math.random() * 200) / 5) * 5;
    var err = (Math.random() < 0.5 ? -1 : 1) * (0.08 + Math.random() * 0.25);
    rCtl.set(R, true); S.R = R;
    sCtl.set(U.clamp(Math.round(R * (1 + err) / 5) * 5, 25, 500), true); S.Rs = sCtl.get();
    changed();
  });
  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT' && (e.target.type === 'text' || e.target.type === 'number')) return;
    if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat && !$('#fire').disabled) { e.preventDefault(); fire(); }
  });

  S.v = velCtl.get(); S.R = rCtl.get(); S.Rs = sCtl.get();
  working(); view.redraw();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { view.redraw(); });
  window.__sim = { S: S, fire: fire, outcome: outcome };
})();
