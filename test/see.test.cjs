"use strict";
// test/see.test.cjs — falsification for the "see anything" pass: the general
// optical read, 2D layer extraction, 3D depth, 4D trails/motion-blur, and the
// pheromone-swarm. Synthetic inputs only, so the numbers are exact and the
// claims are checkable.
const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../alhazen.js");

// ── image builders ───────────────────────────────────────────────────────────
function blank(w, h, r, g, b) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255; }
  return d;
}
function rect(d, w, x0, y0, rw, rh, r, g, b) {
  for (let y = y0; y < y0 + rh; y++) for (let x = x0; x < x0 + rw; x++) { const i = (y * w + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; }
  return d;
}
function docImage() {
  const w = 200, h = 140, d = blank(w, h, 250, 250, 250);
  for (let row = 0; row < 7; row++) for (let x = 16; x < 184; x++) rect(d, w, x, 14 + row * 16, 1, 6, 20, 20, 20);
  rect(d, w, 150, 120, 20, 14, 200, 30, 30); // a red stamp
  return { data: d, width: w, height: h };
}
function photoImage() {
  const w = 64, h = 48, d = new Uint8ClampedArray(w * h * 4);
  let s = 12345;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) % 256;
  for (let i = 0; i < w * h; i++) { d[i * 4] = rnd(); d[i * 4 + 1] = rnd(); d[i * 4 + 2] = rnd(); d[i * 4 + 3] = 255; }
  return { data: d, width: w, height: h };
}

test("readImage names a white page with dark rules 'document'", () => {
  const r = A.readImage(docImage().data, 200, 140);
  assert.equal(r.schema, "AlhazenSee@1");
  assert.equal(r.sceneKind, "document");
  assert.ok(r.textLines >= 5, `expected text lines, got ${r.textLines}`);
  assert.equal(r.polarity, "dark-on-light");
});

test("readImage names colourful noise a 'photograph' and discloses it cannot read it", () => {
  const r = A.readImage(photoImage().data, 64, 48);
  assert.equal(r.sceneKind, "photograph");
  assert.ok(r.gaps.some((g) => g.kind === "no_vision_model"));
});

test("layersOf extracts the z-planes of a 2D page (paper + ink + wash)", () => {
  const L = A.layersOf(docImage().data, 200, 140);
  const roles = L.layers.map((l) => l.role);
  assert.ok(roles.includes("paper"));
  assert.ok(roles.includes("ink"));
  assert.ok(roles.includes("wash"), "the red stamp is a wash layer");
  assert.deepEqual(L.zOrder, ["paper", "faint", "wash", "figure", "ink"]);
});

test("liftTo3D turns the layers into a z-stacked scene", () => {
  const scene = A.liftTo3D(A.layersOf(docImage().data, 200, 140));
  assert.equal(scene.schema, "AlhazenScene@1");
  assert.ok(scene.planes.length >= 2);
  assert.ok(scene.planes[0].z <= scene.planes[scene.planes.length - 1].z, "sorted by z");
});

test("read3D reads a depth buffer's relief and segments", () => {
  const w = 32, h = 32, depth = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) depth[y * w + x] = y / h; // a ramp
  const d = A.read3D({ depth, width: w, height: h });
  assert.equal(d.schema, "Alhazen3D@1");
  assert.ok(d.depth.range > 0.9);
  assert.equal(d.segments.length, 4);
  assert.ok(d.relief.meanSlope > 0);
});

test("readPointCloud reads an ASCII cloud", () => {
  const m = A.readPointCloud("0 0 0\n1 0 0\n0 1 0\n0 0 1\n2 2 2");
  assert.equal(m.points, 5);
  assert.equal(m.dimensional, 3);
});

test("read4D finds the trail, the motion, and the blur of a moving block", () => {
  const w = 80, h = 60, frames = [];
  for (let k = 0; k < 7; k++) { const d = blank(w, h, 255, 255, 255); rect(d, w, 8 + k * 6, 8 + k * 4, 10, 10, 10, 10, 10); frames.push({ data: d, width: w, height: h }); }
  const r = A.read4D({ frames });
  assert.equal(r.schema, "Alhazen4D@1");
  assert.ok(r.trails.count >= 1, "a moving block leaves a trail");
  assert.ok(r.motion.speed > 0, "the centroid moved");
  assert.ok(r.motionBlur.length > 0, `blur length should be positive, got ${r.motionBlur.length}`);
  assert.ok(r.longExposure.data.length === w * h * 4);
});

