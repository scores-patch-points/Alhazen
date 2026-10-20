"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../alhazen.js");

test("valueFormat reduces a value to its shape (content discarded)", () => {
  assert.equal(A.valueFormat("03/24/2010"), "date");
  assert.equal(A.valueFormat("2024-01-02"), "date");
  assert.equal(A.valueFormat("$1,250.00"), "currency");
  assert.equal(A.valueFormat("9319982246"), "phone");
  assert.equal(A.valueFormat("John David"), "name");
  assert.equal(A.valueFormat("Yes"), "choice");
  assert.equal(A.valueFormat("102"), "integer");
  assert.equal(A.valueFormat("TN-2026-004517"), "identifier");
});

test("extractFormFields reads labels however they are written", () => {
  const f = A.extractFormFields("Visit Date: 03/24/2010\nParticipant ID   102\nCounseling notes - feels good");
  const by = Object.fromEntries(f.map((x) => [x.label, x.value]));
  assert.equal(by["Visit Date"], "03/24/2010");
  assert.equal(by["Participant ID"], "102");
  assert.equal(by["Counseling notes"], "feels good");
});

test("readGridFromElements: header row becomes columns; a row binds to them", () => {
  const els = [
    { text: "Date (mm/dd/yyyy)", region: [40, 100, 120, 14] },
    { text: "Last Name", region: [220, 100, 90, 14] },
    { text: "First Name", region: [330, 100, 90, 14] },
    { text: "01/10/2023", region: [40, 140, 90, 14] },
    { text: "Pei", region: [220, 140, 60, 14] },
    { text: "Lee", region: [330, 140, 60, 14] },
  ];
  const g = A.readGridFromElements(els);
  assert.equal(g.columns.length, 3);
  assert.equal(g.records.length, 1);
  assert.equal(g.records[0]["Last Name"], "Pei");
  assert.equal(g.records[0]["Date (mm/dd/yyyy)"], "01/10/2023");
});

test("readGridFromText reads a whitespace table", () => {
  const g = A.readGridFromText(["Name   Service No   Rank", "W.D. Ranjan   008249   Tech", "H.C. Jayawardena   068301   Tk"]);
  assert.equal(g.columns.length, 3);
  assert.equal(g.records.length, 2);
  assert.equal(g.records[0]["Service No"], "008249");
});

test("inventTuples returns the tuple of everything + nesting", () => {
  const inv = A.inventTuples("Participant ID: 102\nVisit Date: 03/24/2010\nCounselor: J. Hale");
  assert.ok(inv.tuples.length >= 3);
  assert.equal(inv.tuples[0].canonical, "participant_id");
  assert.equal(inv.kind, "form");
});

test("structuralProposer proposes key/type rules and a kind name", () => {
  const p = A.structuralProposer("Adherence Counseling Record\nVisit Date: 03/24/2010\nParticipant ID: 102");
  assert.match(p.kindName, /Adherence/);
  assert.ok(p.rules.some((r) => r.type === "key" && r.canonical === "visit_date"));
});

test("binarizeData turns a faint dark-on-light page to black/white, leaves dark images alone", () => {
  const w = 4, h = 4, n = w * h;
  const light = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) { const v = i % 2 ? 90 : 200; light[i * 4] = light[i * 4 + 1] = light[i * 4 + 2] = v; light[i * 4 + 3] = 255; }
  A.binarizeData(light, w, h);
  const vals = new Set(); for (let i = 0; i < n; i++) vals.add(light[i * 4]);
  assert.ok([...vals].every((v) => v === 0 || v === 255), "only black or white after binarize");
  const dark = new Uint8ClampedArray(n * 4); for (let i = 0; i < n; i++) { dark[i * 4] = dark[i * 4 + 1] = dark[i * 4 + 2] = 40; dark[i * 4 + 3] = 255; }
  A.binarizeData(dark, w, h);
  assert.equal(dark[0], 40, "a dark image is left alone");
});

test("valueFormat reads statement values: thousands, parenthesised negatives, nil dash, percent, long dates, EIN and file numbers", () => {
  assert.equal(A.valueFormat("238,196"), "integer");
  assert.equal(A.valueFormat("(1,234)"), "integer");
  assert.equal(A.valueFormat("1,234.50"), "decimal");
  assert.equal(A.valueFormat("—"), "nil");
  assert.equal(A.valueFormat("12.5%"), "percent");
  assert.equal(A.valueFormat("December 31, 2025"), "date");
  assert.equal(A.valueFormat("20-3828755"), "identifier");
  assert.equal(A.valueFormat("001-37985"), "identifier");
  // earlier shapes are unchanged
  assert.equal(A.valueFormat("$1,250.00"), "currency");
  assert.equal(A.valueFormat("1234"), "integer");
  assert.equal(A.valueFormat("03/24/2010"), "date");
});

test("extractFormFields reads a statement row with a long label and numeric cells; a prose line is not mistaken for one", () => {
  const f = A.extractFormFields("Current portion of operating lease liability  2,080  1,925\nSeries A preferred stock, $0.001 par value  —  —\nThis sentence has no numbers in cells at all.");
  assert.equal(f[0].label, "Current portion of operating lease liability");
  assert.equal(f[0].value, "2,080  1,925");
  assert.equal(f[1].label, "Series A preferred stock, $0.001 par value");
  assert.equal(f.length, 2);
});
