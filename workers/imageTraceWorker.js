"use strict";

/*
process an uploaded png or jpg image into a vector image
to display the image on your noad canvas
*/

const potrace = require("potrace");
const sharp = require("sharp");

const MAX_COLOR_DIM = 700;
const KMEANS_ITERATIONS = 8;
const KMEANS_SAMPLE_SIZE = 20000;
const MIN_LAYER_FRACTION = 0.002; // drop color layers covering less than 0.2% of pixels

function normalizeSvg(svg) {
  const match = svg.match(/<svg[^>]*\swidth="(\d+(?:\.\d+)?)"[^>]*\sheight="(\d+(?:\.\d+)?)"/);
  const naturalWidth = match ? parseFloat(match[1]) : 0;
  const naturalHeight = match ? parseFloat(match[2]) : 0;
  const normalized = svg.replace(
    /(<svg[^>]*?)\swidth="\d+(?:\.\d+)?"([^>]*?)\sheight="\d+(?:\.\d+)?"/,
    '$1 width="100%"$2 height="100%"'
  );
  return { svg: normalized, naturalWidth, naturalHeight };
}

function fail(err) {
  process.send({ ok: false, error: (err && err.message) || String(err) || "Could not read this image file" });
  process.exit(0);
}

function traceAsync(input, options) {
  return new Promise((resolve, reject) => {
    potrace.trace(input, options, (err, svg) => {
      if (err) reject(err);
      else resolve(svg);
    });
  });
}

function sqDist(a, b) {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

function kmeansPlusPlusInit(samples, k) {
  const n = samples.length;
  const centroids = [samples[Math.floor(Math.random() * n)]];
  const distSq = new Float64Array(n).fill(Infinity);
  for (let c = 1; c < k; c++) {
    let sum = 0;
    const last = centroids[centroids.length - 1];
    for (let i = 0; i < n; i++) {
      const d = sqDist(samples[i], last);
      if (d < distSq[i]) distSq[i] = d;
      sum += distSq[i];
    }
    let r = Math.random() * sum;
    let idx = n - 1;
    for (let i = 0; i < n; i++) {
      r -= distSq[i];
      if (r <= 0) { idx = i; break; }
    }
    centroids.push(samples[idx]);
  }
  return centroids;
}

function kmeansFit(samples, k, iterations) {
  let centroids = kmeansPlusPlusInit(samples, k);
  const n = samples.length;
  const assignments = new Int32Array(n);
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < n; i++) {
      let best = 0, bestD = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const d = sqDist(samples[i], centroids[c]);
        if (d < bestD) { bestD = d; best = c; }
      }
      assignments[i] = best;
    }
    const sums = centroids.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < n; i++) {
      const s = sums[assignments[i]];
      const p = samples[i];
      s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++;
    }
    centroids = centroids.map((c, idx) => {
      const s = sums[idx];
      return s[3] > 0 ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : c;
    });
  }
  return centroids;
}

