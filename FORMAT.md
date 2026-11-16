# RS Code v4 experimental format

The committed source defines this experimental format. v4 adds themed landmarks and replaces fine data deflections with larger structural states. Earlier codes must be regenerated.

## Geometry and local alphabets

Type IDs: Weave 0, Pebble 1, Coral 2, Knot 3, Fingerprint 4, Constellation 5. Sizes 0–3 use Weave/Pebble logical dimensions 24, 36, 52, 72. The other languages use N = 24, 28, 32, 36. These are packing dimensions, not necessarily physical grids.

- Weave: N² sites, one bit per curved connection state.
- Pebble: N² sites, two bits per opening position. Stones have deterministic varied radii and staggered centres. Size variation is decorative.
- Coral: N² golden-angle-distributed branch nodes connected into a sea-fan tree. Each tip chooses one of two directions, selected with clearance from the static branches. One bit per tip.
- Knot: N²/2 sites on a polar rosette. Each two-bit state selects one of two over–under crossings or two paired turns. White underpass gaps distinguish crossing order.
- Fingerprint: N²/2 sites allocated along oval ridges, excluding three core ridges. Each two-bit state selects one of four gap positions in its section. Gap half-width is 0.085 of the section; ridge stroke is 0.29 of radial spacing.
- Constellation: N²/4 stars. Two bits choose among four star positions (±0.17 local spacing on each axis); two bits switch two unique nearby edges. Edges follow the actual chosen star endpoints. The decoder first estimates star positions, then samples possible links. Ambiguous positions erase their bits and incident link decisions. Triangles, chains and loops result from these edge choices; they are not counted as additional independent bits. Invisible drawing order carries no data.

Export widths are 968, 1400, 1976 and 2696 units. Payload geometry is scaled to 72% and inset 14% on each axis. Four themed corner motifs sit at normalized centres (0.075,0.075), (0.925,0.075), (0.925,0.925), (0.075,0.925). Their common circular reference radius is 0.038 of image width. An inner white radius of 0.74 and pupil radii 0.12/0.28/0.44/0.60 of the reference radius identify the corners. Surrounding decoration follows the selected language. Quiet halos protect detection.

`src/landmark-reader.js` extracts enclosed white regions at global/adaptive thresholds, fits ellipses to their boundaries, checks radial profiles, and groups four corner IDs. It rejects implausible quadrilaterals and fits a homography. `src/registration.js` ranks format, size and macro-shape candidates; accepted data must pass RS and CRC checks. Camera mode requires all four detected motifs. Uploaded images may also use the legacy whole-shape similarity search. Four corner correspondences support projective alignment; this is not curved-surface recovery.

## Protected overall shape

The four organic languages use two bits at whitened stream positions `64 × blockCount` and the next position to choose one of four overall geometries. These correspond to protected message-group checksum bits. Their original local slots are neutral; the reader supplies them from each geometry hypothesis. This moves two existing bits into structure, without increasing net capacity. Different messages can share a macro variant while their remaining symbols differ.

## Camera snapshots

The UI captures three separate full-resolution frames approximately 45 ms apart, capped at 2560 pixels wide. Laplacian energy on a thumbnail ranks sharpness, using the recently detected code region when available. Region history expires after 1.5 seconds. `decodeBurst` independently registers and decodes each candidate, highest score first, stopping only at a verified message. It does not blend pixels, combine pose estimates, or fuse bits from different frames. This tolerates some motion between exposures; it does not undo motion blur within one exposure. The successful frame index is returned for display and saving.

## Capacity and framing

For a logical count N² and b bits per position, B=floor(N²b/8). Split B codewords evenly into ceil(B/128) blocks. Protection ratios are 0.16, 0.28, 0.40, 0.52. Each block uses ceil(n×ratio) parity bytes. Net payload capacity is total data bytes minus a 24-byte header.

All integers are big-endian. Header offsets:

| Offset | Length | Field |
|---:|---:|---|
| 0 | 2 | ASCII RS |
| 2 | 1 | Version 4 |
| 3 | 1 | Type ID |
| 4 | 1 | Size ID |
| 5 | 1 | Protection ID |
| 6 | 1 | 0 binary, 1 UTF-8 |
| 7 | 1 | Reserved zero |
| 8 | 4 | Whole-message CRC-32 |
| 12 | 1 | Part index |
| 13 | 1 | Part count, 1–16 |
| 14 | 4 | Whole-message byte length |
| 18 | 2 | Chunk byte length |
| 20 | 4 | CRC over bytes 0–19 then chunk payload |
| 24 | variable | Chunk, then zero padding |

CRC-32 is reflected IEEE 0xEDB88320, initial/final XOR 0xFFFFFFFF. It detects accidental corruption, not malicious modification. Reed–Solomon uses GF(256), primitive polynomial 0x11D, alpha=2, generator roots alpha⁰ through alpha^(p−1), high-degree-first polynomials and systematic data then parity. Encoded blocks are interleaved by column and whitened by `whiten()` in `src/format.js`. Stream bits are consumed most-significant first. For organic types, the logical stream order indexes the structural sites described above.

At most p erasures, or floor(p/2) unknown errors, can be corrected in a block; mixed damage requires 2e+s≤p. Low-confidence samples become byte erasures. Corrected syndromes, frame headers and CRC must verify before the UI presents a message. Multipart collection reorders chunks, verifies complete length/CRC and only then decodes UTF-8, allowing codepoints to cross chunk boundaries.

## Evaluation

Tests rasterize exported SVG and decode actual pixels using the production reader. All 96 language/size/protection combinations are exercised at full payload capacity. The image benchmark uses three messages across 17 conditions. The separate camera benchmark embeds S/Strong codes in 1280×960 scenes with perspective, blur, illumination gradients, JPEG and periodic interference. Held-out tilted frames and an independently moving snapshot burst are also unit tested.

Masks cover fractions of the bounding payload area, not codewords. A missing landmark can prevent registration regardless of the surviving error-correction budget. Synthetic outcomes do not establish physical camera or print reliability. Glare, curved surfaces, motion blur, real screen interference and large negative-image corpora need further evaluation. This is not ISO QR; ordinary QR readers cannot decode it. QR-specific compression/ECI/GS1 conventions are absent.
