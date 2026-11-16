# RS Code lab · v2

A browser-local generator and pixel reader for six experimental optical languages, styled for dexo.games. The four organic languages were redesigned from whole shapes; they are no longer arrangements of QR-like tiles.

- **Weave:** curved binary connections.
- **Pebble:** four possible openings in soft shapes.
- **Coral:** a connected, branching specimen.
- **Knot:** a continuous bundle of looping strands forming an ornamental knot.
- **Fingerprint:** oval, flowing ridges with a small core.
- **Constellation:** 26 stars connected into an irregular map. Larger versions use additional fine strands along links.

For the last four, a bit is a tiny deflection to either side of a carrier path. The reader follows the same deterministic geometry and compares the two possible positions. Data locations are selected away from crossings. Unused path sections remain continuous decoration. There is no hidden SVG payload or server lookup.

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

Reed–Solomon corrects errors and erasures, with four protection profiles. Interleaving distributes damage. Eight reference marks support rotation, reflection and planar perspective recovery; suitable surviving marks can support cropped images. CRC-32 checks framing and assembled messages. Each block requires `2 × unknown errors + erasures ≤ parity bytes`. A percentage of missing pixels is not the same as a percentage of damaged codewords.

This is an experimental custom reader, not ISO QR compatibility or all QR conventions. Numeric/Kanji/ECI/GS1 modes and curved-surface recovery are absent. Camera controls are implemented but physical phone/print performance is unvalidated. Decorative carrier geometry is fixed per size; the message changes local bends. Locators are still square. The knot is a braid-like line bundle, not a physically simulated rope.

`npm test` checks algebraic correction, framing, all 96 full-capacity raster combinations and mirrored images. `public/benchmark.json` records three messages per synthetic condition; it is a small engineering experiment, not a real-world reliability percentage. Source geometry and degradation scripts make the tests reproducible. v2 replaces the earlier visual encoding; regenerate old codes.

See [FORMAT.md](FORMAT.md) for the encoding and [public/benchmark.json](public/benchmark.json) for raw results.