test("motionBlurOfImage fixes a blur axis from a single still (axis only)", () => {
  const w = 80, h = 60, d = blank(w, h, 255, 255, 255);
  rect(d, w, 30, 10, 20, 40, 0, 0, 0); // a wide vertical band → strong horizontal edge normal
  const b = A.motionBlurOfImage(d, w, h);
  assert.equal(b.schema, "AlhazenBlur@1");
  assert.ok(b.anisotropy > 0.2, "a clean axis is anisotropic");
});

test("swarm runs eyes, reconciles, and deposits pheromone", () => {
  const phe = A.createPheromone();
  const out = A.swarm({ ...docImage() }, { pheromone: phe, budget: 2 });
  assert.equal(out.schema, "AlhazenSwarm@1");
  assert.equal(out.ants.length, 2);
  assert.ok(Object.keys(phe.board).length >= 1, "some eye deposited");
  assert.ok(out.reconciled);
});

test("pheromones repair a bad default eye order — the honest benefit", () => {
  // caller's default order is bad: the two eyes that cannot see (no OCR, no cells)
  // sit first. Under a cost budget the naive pick is blind.
  const eyes = ["text", "grid", "raster", "layer"];
  const naive = eyes.slice(0, 2);
  const phe = A.createPheromone();
  for (let i = 0; i < 8; i++) A.swarm({ ...docImage() }, { pheromone: phe, eyes, budget: 4 }); // learn
  const learned = phe.recommend("document", eyes).slice(0, 2);
  assert.deepEqual([...learned].sort(), ["layer", "raster"], "the eyes that actually saw rise to the top");
  assert.notDeepEqual([...learned].sort(), [...naive].sort(), "and differ from the blind default pick");
});

test("pheromones do NOT change the reading when every eligible eye already runs", () => {
  // the falsifying control: with no budget, order is irrelevant — reconcile is a
  // set operation. This is the honest limit of the mechanism.
  const phe = A.createPheromone();
  const a = A.swarm({ ...docImage() }, { pheromone: phe, eyes: ["raster", "layer", "text", "grid"] });
  const b = A.swarm({ ...docImage() }, { pheromone: phe, eyes: ["raster", "layer", "text", "grid"] });
  assert.equal(a.reconciled.converged, b.reconciled.converged);
  assert.equal(a.reconciled.claims, b.reconciled.claims, "same claims whether or not pheromones reorder the eyes");
});

test("object permanence: a ball behind an occluder returns as the SAME track", () => {
  const w = 200, h = 120, frames = [];
  const occl = [90, 0, 44, 120]; // a static gray band the ball passes behind
  for (let k = 0; k < 30; k++) {
    const d = blank(w, h, 255, 255, 255);
    rect(d, w, 8 + k * 6, 52, 16, 16, 20, 20, 20);           // the ball
    rect(d, w, occl[0], occl[1], occl[2], occl[3], 150, 150, 150); // occluder ON TOP
    frames.push({ data: d, width: w, height: h });
  }
  const tracks = A.trackMotions(frames);
  const perm = tracks.filter((t) => t.permanent);
  assert.equal(perm.length, 1, `exactly one permanent track, got ${perm.length}`);
  const t = perm[0];
  assert.ok(t.occludedFrames >= 3, `hidden for a few frames, got ${t.occludedFrames}`);
  assert.ok(t.occlusions.length >= 1, "an occlusion event was recorded");
  assert.ok(Math.min(...t.path.map((p) => p[0])) < 40, "started on the left");
  assert.ok(Math.max(...t.path.map((p) => p[0])) > 150, "finished on the right");
  assert.ok(t.occlusions[0].entry && t.occlusions[0].exit, "entry and exit points recorded");
  assert.equal(tracks.filter((x) => x.displacement > 90).length, 1, "not split into two objects");
});
