# Joakim's Med Ed Tank Simulator

Three interactive exercises that go with my med ed session on Russian and Soviet armour recognition:

| Folder | What it teaches |
| --- | --- |
| `mil-scale/` | Estimating range by reading a known vehicle size against a binocular mil scale. Explore mode and a scored practise mode. |
| `projectile-drop/` | What a wrong sight setting does to a slow rocket (older M72, newer M72, APILAS, rifle for comparison). Animated flight, hit or miss, full working. |
| `lead/` | Aiming ahead of a moving vehicle. Map, close-up and sight picture, animated intercept, formula lead against exact lead. |

| `exam/` | Five timed levels. Work the numbers out on paper, fire, and get scored on accuracy (600), speed (300) and a hit (100) per level. An exam code gives the whole room the same numbers. |

The landing page (`index.html`) links them in order: range, drop, lead, then the exam.

Plain HTML, CSS and JavaScript. No build step, no frameworks, no external requests (fonts are bundled), so it works offline and on GitHub Pages.

## Put it on GitHub Pages

1. Create a new repository on GitHub, for example `ballistics-sim`.
2. Upload the contents of this folder (not the folder itself) so `index.html` sits at the top of the repository. On github.com: **Add file**, **Upload files**, drag everything in, **Commit changes**.
3. Go to **Settings**, **Pages**. Under **Build and deployment** choose **Deploy from a branch**, branch `main`, folder `/ (root)`, then **Save**.
4. After a minute the site is live at `https://<your-user-name>.github.io/ballistics-sim/`.

Or from a terminal:

```bash
cd ballistics-sim
git init && git add . && git commit -m "Range, drop and lead simulators"
git branch -M main
git remote add origin https://github.com/<your-user-name>/ballistics-sim.git
git push -u origin main
```

## Run it locally

Double-click `index.html` and it opens in your browser. Nothing to install. If you prefer a local server:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## The models

All three use simple, stated models so the numbers on screen add up by hand.

- **Range:** `Range = size x 1000 / mils`. Sizes are hull dimensions from open sources: T-72 6.9 m long, 3.6 m wide, 2.2 m high; BMP-2 6.7 x 3.2 x 2.45 m; BTR-82A 7.6 x 2.9 x 2.8 m; Ural-4320 7.4 x 2.5 x 2.9 m; soldier 1.8 m.
- **Drop:** no drag, flat fire. Time of flight `t = R / v`, drop below the tube line `1/2 g t^2`. A sight set to range `Rs` lifts the tube by `drop(Rs) x R / Rs` at range `R`, so the miss is `g R (Rs - R) / 2v^2`. The page also gives the window of sight settings that still hit.
- **Lead:** `lead = v x t x sin(theta)`, with `v` in m/s (`km/h / 3.6`) and `t = R / v_round`. The animation solves the true intercept of a straight-driving vehicle and a straight-flying round and checks the hull footprint, so the formula is tested against the real geometry.

Projectile speeds: older M72 about 145 m/s, newer M72 about 200 m/s, APILAS about 293 m/s, 7.62 mm rifle about 715 m/s.

### A note on the deck's range-error example

A sight set at 150 m on a target at 180 m (200 m/s rocket) gives a miss of about **0.66 m low**, not the 1.2 m you get by subtracting the two raw drops (4.0 m minus 2.8 m). The sight's angle already scales with distance, which cancels part of the extra drop. Likewise, an older M72 set for 200 m on a target at 250 m lands about 2.9 m low, which is still a miss into the ground in front of a 2.2 m high tank. The simulator uses the corrected figure.

## Tests

`tests/physics.test.js` checks the physics against hand-worked numbers (`node tests/physics.test.js`). `tests/shoot.js` and `tests/interact.js` drive the pages in Playwright for screenshots, console errors, keyboard use, reduced motion and hit or miss sweeps. They are not needed on GitHub Pages and can be deleted.

## Licence notes

Barlow and Barlow Condensed by Jeremy Tribby, SIL Open Font Licence 1.1 (`assets/fonts/OFL-Barlow.txt`). All drawings are generated in code. Training aid only, not for operational use.
