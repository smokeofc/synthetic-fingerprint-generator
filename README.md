# Synthetic Fingerprint Generator

A fully client-side web app that procedurally generates plausible fingerprint images. No build step, no backend, no dependencies — just open `index.html`.

Intended for quickly producing fingerprint art for game assets, UI mockups, or any project that needs a convincing print without using real biometric data.

---

## Live Demo

https://smokeofc.github.io/synthetic-fingerprint-generator/

---

## WARNING:

This project is mostly generated using AI tools (Claude Opus 4.7 and GitHub Copilot). While I’ve done my best to verify the code and fix any issues, there may still be bugs, security vulnerabilities, or other problems. Use at your own risk, and please report any issues you find.

---

## Features

- **Six fingerprint patterns** — Left loop, right loop, whorl, double loop, arch, tented arch
- **Deterministic** — the same seed and settings always produce the same fingerprint
- **Configurable** — ridge spacing, thickness, jitter, gap/break amount, optional pores, ellipse shape, global tilt, ink colour
- **Transparent background** — both SVG and PNG outputs have no background fill
- **Vector + raster export** — download as SVG (infinitely scalable) or PNG (512 / 1024 / 2048 px, or a custom size)
- **Instant preview** with a checkerboard backdrop so transparency is obvious
- **No install** — static files only; works from disk in Chromium browsers

---

## Usage

### From disk (Chrome / Edge)
Double-click `index.html`. ES modules load fine from `file://` in Chromium.

### From disk (Firefox) or any browser
Firefox blocks ES module imports over `file://`. Serve the folder with any static server:

```bash
# Python (built-in)
python -m http.server 8080

# Node.js
npx serve .
```

Then open `http://localhost:8080`.

---

## Controls

| Control | Description |
|---|---|
| **Type** | Fingerprint pattern class |
| **Seed** | Integer seed for the PRNG. Same seed = same print |
| 🎲 / `R` key | Randomise seed |
| **Ridge spacing** | Gap between parallel ridges (px in SVG units) |
| **Ridge thickness** | Base stroke width |
| **Gap / break amount** | Probability of small ridge breaks (simulates natural endings/bifurcations) |
| **Thickness jitter** | Per-ridge stroke width variation |
| **Add pores** | Overlay small dots along ridges |
| **Width / Height** | Ellipse semi-axis scale (0–1 relative to work area) |
| **Tilt** | Rotate the entire orientation field |
| **Ink colour** | Stroke colour; background is always transparent |
| **PNG export size** | Raster output width (height scales to match SVG aspect ratio) |

---

## Algorithm

The generator uses a **Sherlock–Monro orientation field** — a model from fingerprint biometrics literature — built from complex-number singularities:

$$\theta(z) = \frac{1}{2} \left( \sum_k \arg(z - c_k) - \sum_k \arg(z - d_k) \right) + \phi$$

where $c_k$ are *core* points (zeros) and $d_k$ are *delta* points (poles). Choosing their number and positions produces the distinct topological fingerprint classes.

Ridges are then traced as **evenly-spaced streamlines** (Jobard & Lefer 1997 method):
1. An occupancy grid tracks existing ridge points.
2. Starting from an initial seed, integration proceeds bidirectionally with RK2, stopping when the next step would be too close to an already-placed ridge.
3. New seeds are proposed perpendicular to each placed ridge, then accepted or rejected by the same proximity test.
4. Random early termination per step produces natural-looking ridge endings and bifurcations.
5. An **elliptical mask** with soft alpha falloff clips ridges at the fingertip boundary.

All randomness goes through a **mulberry32** seedable PRNG so results are fully reproducible.

SVG is the source of truth. PNG export rasterises the SVG through an HTML5 Canvas with `clearRect` to preserve the transparent alpha channel.

---

## File Structure

```
index.html          Main page (controls + preview)
styles.css          Layout and theming
js/
  rng.js            Seedable PRNG (mulberry32) + helpers
  orientation.js    Sherlock-Monro orientation field
  patterns.js       Per-class singularity presets
  mask.js           Elliptical fingertip mask
  tracer.js         Evenly-spaced streamline ridge tracer
  render.js         SVG builder + PNG rasteriser
  download.js       Blob / text download helper
  main.js           UI wiring, event handling
```

---

## Limitations

- Not intended for biometric use — outputs are stylised approximations, not real scans.
- Very dense settings (small spacing, large ellipse) can take 200–600 ms to generate.
- Firefox from `file://` requires a local server (see above).
