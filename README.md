# RS Code lab · v3

A browser-local generator and pixel reader for six experimental optical languages, styled for dexo.games. The four organic languages were redesigned from whole shapes; they are no longer arrangements of QR-like tiles.

- **Weave:** curved binary connections.
- **Pebble:** four possible openings in soft shapes.
- **Coral:** a connected, branching specimen.
- **Knot:** a continuous bundle of looping strands forming an ornamental knot.
- **Fingerprint:** oval, flowing ridges with a small core.
- **Constellation:** 26 stars connected into an irregular map. Larger versions use additional fine strands along links.

For the last four, two protected bits select a larger-scale geometry: a branch skeleton, knot phase, fingerprint core/outline or star positions. These bits are carried by the overall shape rather than duplicated as local marks. Other bits deflect sections of carrier paths; Fingerprint and Constellation now use wider changes and fewer unused sections. The reader follows the same deterministic geometry and compares the two possible positions. Data locations are selected away from crossings. Unused path sections remain continuous decoration. There is no hidden SVG payload or server lookup.

## Capacity trade-off

Net payload bytes after framing and **Strong** error correction:

| Language | S | M | L | XL | XL with Light |
|---|---:|---:|---:|---:|---:|
| Weave | 19 | 72 | 177 | 360 | 516 |
| Pebble | 62 | 168 | 378 | 746 | 1,063 |
| Coral | 19 | 34 | 52 | 72 | 112 |
| Knot | 19 | 34 | 52 | 72 | 112 |
| Fingerprint | 19 | 34 | 52 | 72 | 112 |
| Constellation | 19 | 34 | 52 | 72 | 112 |

UTF-8 characters may require several bytes. Up to 16 codes can carry a message. Capacities are implementation limits, not theoretical limits of these shapes. The organic designs intentionally trade capacity for appearance. Native widths are 968, 1,400, 1,976 and 2,696 pixels. These are export dimensions, not guaranteed scanning thresholds.

## Run

Node 22+, with `sharp` as a development-only dependency:

```sh
npm install
npm test
npm run benchmark
npm run build
npm run dev
```

Open http://127.0.0.1:4173. Deploy the contents of `dist/` to any static host. Camera access needs HTTPS or localhost. Files and camera frames stay on the device.

Make exports PNG/SVG, accepts text or arbitrary files, and supports multipart messages. Read accepts images or camera frames. Test this code provides cover, crop, rotation and blur controls. Compare shows actual capacities and measured outcomes, including failures.

## Robustness and limits

Reed–Solomon corrects errors and erasures, with four protection profiles. Interleaving distributes damage. There are no corner marks or replacement locator badges. The reader compares each language’s complete shape and data contrast against candidate orientations, sizes and geometry variants, then verifies the best candidates. This is currently less reliable for cropped or perspective-distorted photos. CRC-32 checks framing and assembled messages. Each block requires `2 × unknown errors + erasures ≤ parity bytes`. A percentage of missing pixels is not the same as a percentage of damaged codewords.

This is an experimental custom reader, not ISO QR compatibility or all QR conventions. Numeric/Kanji/ECI/GS1 modes and curved-surface recovery are absent. Camera controls are implemented but physical phone/print performance is unvalidated. Geometry has four data-bearing variants per size; different messages can share a coarse variant, while their local code paths still differ. The knot is a braid-like line bundle, not a physically simulated rope.

`npm test` checks algebraic correction, framing, all 96 full-capacity raster combinations and mirrored images. `public/benchmark.json` records three messages per synthetic condition; it is a small engineering experiment, not a real-world reliability percentage. Source geometry and degradation scripts make the tests reproducible. v3 replaces the earlier visual encoding; regenerate old codes.

See [FORMAT.md](FORMAT.md) for the encoding and [public/benchmark.json](public/benchmark.json) for raw results.

## v3 blur comparison

For the same three messages at M/Strong, resized to 480 pixels and blurred with Gaussian sigma 1 pixel, Fingerprint improved from **0/3 to 3/3** reads and Constellation from **0/3 to 3/3**. At 600 pixels, Fingerprint stayed 3/3 and Constellation improved from 0/3 to 3/3. Raw data: `public/print-comparison.json`. This is a small synthetic experiment, not validation on a physical printer or phone.

Removing the reference boxes has a real cost: all tested perspective and top/left crop cases currently fail, and arbitrary rotations are inconsistent. Full-frame straight-on exports, quarter turns and reflections are the strongest operating conditions. Error correction remains implemented, but cannot recover data until alignment succeeds. Compare reports the failures. Do not infer production camera readiness from the clean-image tests.

An oversized message now clears the old preview instead of leaving a dimmed stale code. The generator reports the capacity problem and disables export until resolved.