function rgbToHex(r, g, b) {
  const toH = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${toH(r)}${toH(g)}${toH(b)}`;
}

async function traceColor(input, options) {
  const bgFill = options.background && options.background !== "transparent" ? options.background : null;

  let img = sharp(input).resize({
    width: MAX_COLOR_DIM, height: MAX_COLOR_DIM,
    fit: "inside", withoutEnlargement: true,
  });
  // Flatten transparency onto white before quantizing, so transparent regions
  // don't get treated as a stray "color" during clustering.
  img = img.flatten({ background: { r: 255, g: 255, b: 255 } });

  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const pixelCount = width * height;

  const pixels = new Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    const o = i * channels;
    pixels[i] = [data[o], data[o + 1], data[o + 2]];
  }

  const sampleStep = Math.max(1, Math.floor(pixelCount / KMEANS_SAMPLE_SIZE));
  const samples = [];
  for (let i = 0; i < pixelCount; i += sampleStep) samples.push(pixels[i]);

  const k = Math.max(2, Math.min(12, options.colors || 6));
  const centroids = kmeansFit(samples, k, KMEANS_ITERATIONS);

  // Final assignment of every pixel to its nearest centroid.
  const labels = new Int32Array(pixelCount);
  const counts = new Array(centroids.length).fill(0);
  for (let i = 0; i < pixelCount; i++) {
    let best = 0, bestD = Infinity;
    for (let c = 0; c < centroids.length; c++) {
      const d = sqDist(pixels[i], centroids[c]);
      if (d < bestD) { bestD = d; best = c; }
    }
    labels[i] = best;
    counts[best]++;
  }

  const layers = [];
  for (let c = 0; c < centroids.length; c++) {
    if (counts[c] / pixelCount < MIN_LAYER_FRACTION) continue;
    const mask = Buffer.alloc(pixelCount);
    for (let i = 0; i < pixelCount; i++) mask[i] = labels[i] === c ? 255 : 0;
    const maskPng = await sharp(mask, { raw: { width, height, channels: 1 } }).png().toBuffer();
    const [r, g, b] = centroids[c];
    const svg = await traceAsync(maskPng, {
      threshold: 128,
      // Mask pixels are 255 where this color applies, 0 elsewhere — blackOnWhite:false tells
      // potrace to trace the WHITE (foreground) region, not the black background around it.
      blackOnWhite: false,
      color: rgbToHex(r, g, b),
      background: "transparent",
      turdSize: options.turdSize,
      alphaMax: options.alphaMax,
      optCurve: true,
    });
    const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
    layers.push({ count: counts[c], inner });
  }

  // Largest color region drawn first (acts as the backdrop), smaller detail
  // regions drawn on top — mirrors how potrace's own posterize layers colors.
  layers.sort((a, b) => b.count - a.count);

  const bgRect = bgFill ? `<rect x="0" y="0" width="${width}" height="${height}" fill="${bgFill}" />` : "";
  const combined = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" version="1.1">${bgRect}${layers.map(l => l.inner).join("")}</svg>`;
  return combined;
}

// Potrace has no concept of alpha — it reads RGB and ignores transparency, so a
// transparent PNG would otherwise get its "empty" areas traced as whatever RGB
// happened to be stored under them (often solid black). To keep those areas
// genuinely transparent in the output vector, trace the source's own alpha
// channel into its own vector shape and clip the whole result to it, so no
// mode (bw/gray/color), and no explicit background fill, can paint over what
// was transparent in the original image.
async function applyAlphaClip(input, svg, options) {
  let meta;
  try {
    meta = await sharp(input).metadata();
  } catch {
    return svg;
  }
  if (!meta.hasAlpha) return svg;

  // White = opaque, black = fully transparent — same mask convention used for
  // the per-color layers in traceColor().
  const alphaMask = await sharp(input).extractChannel("alpha").png().toBuffer();

  let alphaSvg;
  try {
    alphaSvg = await traceAsync(alphaMask, {
      threshold: 128,
      blackOnWhite: false, // trace the WHITE (opaque) region, not the black (transparent) one
      turdSize: options.turdSize,
      alphaMax: options.alphaMax,
      optCurve: true,
    });
  } catch {
    return svg; // if the alpha shape can't be traced, fall back to the un-clipped result
  }

  const pathDs = [...alphaSvg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map(m => m[1]);
  if (pathDs.length === 0) return svg; // e.g. a fully opaque or fully transparent source — nothing to clip

  const headerMatch = svg.match(/^[\s\S]*?<svg[^>]*>/);
  if (!headerMatch) return svg;
  const header = headerMatch[0];
  const inner = svg.slice(header.length).replace(/<\/svg>\s*$/, "");
  // clip-rule must match potrace's own evenodd fill-rule, or holes traced in the
  // alpha shape (e.g. a ring-shaped sticker) would get filled back in as opaque.
  const clipPaths = pathDs.map(d => `<path d="${d}" clip-rule="evenodd" />`).join("");
  return `${header}<defs><clipPath id="alpha-clip">${clipPaths}</clipPath></defs><g clip-path="url(#alpha-clip)">${inner}</g></svg>`;
}

process.on("uncaughtException", fail);

process.on("message", ({ buffer, mode, options }) => {
  const input = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  (async () => {
    try {
      let svg;
      if (mode === "color") {
        svg = await traceColor(input, options);
      } else if (mode === "gray") {
        svg = await new Promise((resolve, reject) => {
          potrace.posterize(input, options, (err, s) => err ? reject(err) : resolve(s));
        });
      } else {
        svg = await traceAsync(input, options);
      }
      svg = await applyAlphaClip(input, svg, options);
      const { svg: normalized, naturalWidth, naturalHeight } = normalizeSvg(svg);
      process.send({ ok: true, svg: normalized, naturalWidth, naturalHeight });
      process.exit(0);
    } catch (err) {
      fail(err);
    }
  })();
});
