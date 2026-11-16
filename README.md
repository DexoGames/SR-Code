# RS Code lab · v4

A browser-local generator and pixel reader for six experimental optical languages, styled for dexo.games. All messages are read from pixels; there is no SVG payload or server lookup.

- **Weave:** two thick curved connection states.
- **Pebble:** varied, staggered stones; four opening positions carry two bits. Stone sizes are decorative, not additional capacity.
- **Coral:** a sea-fan tree whose larger branch tips choose between two directions.
- **Knot:** four strand routings per site: two over–under crossings and two turning pairs.
- **Fingerprint:** smooth oval ridges; four possible gap positions create readable ridge endings.
- **Constellation:** four possible positions per star and two independently selectable links. Actual connections form chains, triangles and loops.

Coral, Knot, Fingerprint and Constellation also move two protected bits into four overall geometry variants. Local states carry the remaining bits. Derived triangles/loops do not add capacity beyond their edge decisions. Overlap order is only encoded where visibly distinguishable, as in Knot.

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

## Camera reading and motion

Four themed corner motifs identify the orientation and fit a projective transform. The shapes surrounding the common circular reference rings match each language. The reader detects their centres and pupil sizes, ranks format/size/shape hypotheses, then verifies recovered data with Reed–Solomon and CRC. Uploaded images also retain a whole-shape fallback.

The camera requests high resolution and continuous autofocus where supported. Each burst takes three independent snapshots about 45 ms apart. A sharpness score ranks them; the last detected region guides that score for up to 1.5 seconds. Each candidate gets a fresh pose fit, so motion between snapshots is allowed. Frames and partial bit reads are never averaged or merged. This is region tracking and burst selection, not optical-flow tracking or motion deblurring. Processing time depends on the device.

To scan from a phone, regenerate the code with v4, use **Show large**, and keep all four corner motifs in view. Bring the phone close enough for individual features to look sharp. **Save frame** exports the last attempted snapshot for diagnosing failures. Camera frames stay on the device.

## Robustness and limits

Four Reed–Solomon protection profiles, interleaving and low-confidence erasures support partial payload recovery. Each block requires `2 × unknown errors + erasures ≤ parity bytes`. Missing pixel area is not equivalent to damaged codewords. Missing corner motifs can prevent camera alignment before error correction is possible. CRC validates framing and assembled messages; it is not cryptographic authentication.

This is a custom experimental format, not ISO QR compatibility. Numeric/Kanji/ECI/GS1 modes and curved-surface recovery are absent. Old exports must be regenerated: the wire version is 4.

`npm test` checks algebraic correction, framing, all 96 full-capacity raster combinations, reflection, tilted blurred frames, incomplete/empty landmarks and a moving snapshot burst. `npm run benchmark` writes the image benchmark; `node scripts/webcam-benchmark.mjs` writes camera simulations. These run the production pixel reader and report failures as well as successes.

The v4 camera benchmark recovered 99/108 synthetic captures: all 90 larger-frame cases, and 9/18 cases with a roughly 360-pixel-wide code. The small Pebble, Knot and Constellation cases failed. These are three-message engineering samples, not real-world reliability rates or physical phone/webcam validation. Glare, autofocus, motion within a single exposure and actual screen interference remain unvalidated.

See [FORMAT.md](FORMAT.md), [image results](public/benchmark.json) and [camera simulations](public/webcam-benchmark.json).
