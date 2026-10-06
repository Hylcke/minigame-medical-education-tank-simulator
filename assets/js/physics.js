/* Simplified ballistics used by all three simulators.
   Works in the browser (window.Phys) and in Node (module.exports) for tests. */
(function (root) {
  'use strict';
  var G = 9.81;

  // Vehicles. Sizes in metres from open sources (see README).
  var TARGETS = {
    t72:    { name: 'T-72 tank',          length: 6.9, width: 3.6, height: 2.2, front: 3.6 },
    bmp2:   { name: 'BMP-2',              length: 6.7, width: 3.2, height: 2.45, front: 3.2 },
    btr82:  { name: 'BTR-82A',            length: 7.6, width: 2.9, height: 2.8, front: 2.9 },
    ural:   { name: 'Ural-4320 truck',    length: 7.4, width: 2.5, height: 2.9, front: 2.5 },
    soldier:{ name: 'Standing soldier',   length: 0.5, width: 0.5, height: 1.8, front: 0.5 }
  };

  var WEAPONS = {
    m72old: { name: 'M72 LAW (older)', v: 145, eff: 200, note: 'Early M72 rocket' },
    m72:    { name: 'M72 LAW (newer)', v: 200, eff: 200, note: 'M72 EC and later' },
    apilas: { name: 'APILAS',          v: 293, eff: 330, note: 'Heavier, faster rocket' },
    rifle:  { name: '7.62 mm rifle',   v: 715, eff: 600, note: 'Bullet, for comparison' }
  };

  var PROFILES = {
    t72: {
      track: [[0.15, 0.62], [0.55, 0.05], [6.35, 0.05], [6.8, 0.62]],
      wheels: { r: 0.36, y: 0.42, xs: [1.05, 2.0, 2.95, 3.9, 4.85, 5.8] },
      hull: [[0, 1.0], [0.25, 1.42], [6.35, 1.42], [6.9, 1.0], [6.75, 0.62], [0.15, 0.62]],
      turret: [[2.15, 1.42], [2.45, 1.86], [3.2, 2.12], [3.6, 2.2], [4.35, 2.15], [4.95, 1.82], [5.15, 1.42]],
      gun: [4.95, 1.74, 9.3, 1.86],
      extra: [[2.0, 1.42], [2.0, 1.62], [1.0, 1.62], [0.9, 1.42]]
    },
    bmp2: {
      track: [[0.1, 0.62], [0.5, 0.05], [6.0, 0.05], [6.5, 0.62]],
      wheels: { r: 0.33, y: 0.4, xs: [0.95, 1.85, 2.75, 3.65, 4.55, 5.45] },
      hull: [[0, 0.62], [0, 1.78], [3.9, 1.95], [6.7, 1.0], [6.5, 0.62]],
      turret: [[2.4, 1.84], [2.65, 2.38], [2.9, 2.45], [3.9, 2.45], [4.15, 1.84]],
      gun: [3.9, 2.18, 7.0, 2.26],
      extra: null
    },
    btr82: {
      track: null,
      wheels: { r: 0.55, y: 0.55, xs: [1.25, 2.75, 4.75, 6.25] },
      hull: [[0, 0.75], [0, 1.95], [0.45, 2.3], [6.55, 2.3], [7.6, 1.45], [7.4, 0.75]],
      turret: [[4.1, 2.3], [4.3, 2.75], [5.25, 2.8], [5.45, 2.3]],
      gun: [5.2, 2.52, 6.9, 2.6],
      extra: null
    },
    ural: {
      track: null,
      wheels: { r: 0.56, y: 0.56, xs: [1.0, 2.45, 6.2] },
      hull: [[0, 1.05], [0, 1.3], [7.4, 1.3], [7.4, 1.05]],
      turret: [[0.05, 1.3], [0.05, 2.9], [4.6, 2.9], [4.6, 1.3]],
      gun: null,
      extra: [[4.85, 1.3], [4.85, 2.75], [6.2, 2.75], [6.55, 2.05], [7.4, 1.95], [7.4, 1.3]]
    }
  };


  /* Head-on outlines, x across the width (0..front) and h up. 'top' marks the turret, which
     at an angle is drawn from the side profile instead. Kept here so drawing and hit tests share them. */
  var FRONT = {
    t72: [[[0, 0], [0.6, 0], [0.6, 0.85], [0, 0.85]], [[3.0, 0], [3.6, 0], [3.6, 0.85], [3.0, 0.85]],
      [[0.1, 0.8], [3.5, 0.8], [3.35, 1.42], [0.25, 1.42]], { top: [[0.7, 1.38], [2.9, 1.38], [2.46, 2.2], [1.14, 2.2]] }],
    bmp2: [[[0, 0], [0.6, 0], [0.6, 0.85], [0, 0.85]], [[2.6, 0], [3.2, 0], [3.2, 0.85], [2.6, 0.85]],
      [[0.1, 0.8], [3.1, 0.8], [2.95, 1.9], [0.25, 1.9]], { top: [[0.9, 1.86], [2.3, 1.86], [2.02, 2.45], [1.18, 2.45]] }],
    btr82: [[[0.05, 0], [0.45, 0], [0.45, 1.1], [0.05, 1.1]], [[2.45, 0], [2.85, 0], [2.85, 1.1], [2.45, 1.1]],
      [[0.1, 0.7], [2.8, 0.7], [2.6, 2.3], [0.3, 2.3]], { top: [[0.9, 2.25], [2.0, 2.25], [2.0, 2.8], [0.9, 2.8]] }],
    ural: [[[0.05, 0], [0.45, 0], [0.45, 1.1], [0.05, 1.1]], [[2.05, 0], [2.45, 0], [2.45, 1.1], [2.05, 1.1]],
      [[0.15, 0.9], [2.35, 0.9], [2.35, 2.0], [0.15, 2.0]], [[0.2, 1.98], [2.3, 1.98], [2.3, 2.9], [0.2, 2.9]]]
  };
  function frontPolys(key, withTop) {
    var out = [];
    (FRONT[key] || []).forEach(function (p) { if (p.top) { if (withTop) out.push(p.top); } else out.push(p); });
    return out;
  }
  function circlePts(cx, cy, r, n) {
    var pts = [];
    for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    return pts;
  }

  /* The outline of a vehicle seen at a crossing angle (90 = side on, 0 = head on), as polygons in (u, h):
     u = metres from the rear edge of the picture along the direction of travel, h = height above ground.
     Hull, tracks and wheels are squeezed by sin(angle). The turret and gun sit on the hull centreline, so
     they move forward by half the width times cos(angle). The front you can see is the head-on outline
     squeezed by cos(angle) at the leading end. Drawing and hit tests both use this, so they always agree. */
  var shapeCache = {};
  function obliqueShape(key, angleDeg) {
    var id = key + ':' + angleDeg;
    if (shapeCache[id]) return shapeCache[id];
    var v = TARGETS[key], d = PROFILES[key], th = angleDeg * Math.PI / 180;
    var sn = Math.sin(th), cs = Math.abs(Math.cos(th));
    if (Math.abs(sn - 1) < 1e-9) { sn = 1; cs = 0; }
    var Ls = v.length * sn, Wf = v.width * cs, off = v.width / 2 * cs;
    var polys = [], wheels = [];
    var sq = function (pts) { return pts.map(function (p) { return [p[0] * sn, p[1]]; }); };
    if (d.track) polys.push(sq(d.track));
    polys.push(sq(d.hull));
    if (key === 'ural') { polys.push(sq(d.turret)); polys.push(sq(d.extra)); }
    else {
      if (d.extra) polys.push(sq(d.extra));
      var cx = d.turret.reduce(function (t, p) { return t + p[0]; }, 0) / d.turret.length, ts = Math.max(sn, 0.6);
      polys.push(d.turret.map(function (p) { return [cx * sn + off + (p[0] - cx) * ts, p[1]]; }));
      if (d.gun) { var g = d.gun; polys.push([[g[0] * sn + off, g[1]], [g[2] * sn + off, g[1]], [g[2] * sn + off, g[3]], [g[0] * sn + off, g[3]]]); }
    }
    d.wheels.xs.forEach(function (wx) { var c = sq(circlePts(wx, d.wheels.y, d.wheels.r, 16)); polys.push(c); wheels.push({ x: wx * sn, y: d.wheels.y, rx: d.wheels.r * sn, ry: d.wheels.r }); });
    // the front starts a hair inside the side so the two never leave a slit between them
    if (Wf > 0.02) frontPolys(key, key === 'ural').forEach(function (p) { polys.push(p.map(function (q) { return [Ls - 0.03 + q[0] / v.front * (Wf + 0.03), q[1]]; })); });
    var sh = { polys: polys, wheels: wheels, width: Ls + Wf, Ls: Ls, tracked: !!d.track };
    shapeCache[id] = sh;
    return sh;
  }

  function inPoly(pts, x, y) {
    var c = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c;
    }
    return c;
  }
  /* Is a point on the drawn side profile? x metres from the rear, h metres above the ground. */
  function inProfile(key, x, h) {
    return obliqueShape(key, 90).polys.some(function (p) { return inPoly(p, x, h); });
  }
  /* Hit test for a vehicle seen at a crossing angle (90 = side on).
     lateral: metres from the visible centre along the direction of travel; h: metres above the ground. */
  function hitsVehicle(key, angleDeg, lateral, h) {
    var sh = obliqueShape(key, angleDeg), u = sh.width / 2 + lateral;
    if (h < 0) return false;
    return sh.polys.some(function (p) { return inPoly(p, u, h); });
  }

  function rangeFromMils(sizeM, mils) { return mils > 0 ? sizeM * 1000 / mils : Infinity; }
  function milsFromRange(sizeM, rangeM) { return rangeM > 0 ? sizeM * 1000 / rangeM : Infinity; }
  function rangeFromFlash(seconds) { return seconds * 340; }

  // Pure vacuum drop below the bore line after flying R metres.
  function drop(rangeM, v) { var t = rangeM / v; return 0.5 * G * t * t; }
  function tof(rangeM, v) { return rangeM / v; }

  // Launch angle (radians) that zeroes the sight at sightRange.
  function zeroAngle(sightRange, v) {
    // exact: sin(2a) = g R / v^2 ; small angle branch
    var s = G * sightRange / (v * v);
    if (s >= 1) return Math.PI / 4;
    return 0.5 * Math.asin(s);
  }
  // Height of the round relative to line of sight at horizontal distance x.
  function heightAt(x, sightRange, v) {
    var a = zeroAngle(sightRange, v);
    var c = Math.cos(a);
    return x * Math.tan(a) - G * x * x / (2 * v * v * c * c);
  }
  // Small-angle miss for a sight set at Rs when the target is at R:
  // y = g R (Rs - R) / (2 v^2). Negative = low.
  function rangeErrorDrop(rangeM, sightRange, v) { return G * rangeM * (sightRange - rangeM) / (2 * v * v); }

  // Flat-fire (small angle) height relative to line of sight. Used on the drop page
  // so every number shown adds up exactly: y = g x (Rs - x) / (2 v^2).
  function flatHeight(x, sightRange, v) { return G * x * (sightRange - x) / (2 * v * v); }

  function leadMetres(vTargetKmh, angleDeg, rangeM, vProj) {
    var vt = vTargetKmh / 3.6;
    return vt * (rangeM / vProj) * Math.sin(angleDeg * Math.PI / 180);
  }

  /* Exact 2D intercept. Shooter at origin. Target at P0 moving with velocity V.
     Returns time t where |P0 + V t| = vp t (smallest positive) or null. */
  function interceptTime(p0x, p0y, vx, vy, vp) {
    var a = vx * vx + vy * vy - vp * vp;
    var b = 2 * (p0x * vx + p0y * vy);
    var c = p0x * p0x + p0y * p0y;
    if (Math.abs(a) < 1e-9) { return b < 0 ? -c / b : null; }
    var d = b * b - 4 * a * c;
    if (d < 0) return null;
    var s = Math.sqrt(d);
    var t1 = (-b - s) / (2 * a), t2 = (-b + s) / (2 * a);
    var ts = [t1, t2].filter(function (t) { return t > 0; }).sort(function (x, y) { return x - y; });
    return ts.length ? ts[0] : null;
  }

  var api = {
    G: G, TARGETS: TARGETS, WEAPONS: WEAPONS, PROFILES: PROFILES, inProfile: inProfile, hitsVehicle: hitsVehicle, obliqueShape: obliqueShape, frontPolys: frontPolys, inPoly: inPoly,
    rangeFromMils: rangeFromMils, milsFromRange: milsFromRange, rangeFromFlash: rangeFromFlash,
    drop: drop, tof: tof, zeroAngle: zeroAngle, heightAt: heightAt, rangeErrorDrop: rangeErrorDrop, flatHeight: flatHeight,
    leadMetres: leadMetres, interceptTime: interceptTime
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Phys = api;
})(this);
