(function () {
  'use strict';
  var C = U.C, T = Phys.TARGETS;

  /* ---------- hero: the sight picture from the exercises, a T-72 crossing and one round ---------- */
  var R = 260, V = 6, VP = 200, CYCLE = 4.6;    // range m, target m/s, round m/s, seconds per pass
  var heroEl = document.getElementById('hero');
  var visible = true, heroTime = 2.6, t0 = null;
  var tgt = { key: 't72', aspect: 'side', range: R, az: 0 };
  var wMil = T.t72.length * 1000 / R, hMil = T.t72.height * 1000 / R;
  var aimEl = Scope.baseEl(R) + hMil / 2;
  var tof = R / VP;

  var hero = U.canvas(heroEl, function (ctx, w, h) {
    var tt = U.reduced ? CYCLE * 0.5 + 0.3 : heroTime;
    var local = tt % CYCLE, tx = (local - 0.5 * CYCLE) * V * 1000 / R;   // centre position in mils
    tgt.az = tx - wMil / 2;
    Scope.draw(ctx, w, h, {
      field: 80, panAz: 0, panEl: aimEl, target: tgt, bg: false,
      after: function (c, api) {
        var fireT = 0.5 * CYCLE - tof;
        if (local >= fireT && local < 0.5 * CYCLE) {
          var p = (local - fireT) / tof;
          var x = api.cx, y = U.lerp(api.cy + api.R * 0.95, api.cy, p) - Math.sin(p * Math.PI) * api.R * 0.1;
          c.save(); c.shadowColor = 'rgba(242,172,58,0.9)'; c.shadowBlur = 18;
          c.fillStyle = '#FFD580'; c.beginPath(); c.arc(x, y, Math.max(1, U.lerp(10, 2.5, p)), 0, Math.PI * 2); c.fill(); c.restore();
        }
        if (local >= 0.5 * CYCLE && local < 0.5 * CYCLE + 0.9) {
          var f = (local - 0.5 * CYCLE) / 0.9, bx = api.X(tx);
          var rad = Math.max(1, (10 + f * 40) * api.k / 4);
          var g = c.createRadialGradient(bx, api.cy, 0, bx, api.cy, rad);
          g.addColorStop(0, 'rgba(255,242,201,' + (1 - f) + ')'); g.addColorStop(0.35, 'rgba(242,172,58,' + (0.9 - f * 0.9) + ')'); g.addColorStop(1, 'rgba(242,172,58,0)');
          c.fillStyle = g; c.beginPath(); c.arc(bx, api.cy, rad, 0, Math.PI * 2); c.fill();
        }
      }
    });
  });
  function loop(ts) {
    if (t0 == null) t0 = ts - 2000;
    heroTime = (ts - t0) / 1000;
    if (visible && !document.hidden) hero.redraw();
    requestAnimationFrame(loop);
  }
  if (!U.reduced) requestAnimationFrame(loop); else hero.redraw();
  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(heroEl);

  /* ---------- previews on the exercise cards: one backdrop, one style ---------- */
  function backdrop(ctx, w, h, horizon) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#8E9A93'); g.addColorStop(horizon, '#C9C8B2'); g.addColorStop(horizon, '#7E8162'); g.addColorStop(1, '#4C5236');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#6F7660'; ctx.beginPath(); ctx.moveTo(0, h * horizon);
    for (var x = 0; x <= w; x += 4) ctx.lineTo(x, h * horizon - (5 + 3 * Math.sin(x * 0.03) + 2 * Math.sin(x * 0.081 + 1)));
    ctx.lineTo(w, h * horizon); ctx.closePath(); ctx.fill();
  }
  var INK = 'rgba(16,18,12,0.9)', FILL = '#2A2D22';
  U.$$('canvas[data-preview]').forEach(function (el) {
    var kind = el.getAttribute('data-preview');
    var c = U.canvas(el, function (ctx, w, h) {
      if (w < 40 || h < 40) return;
      ctx.clearRect(0, 0, w, h);
      if (kind === 'mil') {
        backdrop(ctx, w, h, 0.56);
        var k = w / 60, y = h * 0.6, s = k * 1000 / 345;
        U.drawSide(ctx, 't72', w / 2 - 6 * k, y, s, { fill: FILL });
        ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        ctx.font = '600 11px Barlow Condensed, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        for (var m = -30; m <= 30; m++) {
          var L = m % 10 === 0 ? 8 : m % 5 === 0 ? 5 : 2.5, x = w / 2 - 6 * k + m * k;
          ctx.beginPath(); ctx.moveTo(x, y - L); ctx.lineTo(x, y); ctx.stroke();
          if (m % 10 === 0 && m >= 0) ctx.fillText(String(m), x, y + 3);
        }
      } else if (kind === 'drop') {
        backdrop(ctx, w, h, 0.7);
        var gy = h * 0.82, x0 = w * 0.06, x1 = w * 0.78, aim = gy - h * 0.12;
        U.drawSide(ctx, 't72', x1, gy, w / 60, { fill: FILL, flip: true });
        ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(16,18,12,0.55)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x0, aim); ctx.lineTo(w * 0.97, aim); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = C.tracer; ctx.lineWidth = 2.5; ctx.shadowColor = 'rgba(242,172,58,0.7)'; ctx.shadowBlur = 8;
        ctx.beginPath();
        var hitX = x1 + 3 * w / 60, hitY = gy - 1.0 * w / 60;
        for (var i = 0; i <= 60; i++) { var p = i / 60, X = U.lerp(x0, hitX, p), Y = U.lerp(aim, hitY, p * p) - 4 * p * (1 - p) * h * 0.13; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }
        ctx.stroke(); ctx.shadowBlur = 0;
        ctx.fillStyle = C.friend; ctx.beginPath(); ctx.arc(x0, aim, 4, 0, Math.PI * 2); ctx.fill();
      } else {
        backdrop(ctx, w, h, 0.56);
        var s3 = w / 40, gy3 = h * 0.74, bx = w * 0.18;
        U.drawSide(ctx, 'btr82', bx, gy3, s3, { fill: FILL });
        ctx.strokeStyle = 'rgba(42,45,34,0.45)'; ctx.lineWidth = 2;
        for (var j = 0; j < 3; j++) { ctx.beginPath(); ctx.moveTo(bx - (8 + j * 9), gy3 - (0.8 + j * 0.6) * s3); ctx.lineTo(bx - (22 + j * 9), gy3 - (0.8 + j * 0.6) * s3); ctx.stroke(); }
        var cyA = gy3 - 1.4 * s3, cx2 = bx + 7.6 * s3 / 2, ax = w * 0.78;
        ctx.setLineDash([5, 4]); ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(cx2, cyA); ctx.lineTo(ax, cyA); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(cx2, cyA - 7); ctx.lineTo(cx2, cyA + 7); ctx.moveTo(ax, cyA - 7); ctx.lineTo(ax, cyA + 7); ctx.stroke();
        ctx.strokeStyle = C.tracer; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(ax, cyA, 9, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ax - 15, cyA); ctx.lineTo(ax - 5, cyA); ctx.moveTo(ax + 5, cyA); ctx.lineTo(ax + 15, cyA); ctx.moveTo(ax, cyA - 15); ctx.lineTo(ax, cyA - 5); ctx.moveTo(ax, cyA + 5); ctx.lineTo(ax, cyA + 15); ctx.stroke();
        ctx.fillStyle = INK; ctx.font = '600 13px Barlow Condensed, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText('lead', (cx2 + ax) / 2, cyA - 6);
      }
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(c.redraw);
  });
})();
