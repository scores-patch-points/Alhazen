# Alhazen — the optics pipeline

Named for **Ibn al-Haytham (Alhazen, 965–1040)**, who argued that seeing is not
something the eye emits but something the light *imprints* — vision is measured,
not willed. This is the reading pipeline for documents: turn a page's pixels
into something legible, find the **keys** and the **formats** of their values,
read a grid's **structure**, and propose **rules** about what it is seeing.

Pure and dependency-free. Loads as ESM, CommonJS, or a classic `<script>`
(exposes `window.Alhazen`).

## The discipline
Every step is measured, disclosed and reversible — the same discipline as the
rest of the fold:
- **A reading is a hypothesis.** Keys are *not* assumed correct.
- **A value is reduced to its FORMAT** (date, currency, name, identifier…) and
  the value's **content is discarded** — what crosses documents is the schema,
  never the data.
- Nothing here decides meaning on its own; it proposes, and a person confirms.

## API
| fn | what it does |
|---|---|
| `binarizeData(data,w,h)` / `binarizeCanvas(cv)` | grayscale + Otsu binarize, in place; light-background gated so a dark/UI image is left alone |
| `valueFormat(v)` | the value's shape (`date`, `currency`, `phone`, `name`, `identifier`, `choice`, `integer`, `decimal`, `free-text`) |
| `extractFormFields(text)` | label→value pairs (colon, 2+ spaces, or " - "; lowercase labels ok) |
| `readGridFromElements(els)` | a grid, by geometry: rows by y, columns by the header row's x; each row binds to the columns |
| `readGridFromText(lines)` | the same, from whitespace runs |
| `inventTuples(text, elements)` | the tuple of everything: `{label, canonical, format, type}` + nesting (`records`, `columns`) |
| `structuralProposer(text, elements)` | a local pass that proposes key/type/structure rules and a kind name |

## Run
```bash
node Alhazen/test/alhazen.test.cjs   # or: npm test
```

## Provenance
Extracted from `ab` (the intake app), where the same pipeline read scanned
forms; also consumed by `holodeck` (the reading surface) and `the-fold`.
Measured: raising the reader to ~3× upscale recovered a faint `d`
("John Davi" → "John David"); Otsu binarization took a faded clinical form from
0 to several fields.
