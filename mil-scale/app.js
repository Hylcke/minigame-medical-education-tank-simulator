(function () {
  'use strict';
  var T = Phys.TARGETS, $ = U.$, fmt = U.fmt;
  var OBS_H = 3;          // observer eye height above the target's ground, metres
  var FIELD = 112;        // mils across the lens (changed by the magnification control)
  var S = {
    mode: 'explore', key: 't72', aspect: 'side', range: 300,
    panAz: 0, panEl: 0,
    p: null,               // practice target {key, aspect, range, az}
    dim: 'len', reading: 20, revealed: false
  };

  var stampEl = $('#stamp');
  var cardLog = U.log($('#log'), $('#score')); cardLog.clear();

  function target() { return S.mode === 'explore' ? { key: S.key, aspect: S.aspect, range: S.range, az: 0 } : S.p; }
  function sizeOf(t, dim) {
    var v = T[t.key];
    if (dim === 'ht') return v.height;
    return t.aspect === 'side' ? v.length : v.front;
  }

  function snap() {
    var t = target();
    // a vehicle wider than the Close lens needs the Wide field
    if (FIELD < 112 && sizeOf(t, 'len') * 1000 / t.range > FIELD - 6) { FIELD = 112; zoomCtl.set('112', true); }
    var w = sizeOf(t, 'len') * 1000 / t.range;
    // rear edge on a tick, both ends inside the lens
    S.panAz = t.az + (w < FIELD * 0.4 ? 0 : Math.round(w / 2 / 5) * 5);
    S.panEl = -OBS_H * 1000 / t.range;
  }

  /* ---------- drawing ---------- */
  var view = U.canvas($('#view'), draw);

  function draw(ctx, w, h) {
    var t = target();
    Scope.draw(ctx, w, h, {
      field: FIELD, panAz: S.panAz, panEl: S.panEl, target: t,
      info: ['Binocular, ' + FIELD + ' mil field', S.mode === 'explore' || S.revealed ? 'Range ' + Math.round(t.range) + ' m' : 'Range unknown']
    });
  }

  /* ---------- working panel ---------- */
  function working() {
    var el = $('#working'), t = target();
    var v = T[t.key];
    var dimName = t.aspect === 'side' ? 'length' : 'width';
    if (S.mode === 'explore') {
      var size = sizeOf(t, 'len'), mils = Math.round(size * 1000 / t.range * 100) / 100, hm = v.height * 1000 / t.range;
      var lo = size * 1000 / (mils + 1), hi = mils > 1 ? size * 1000 / (mils - 1) : Infinity;
      el.innerHTML =
        '<div><div class="eq-label">Range from a known size</div>' +
        '<div class="eq">Range = <span class="frac"><span>size × 1000</span><span>mils</span></span> = <span class="frac"><span><span class="v">' + fmt(size, 1) + '</span> m × 1000</span><span><span class="v">' + fmt(mils, 2) + '</span> mils</span></span> = <span class="res">' + Math.round(size * 1000 / mils) + ' m</span></div></div>' +
        '<div class="readouts">' +
          ro('Its ' + dimName + ' on the scale', fmt(mils, mils < 10 ? 2 : 1) + ' mils') +
          ro('Its height on the scale', fmt(hm, 1) + ' mils') +
          ro('One mil at this range', fmt(t.range / 1000, 2) + ' m') +
          ro('If you misread by 1 mil', Math.round(lo) + ' to ' + (isFinite(hi) ? Math.round(hi) : '∞') + ' m', mils < 8 ? 'bad' : '') +
        '</div>' +
        '<p class="note"><strong>Tip:</strong> close vehicles look big, so a small misreading barely changes the answer. Far away, being half a mil out can be the difference between a hit and a miss.</p>';
    } else {
      var sz = sizeOf(t, S.dim), est = sz * 1000 / S.reading;
      var html = '<div><div class="eq-label">Your call, using the ' + v.name + (S.dim === 'ht' ? ' height' : ' ' + dimName) + ' (' + fmt(sz, 1) + ' m)</div>' +
        '<div class="eq">Range = <span class="frac"><span><span class="v">' + fmt(sz, 1) + '</span> m × 1000</span><span><span class="v">' + fmt(S.reading, 1) + '</span> mils</span></span> = <span class="res">' + Math.round(est) + ' m</span></div></div>';
      if (S.revealed) {
        var err = (est - t.range) / t.range * 100;
        var ok = Math.abs(err) <= 10;
        var trueM = sz * 1000 / t.range;
        html += '<div class="readouts">' +
          ro('True range', Math.round(t.range) + ' m') +
          ro('Correct reading', fmt(trueM, 1) + ' mils') +
          ro('Your error', (err > 0 ? '+' : '') + fmt(err, 0) + '%', ok ? 'good' : 'bad');
        if (t.range <= 400) {
          var miss = Phys.flatHeight(t.range, est, 200);
          html += ro('M72 round at the target', fmt(Math.abs(miss), 1) + ' m ' + (miss < 0 ? 'low' : 'high'), Math.abs(miss) <= v.height / 2 ? 'good' : 'bad');
        }
        html += '</div><p class="note"><strong>The M72 line</strong> assumes a 200 m/s rocket with the sight set to your call and the aim on the centre of the vehicle. The <a href="../projectile-drop/index.html">drop simulator</a> shows the whole path.</p>';
      } else {
        html += '<p class="note">The vehicle is a <strong>' + v.name + '</strong>, ' + (t.aspect === 'side' ? 'side on, ' + fmt(v.length, 1) + ' m long' + (t.key === 't72' || t.key === 'bmp2' ? ' (hull only, ignore the gun)' : '') : 'head on, ' + fmt(v.front, 1) + ' m wide') + ' and ' + fmt(v.height, 1) + ' m high.</p>';
      }
      el.innerHTML = html;
    }
  }
  function ro(k, v, cls) { return '<div class="readout ' + (cls || '') + '"><div class="k">' + k + '</div><div class="val">' + v + '</div></div>'; }

  /* ---------- practice ---------- */
  var lastKey = null;
  function newTarget() {
    var keys = ['t72', 'bmp2', 'btr82', 'ural', 't72', 'bmp2'];
    var key; do { key = keys[Math.floor(Math.random() * keys.length)]; } while (key === lastKey && Math.random() < 0.7);
    lastKey = key;
    var range = Math.round((150 + Math.pow(Math.random(), 1.2) * 1050) / 10) * 10;
    S.p = { key: key, aspect: Math.random() < 0.7 ? 'side' : 'front', range: range, az: (Math.random() * 2 - 1) * 18 };
    S.revealed = false;
    S.panAz = (Math.random() * 2 - 1) * 8; S.panEl = -OBS_H * 1000 / range + 4 + Math.random() * 6;
    S.startPan = { az: S.panAz, el: S.panEl };
    U.clearStamp(stampEl);
    $('#call').disabled = false;
    lockReading(false);
    refresh();
  }
  function call() {
    if (S.revealed) return;
    var t = S.p, sz = sizeOf(t, S.dim), est = sz * 1000 / S.reading;
    var err = (est - t.range) / t.range * 100, ok = Math.abs(err) <= 10;
    S.revealed = true;
    U.stamp(stampEl, ok, ok ? 'GOOD' : 'MISS', 'Called ' + Math.round(est) + ' m, true ' + t.range + ' m');
    U.say((ok ? 'Good call. ' : 'Off. ') + 'You called ' + Math.round(est) + ' metres, the true range is ' + t.range + ' metres.');
    cardLog.add(ok, (err > 0 ? '+' : '') + fmt(err, 0) + '%', T[t.key].name + (t.aspect === 'side' ? ' side on' : ' head on') + ': ' + Math.round(est) + ' m called, ' + t.range + ' m true');
    $('#call').disabled = true;
    S.called = { reading: S.reading, dim: S.dim };
    lockReading(true);
    refresh();
  }
  function lockReading(on) {
    ['#reading', '#reading-n'].forEach(function (q) { $(q).disabled = on; });
    U.$$('input[name="dim"]').forEach(function (i) { i.disabled = on; });
  }

  /* ---------- wiring ---------- */
  function refresh() { view.redraw(); working(); }
  var rangeCtl = U.control('range', function (v) { S.range = v; snap(); refresh(); });
  var readCtl = U.control('reading', function (v) { S.reading = v; working(); });
  S.reading = readCtl.get();
  U.radio('tgt', function (v) { S.key = v; snap(); refresh(); });
  U.radio('asp', function (v) { S.aspect = v; snap(); refresh(); });
  U.radio('dim', function (v) { S.dim = v; working(); });
  U.radio('mode', function (v) {
    S.mode = v;
    $('#explore-ctl').hidden = v !== 'explore';
    $('#practice-ctl').hidden = v !== 'practice';
    U.clearStamp(stampEl);
    if (v === 'practice') newTarget(); else { snap(); refresh(); }
  });
  var zoomCtl = U.radio('zoom', function (v) { FIELD = +v; var c = Scope.clampPan(S.panAz, S.panEl, target(), FIELD); S.panAz = c.az; S.panEl = c.el; view.redraw(); });
  if (window.innerWidth < 600) { zoomCtl.set('56', true); FIELD = 56; }
  $('#snap').addEventListener('click', function () { snap(); refresh(); });
  $('#call').addEventListener('click', call);
  $('#next').addEventListener('click', newTarget);
  $('#recentre').addEventListener('click', function () { if (S.startPan) { S.panAz = S.startPan.az; S.panEl = S.startPan.el; view.redraw(); } });
  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT' && (e.target.type === 'text' || e.target.type === 'number')) return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (S.mode === 'practice' && (e.key === 'n' || e.key === 'N')) newTarget();
  });

  // drag and keyboard pan
  Scope.attachPan($('#view'), function () { return { panAz: S.panAz, panEl: S.panEl, field: FIELD }; },
    function (az, el) { var c = Scope.clampPan(az, el, target(), FIELD); S.panAz = c.az; S.panEl = c.el; }, function () { view.redraw(); });

  snap(); refresh();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { view.redraw(); });
  window.__sim = { S: S, refresh: refresh, newTarget: newTarget, call: call };
})();
