import { makeRng } from "./rng.js";
import { buildPattern } from "./patterns.js";
import { EllipseMask } from "./mask.js";
import { traceRidges } from "./tracer.js";
import { ridgesToSvg, injectSvg, svgToPngBlob } from "./render.js";
import { downloadBlob, downloadText } from "./download.js";

const WORK = 500; // internal SVG units (square work area)

const $ = (id) => document.getElementById(id);

const els = {
  preset: $("preset"),
  seed: $("seed"),
  randomize: $("randomize"),
  spacing: $("spacing"),
  thickness: $("thickness"),
  gaps: $("gaps"),
  jitter: $("jitter"),
  pores: $("pores"),
  ellipseW: $("ellipseW"),
  ellipseH: $("ellipseH"),
  tilt: $("tilt"),
  color: $("color"),
  pngSize: $("pngSize"),
  pngCustom: $("pngCustom"),
  pngCustomWrap: $("pngCustomWrap"),
  regen: $("regen"),
  dlSvg: $("dlSvg"),
  dlPng: $("dlPng"),
  preview: $("preview"),
  status: $("status"),
  spacingOut: $("spacingOut"),
  thicknessOut: $("thicknessOut"),
  gapsOut: $("gapsOut"),
  jitterOut: $("jitterOut"),
  widthOut: $("widthOut"),
  heightOut: $("heightOut"),
  tiltOut: $("tiltOut"),
};

let lastSvg = "";
let regenTimer = null;

function readControls() {
  return {
    preset: els.preset.value,
    seed: parseInt(els.seed.value, 10) || 0,
    spacing: parseFloat(els.spacing.value),
    thickness: parseFloat(els.thickness.value),
    gaps: parseFloat(els.gaps.value),
    jitter: parseFloat(els.jitter.value),
    pores: els.pores.checked,
    ellipseW: parseFloat(els.ellipseW.value),
    ellipseH: parseFloat(els.ellipseH.value),
    tilt: parseFloat(els.tilt.value),
    color: els.color.value,
    pngSize: els.pngSize.value === "custom"
      ? Math.max(64, Math.min(8192, parseInt(els.pngCustom.value, 10) || 1024))
      : parseInt(els.pngSize.value, 10),
  };
}

function syncOutputs(c) {
  els.spacingOut.value = c.spacing.toFixed(1);
  els.thicknessOut.value = c.thickness.toFixed(2);
  els.gapsOut.value = c.gaps.toFixed(2);
  els.jitterOut.value = c.jitter.toFixed(2);
  els.widthOut.value = c.ellipseW.toFixed(2);
  els.heightOut.value = c.ellipseH.toFixed(2);
  els.tiltOut.value = c.tilt.toFixed(0);
  els.pngCustomWrap.hidden = els.pngSize.value !== "custom";
}

function generate() {
  const c = readControls();
  syncOutputs(c);

  const t0 = performance.now();
  els.status.textContent = "Generating…";

  // Defer to next frame so the status text can render.
  requestAnimationFrame(() => {
    try {
      const rng = makeRng(c.seed);
      const cx = WORK / 2;
      const cy = WORK / 2;
      const rx = (WORK / 2) * c.ellipseW;
      const ry = (WORK / 2) * c.ellipseH;
      const radius = Math.min(rx, ry);
      const tiltRad = (c.tilt * Math.PI) / 180;

      const field = buildPattern(c.preset, { cx, cy, radius, rng, tiltRad });
      const mask = new EllipseMask(cx, cy, rx, ry);

      const ridges = traceRidges(field, mask, {
        spacing: c.spacing,
        rng,
        width: WORK,
        height: WORK,
      });

      // Trim each polyline to mask just in case (tracer already stops at edge).
      const trimmed = [];
      for (const r of ridges) {
        for (const seg of mask.trimPolyline(r)) trimmed.push(seg);
      }

      const svg = ridgesToSvg(trimmed, {
        width: WORK,
        height: WORK,
        color: c.color,
        thickness: c.thickness,
        jitter: c.jitter,
        gaps: c.gaps,
        mask,
        rng,
        pores: c.pores,
      });

      lastSvg = svg;
      injectSvg(els.preview, svg);

      const dt = (performance.now() - t0).toFixed(0);
      els.status.textContent = `${trimmed.length} ridges • ${dt} ms • seed ${c.seed} • ${c.preset}`;
    } catch (err) {
      console.error(err);
      els.status.textContent = "Error: " + err.message;
    }
  });
}

function scheduleRegen() {
  if (regenTimer) clearTimeout(regenTimer);
  regenTimer = setTimeout(generate, 120);
}

function randomizeSeed() {
  els.seed.value = Math.floor(Math.random() * 2_000_000_000);
  generate();
}

// ---- Event wiring ----

const liveInputs = [
  "preset", "seed", "spacing", "thickness", "gaps", "jitter", "pores",
  "ellipseW", "ellipseH", "tilt", "color", "pngSize", "pngCustom",
];
for (const id of liveInputs) {
  const el = els[id];
  if (!el) continue;
  const ev = el.type === "range" || el.type === "color" ? "input" : "change";
  el.addEventListener(ev, scheduleRegen);
}

els.regen.addEventListener("click", generate);
els.randomize.addEventListener("click", randomizeSeed);

els.dlSvg.addEventListener("click", () => {
  if (!lastSvg) generate();
  const c = readControls();
  downloadText(lastSvg, `fingerprint_${c.preset}_${c.seed}.svg`, "image/svg+xml");
});

els.dlPng.addEventListener("click", async () => {
  if (!lastSvg) generate();
  const c = readControls();
  els.status.textContent = `Rasterizing PNG @ ${c.pngSize}px…`;
  try {
    const blob = await svgToPngBlob(lastSvg, c.pngSize);
    downloadBlob(blob, `fingerprint_${c.preset}_${c.seed}_${c.pngSize}.png`);
    els.status.textContent = `PNG saved (${c.pngSize}px).`;
  } catch (err) {
    console.error(err);
    els.status.textContent = "PNG export failed: " + err.message;
  }
});

window.addEventListener("keydown", (e) => {
  if (e.target && /input|select|textarea/i.test(e.target.tagName)) return;
  if (e.key === "r" || e.key === "R") randomizeSeed();
});

// First render.
generate();
