/* Exam logic with no DOM: scenarios from a code, answer parsing, marking and scoring.
   Runs in the browser (window.ExamCore) and in Node (module.exports) for tests. */
(function (root) {
  'use strict';
  var P = (typeof module !== 'undefined' && module.exports) ? require('./physics.js') : root.Phys;
  var G = P.G, T = P.TARGETS;

  var ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1
  function makeCode(rand) {
    rand = rand || Math.random;
    var s = '';
    for (var i = 0; i < 4; i++) s += ALPHABET[Math.floor(rand() * ALPHABET.length)];
    return s;
  }
  function normaliseCode(s) {
    return String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  }
  function seeded(code) {
    var h = 2166136261 >>> 0, c = normaliseCode(code) || 'X';
    for (var i = 0; i < c.length; i++) { h ^= c.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    var s = h || 1;
    return function () { // mulberry32
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length) % arr.length]; }
  function step(r, lo, hi, st) { return lo + Math.floor(r() * ((hi - lo) / st + 1)) * st; }

  /* Parse a typed number. Accepts "1,5", " 12 ", "+3", "3.", ".5", "12 m". */
  function parseNum(str) {
    var s = String(str == null ? '' : str).trim().toLowerCase();
    // other scripts' digits and minus signs to plain ASCII
    s = s.replace(/[\u0660-\u0669]/g, function (c) { return String(c.charCodeAt(0) - 0x0660); })
      .replace(/[\u06F0-\u06F9]/g, function (c) { return String(c.charCodeAt(0) - 0x06F0); })
      .replace(/[\uFF10-\uFF19]/g, function (c) { return String(c.charCodeAt(0) - 0xFF10); })
      .replace(/[\u2212\u2012\u2013\uFE63\uFF0D]/g, '-').replace(/[\uFF0C]/g, ',').replace(/[\uFF0E]/g, '.');
    s = s.replace(/\s+/g, '');
    var unit = null, um = s.match(/(m\/s|km\/h|kmh|mils?|metres?|meters?|m)$/);
    if (um) { unit = /^mil/.test(um[1]) ? 'mils' : /km/.test(um[1]) ? 'km/h' : um[1] === 'm/s' ? 'm/s' : 'm'; s = s.slice(0, -um[1].length); }
    var thousands = /^\d{1,3}[,.]\d{3}$/.test(s);
    s = s.replace(',', '.');
    if (s === '') return { ok: false, msg: 'Type a number.' };
    if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return { ok: false, msg: 'Use digits only, for example 3.5' };
    var v = parseFloat(s);
    if (!isFinite(v)) return { ok: false, msg: 'That number is too big.' };
    if (Math.abs(v) > 100000) return { ok: false, msg: 'That number is too big.' };
    return { ok: true, value: v, unit: unit, thousands: thousands };
  }

  function band(relErr, full, zero) {
    if (!isFinite(relErr)) return 0;
    if (relErr <= full) return 1;
    if (relErr >= zero) return 0;
    return 1 - (relErr - full) / (zero - full);
  }
  function speedFraction(sec, par) {
    if (sec <= par) return 1;
    if (sec >= par * 4) return 0;
    return 1 - (sec - par) / (par * 3);
  }

  function leadFormula(kmh, angle, R, v) { return P.leadMetres(kmh, angle, R, v); }
  function exactLead(kmh, angle, R, v) {
    var th = angle * Math.PI / 180, vt = kmh / 3.6;
    var t = P.interceptTime(0, R, vt * Math.sin(th), -vt * Math.cos(th), v);
    if (t == null) return NaN;
    var ix = vt * Math.sin(th) * t, iy = R - vt * Math.cos(th) * t;
    return ix * R / iy;
  }
  function apparentWidth(key, angle) {
    var v = T[key], th = angle * Math.PI / 180;
    return v.length * Math.sin(th) + v.width * Math.abs(Math.cos(th));
  }
  function holdOver(R, Rs, v) { return G * R * (R - Rs) / (2 * v * v); }

  var LEVELS = [
    { id: 1, name: 'Range card', par: 60, answers: ['range'] },
    { id: 2, name: 'Hold over', par: 120, answers: ['hold'] },
    { id: 3, name: 'Crossing target', par: 75, answers: ['lead'] },
    { id: 4, name: 'Two steps', par: 150, answers: ['range', 'lead'] },
    { id: 5, name: 'Full engagement', par: 180, answers: ['range', 'lead'] }
  ];

  /* Build the five scenarios for a code. Everything a level needs is in here. */
  function scenarios(code) {
    var r = seeded(code), out = [];
    // 1: stationary, side on, read the length
    var k1 = pick(r, ['bmp2', 't72', 'btr82', 'ural']);
    out.push({ level: 1, key: k1, aspect: 'side', angle: 90, kmh: 0, dir: 1,
      R: step(r, 150, 330, 1), weapon: 'apilas', v: P.WEAPONS.apilas.v, measure: 'length',
      az: -6 - r() * 12 });
    // 2: stationary T-72, sight stuck on a lower mark, older M72
    var rs, R2, tries = 0;
    do { rs = pick(r, [100, 110, 120, 130, 140, 150]); R2 = rs + step(r, 35, Math.min(60, 200 - rs), 5); }
    while (holdOver(R2, rs, P.WEAPONS.m72old.v) < 1.3 && tries++ < 30);   // ignoring the stuck sight must miss
    out.push({ level: 2, key: 't72', aspect: 'side', angle: 90, kmh: 0, dir: 1,
      R: R2, Rs: rs, weapon: 'm72old', v: P.WEAPONS.m72old.v, az: -4 });
    // 3: crossing target, all numbers given
    var a3 = pick(r, [90, 90, 60]);
    out.push({ level: 3, key: pick(r, ['btr82', 'bmp2']), aspect: a3 === 90 ? 'side' : 'oblique', angle: a3,
      kmh: step(r, 20, 50, 5), dir: r() < 0.5 ? 1 : -1, R: step(r, 100, 200, 5), weapon: 'm72', v: P.WEAPONS.m72.v, az: -4 });
    // 4: read the range, then lead a full crossing BMP-2
    out.push({ level: 4, key: 'bmp2', aspect: 'side', angle: 90, kmh: step(r, 15, 40, 5), dir: r() < 0.5 ? 1 : -1,
      R: step(r, 150, 300, 1), weapon: 'apilas', v: P.WEAPONS.apilas.v, measure: 'length', az: -8 - r() * 10 });
    // 5: T-72 at an angle, read the height, slow rocket
    var a5 = pick(r, [45, 60]);
    out.push({ level: 5, key: 't72', aspect: 'oblique', angle: a5, kmh: step(r, 15, 35, 5), dir: r() < 0.5 ? 1 : -1,
      R: step(r, 120, 200, 1), weapon: 'm72old', v: P.WEAPONS.m72old.v, measure: 'height', az: -6 - r() * 10 });
    out.forEach(function (s) {
      // a lead smaller than half the vehicle teaches nothing: speed it up until it matters
      var guard = 0;
      while (s.kmh > 0 && leadFormula(s.kmh, s.angle, s.R, s.v) < apparentWidth(s.key, s.angle) / 2 + 1 && guard++ < 20) s.kmh += 5;
      s.squeeze = s.aspect === 'oblique' ? apparentWidth(s.key, s.angle) / T[s.key].length : 1;
      s.flip = s.dir < 0;
    });
    return out;
  }

  /* Model answers for a scenario (what a careful person gets on paper). */
  function model(s) {
    var m = {};
    m.range = s.R;
    if (s.level === 2) m.hold = holdOver(s.R, s.Rs, s.v);
    if (s.kmh > 0) m.lead = leadFormula(s.kmh, s.angle, s.R, s.v);
    return m;
  }

  /* What happens when you fire with these answers. Distances are measured from the middle of the
     vehicle, which is where you aim. The hit test uses the drawn outline, not a box. */
  function shot(s, a) {
    var H = T[s.key].height, half = H / 2;
    var sight = s.level === 2 ? s.Rs : s.level === 3 ? s.R : a.range;
    var hold = s.level === 2 ? a.hold : 0;
    var vertical = P.flatHeight(s.R, sight, s.v) + hold;      // m above the middle where the round passes
    var exact = s.kmh > 0 ? exactLead(s.kmh, s.angle, s.R, s.v) : 0;
    var lead = s.kmh > 0 ? a.lead : 0;
    var lateral = lead - exact;                                 // m ahead (+) or behind (-) of the middle
    var halfW = apparentWidth(s.key, s.angle) / 2;
    var hit = P.hitsVehicle(s.key, s.angle, lateral, half + vertical);
    var why;
    var part = Math.abs(lateral) < halfW / 3 ? 'middle' : lateral > 0 ? 'front' : 'rear';
    var vert = vertical > half * 0.45 ? 'high' : vertical < -half * 0.45 ? 'low' : '';
    if (hit) why = vert ? 'Hit ' + vert + (part === 'middle' ? ' in the middle' : ' at the ' + part) : 'Hit the ' + part + ' of the vehicle';
    else if (vertical < -half) why = 'Landed short, ' + fmtM(-vertical) + ' below the middle';
    else if (vertical > half) why = 'Went over, ' + fmtM(vertical) + ' above the middle';
    else if (Math.abs(lateral) > halfW) why = 'Passed ' + fmtM(Math.abs(lateral)) + (lateral < 0 ? ' behind' : ' in front of') + ' the middle';
    else why = vertical < 0 ? 'Slipped under the hull' : 'Skimmed over the hull';
    return { hit: hit, vertical: vertical, lateral: lateral, exact: exact, sight: sight, why: why, tof: s.R / s.v };
  }
  function fmtM(x) { return (Math.round(x * 10) / 10).toFixed(1) + ' m'; }

  /* Marks. a = parsed answers. Range: vs true range. Lead: vs formula using YOUR range (method marks). */
  function mark(s, a) {
    var parts = [];
    var m = model(s);
    if (s.level === 1 || s.level >= 4) {
      var er = Math.abs(a.range - s.R) / s.R;
      parts.push({ key: 'range', label: 'Range', yours: a.range, model: s.R, unit: 'm', rel: er, frac: band(er, 0.05, 0.15) });
    }
    if (s.level === 2) {
      var eh = Math.abs(a.hold - m.hold) / m.hold;
      var fh = Math.abs(a.hold - m.hold) <= 0.15 ? 1 : band(eh, 0.10, 0.35);
      parts.push({ key: 'hold', label: 'Hold over', yours: a.hold, model: m.hold, unit: 'm', rel: eh, frac: fh });
    }
    if (s.kmh > 0) {
      var basis = s.level >= 4 ? Math.max(1, a.range) : s.R;
      var want = leadFormula(s.kmh, s.angle, basis, s.v);
      var el = Math.abs(a.lead - want) / want;
      parts.push({ key: 'lead', label: 'Lead', yours: a.lead, model: want, unit: 'm', rel: el, frac: band(el, 0.10, 0.30), basis: basis });
    }
    // partial credit falls away quickly (squared), so near misses still score but guesses do not
    var acc = parts.reduce(function (t, p) { return t + p.frac * p.frac; }, 0) / parts.length;
    return { parts: parts, acc: acc };
  }

  function score(s, a, seconds) {
    var mk = mark(s, a), sh = shot(s, a), lv = LEVELS[s.level - 1];
    var accPts = Math.round(600 * mk.acc);
    var spdFrac = speedFraction(seconds, lv.par);
    var spdPts = Math.round(300 * spdFrac * mk.acc * mk.acc);   // fast guessing earns next to nothing
    var hitPts = sh.hit && mk.acc >= 0.5 ? 100 : 0;              // a lucky hit with a wrong answer earns nothing
    return { marks: mk, shot: sh, accuracy: accPts, speed: spdPts, speedFrac: spdFrac, hitPts: hitPts, total: accPts + spdPts + hitPts, seconds: seconds, par: lv.par };
  }

  /* Name the classic slips from the answer alone. Returns short sentences, most likely first. */
  function diagnose(s, a) {
    var out = [], m = model(s), tg = T[s.key];
    // only talk about parts that actually lost marks, using the same rules as the marking
    var lost = {}; mark(s, a).parts.forEach(function (p) { lost[p.key] = p.frac < 0.999; });
    function near(x, want, tol) { return isFinite(x) && want > 0 && Math.abs(x / want - 1) <= (tol || 0.06); }
    if (lost.range && isFinite(a.range)) {
      var ratio = a.range / s.R;
      var gun = P.PROFILES[s.key] && P.PROFILES[s.key].gun ? P.PROFILES[s.key].gun[2] : 0;
      if (s.measure === 'length' && gun > tg.length + 0.5 && near(ratio, tg.length / gun)) out.push('It looks as if you measured the gun as well. Use the hull only.');
      else if (s.measure === 'length' && near(ratio, tg.length / tg.height, 0.08)) out.push('It looks as if you read the height in mils but used the length in metres.');
      else if (s.measure === 'height' && near(ratio, tg.height / apparentWidth(s.key, s.angle), 0.08)) out.push('It looks as if you measured its width on screen. At an angle that is not its length, so use the height.');
      else if (s.measure === 'height' && near(ratio, tg.length / tg.height, 0.08)) out.push('It looks as if you used its length in metres with a height in mils.');
      else if (near(ratio, 10, 0.1) || near(ratio, 0.1, 0.1)) out.push('Out by a factor of ten. Check the \u00D7 1000.');
      else out.push(ratio > 1 ? 'Your range is too long: you probably read too few mils.' : 'Your range is too short: you probably read too many mils.');
    }
    if (lost.hold && isFinite(a.hold)) {
      var dR = 0.5 * G * Math.pow(s.R / s.v, 2);
      if (near(a.hold, 2 * m.hold)) out.push('About double the answer. Check the 2 in 2 \u00D7 v\u00B2.');
      else if (near(a.hold, m.hold / 2)) out.push('About half the answer. You may have divided by 2 twice.');
      else if (near(a.hold, dR)) out.push('That is the whole drop at the target. The sight already makes up for part of it, so subtract that.');
      else if (near(-a.hold, m.hold)) out.push('Right size, wrong sign. Aim above the tank, not below.');
      else out.push(a.hold > m.hold ? 'Too high. Recheck the drop at the sight mark.' : 'Too low. Recheck the drop at the target.');
    }
    if (lost.lead && isFinite(a.lead)) {
      var basis = s.level >= 4 && isFinite(a.range) ? Math.max(1, a.range) : s.R;
      var want = leadFormula(s.kmh, s.angle, basis, s.v), th = s.angle * Math.PI / 180;
      {
        if (near(a.lead, want * 3.6)) out.push('About 3.6 times too much. Convert km/h to m/s first (divide by 3.6).');
        else if (near(a.lead, want / 3.6)) out.push('About 3.6 times too little. You may have divided by 3.6 twice.');
        else if (s.angle !== 90 && near(a.lead, want / Math.sin(th))) out.push('You left out sin(angle). Only the sideways part of its speed needs a lead.');
        else if (s.angle !== 90 && near(a.lead, want * Math.cos(th) / Math.sin(th))) out.push('That matches cos instead of sin. Use sin of the crossing angle.');
        else if (near(-a.lead, want)) out.push('Right size, wrong way. Aim ahead of it, in the direction it is driving.');
        else out.push(a.lead > want ? 'Too far ahead. Recheck the time of flight.' : 'Not far enough ahead. Recheck the time of flight.');
      }
    }
    return out;
  }

  var GRADES = [
    { min: 4500, name: 'Consultant', note: 'Fast and accurate. You could teach this.' },
    { min: 3800, name: 'Registrar', note: 'Solid. A little more speed and you are there.' },
    { min: 3000, name: 'FY2', note: 'Good method. Check the arithmetic under time pressure.' },
    { min: 2000, name: 'FY1', note: 'The idea is there. Have another go at the training pages.' },
    { min: 0, name: 'Fresher', note: 'Start with exercise 1 and work through again.' }
  ];
  function grade(total) { for (var i = 0; i < GRADES.length; i++) if (total >= GRADES[i].min) return GRADES[i]; return GRADES[GRADES.length - 1]; }

  var BANDS = { range: [0.05, 0.15], hold: [0.10, 0.35], lead: [0.10, 0.30] };
  var api = { LEVELS: LEVELS, GRADES: GRADES, BANDS: BANDS, diagnose: diagnose, makeCode: makeCode, normaliseCode: normaliseCode, seeded: seeded, parseNum: parseNum,
    band: band, speedFraction: speedFraction, scenarios: scenarios, model: model, shot: shot, mark: mark, score: score, grade: grade,
    exactLead: exactLead, apparentWidth: apparentWidth, holdOver: holdOver, leadFormula: leadFormula };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ExamCore = api;
})(this);
