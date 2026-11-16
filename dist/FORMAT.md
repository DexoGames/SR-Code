# RS Code v3 experimental format

The committed source defines this experimental format. v3 removes all corner locators and adds protected whole-shape variation. v1/v2 codes must be regenerated.

## Geometry

Type IDs: Weave 0 (1 bit), Pebble 1 (2 bits), Coral 2, Knot 3, Fingerprint 4, Constellation 5 (1 bit each).

Weave/Pebble have logical dimensions 24, 36, 52, 72 for size IDs 0–3. The organic formats have 576, 784, 1024, 1296 data positions (24², 28², 32², 36²); those numbers do **not** imply physical grid placement. Export dimensions use 36 units per original size step plus 104 units of margin.

`src/organic.js` constructs whole carrier shapes: deterministic recursive branches; a multi-strand parametric knot; deformed oval ridge contours; and a fixed 26-star graph. Carrier paths are sampled by arc length. Candidate data positions are rejected if another carrier is too close to the two possible sample positions. The remaining positions are selected deterministically across the shape. A bit deflects its path section to either side of the normal, with a sin² envelope that returns to the original path at the endpoints. The decoder samples the corresponding paired positions. Unselected sections remain continuous undecorated paths. This is geometric encoding, not a payload hidden in SVG metadata.

Weave and Pebble retain their glyph alphabets but no longer carry external locator symbols. `src/registration.js` ranks whole-shape hypotheses by sampled optical contrast, attempts complete-frame transforms, fits silhouette bounds, and searches/refines rotation, reflection, scale and translation. Accepted candidates must pass RS and CRC checks. The current transform search is similarity-based, not general perspective recovery. Crop and perspective support regressed relative to v2 and the benchmark records those failures.

The four organic languages use two bits at whitened stream positions `64 × blockCount` and the following position to select one of four whole-shape variants. These correspond to protected bits of the message-group checksum. Their original local path slots are rendered neutral and the reader supplies those bits from each tested geometric hypothesis. This moves two existing code bits into structure; it does **not** increase advertised net payload capacity. The other local paths still carry the remainder of the protected frame. Two messages can share the same coarse variant; they do not thereby share a payload.

Fingerprint and Constellation use wider deflections and a full allocation of path sections. Ridge displacement is capped by inter-ridge spacing to avoid merging neighbouring lines. Star-link data begins away from the bright star centres to avoid optical overlap. Coral and Knot retain clearance-based slot selection.

## Capacity and framing

For a logical count N² and b bits per position, B=floor(N²b/8). Split B codewords evenly into ceil(B/128) blocks. Protection ratios are 0.16, 0.28, 0.40, 0.52. Each block uses ceil(n×ratio) parity bytes. Net payload capacity is total data bytes minus a 24-byte header.

All integers are big-endian. Header offsets:

| Offset | Length | Field |
|---:|---:|---|
| 0 | 2 | ASCII RS |
| 2 | 1 | Version 3 |
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

CRC-32 is reflected IEEE 0xEDB88320, initial/final XOR 0xFFFFFFFF. It detects accidental corruption, not malicious modification. Reed–Solomon uses GF(256), primitive polynomial 0x11D, alpha=2, generator roots alpha⁰ through alpha^(p−1), high-degree-first polynomials and systematic data then parity. Encoded blocks are interleaved by column and whitened by `whiten()` in `src/format.js`. Stream bits are consumed most-significant first. For organic types, the logical stream order indexes the selected path positions directly.

At most p erasures, or floor(p/2) unknown errors, can be corrected in a block; mixed damage requires 2e+s≤p. Low-confidence samples become byte erasures. Corrected syndromes, frame headers and CRC must verify before the UI presents a message. Multipart collection reorders chunks, verifies complete length/CRC and only then decodes UTF-8, allowing codepoints to cross chunk boundaries.

## Evaluation

Tests rasterize exported SVG and read pixels with the production reader. Every supported format is exercised with a full-capacity binary payload. The separate benchmark runs three messages through 17 conditions and records successes and failures. Masks cover fractions of the bounding data area, not codewords; the same mask can remove very different numbers of bits from different shapes. Native image dimensions increased in v2 to retain fine geometry. Downsampled failures are expected and are shown, not suppressed.

No physical camera/print reliability claim is made. This is not ISO QR, and ordinary QR scanners will not recognise it. QR-specific compression/ECI/GS1 features are absent. Backgrounds, glare, curved surfaces and large negative-image corpora require further testing. See [DENSO's description of codeword correction](https://www.qrcode.com/en/about/error_correction.html) for the distinction between correction budgets and arbitrary missing image regions.
