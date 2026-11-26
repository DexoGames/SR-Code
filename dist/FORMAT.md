# SR Code v6 experimental format

The generator writes version 6. The reader retains v4 and v5 optical layouts and validates the wire version. Capacities, Reed–Solomon profiles and multipart framing are shared across the three versions.

## Optical geometry

Exports use a 1000-unit drawing plane and native widths of 968, 1400, 1976 and 2696 pixels. The nominal pattern field spans 920 units. N is 24, 36, 52 or 72 for Weave and Pebble, and 24, 28, 32 or 36 for the other styles.

| ID | Style | Optical data | Registration features |
|---|---|---|---|
| 0 | Weave | N² binary turns in continuous yarns | Four closed loops formed by ordinary adjacent turns |
| 1 | Pebble | 2N² bits in opening positions and four-site mergers | Round stones with off-centre openings |
| 2 | Coral | Four selectable rib lengths per cup | The scalloped openings of mature corallites |
| 3 | Knot | N²/2 crossings in rope traversal order, each early or late and over or under | Three lobe windows and the central opening of the trefoil |
| 4 | Fingerprint | N²/2 sections with four positions for a fork or opening | Four bifurcations that rejoin the outer ridge |
| 5 | Constellation | Two position bits for each of ceil(0.345N²) movable stars. Each remaining bit selects a distinct legal link. | Wishing star, five-point star, sunburst and ringed planet |

Weave reserves naturally closed curves. Pebble packs regular stones first and dedicates four normal footprints to each possible merger. A merged stone carries its opening directly. An unmerged group repeats the opening on its four stones. Knot assigns addresses along closed cords and leaves smooth runs through the central overpasses. The final four styles derive their geometry variants from two protected stream bits at offset 64 × blockCount.

Constellation orders star centres and link midpoints in concentric bands, each 1.6 times the nominal star spacing in width. Within a band it sorts by polar angle from the drawing centre. Both position bits of a star stay together, so a covered patch tends to affect fewer codewords. Four different guide silhouettes contain light windows for registration. The reader also tries the original v6 triangular guides and their original bit ordering.

Constellation checks each proposed edge at both ends against every existing neighbour, enumerating the allowed positions of all three stars. Every pair of incident links in a generated code makes an angle of at least 30° in the drawing plane. The graph construction also reserves clearance from unrelated stars and edges. Fixed artwork, permanent links and all possible data links participate in these constraints. Perspective can compress the apparent angle in a photograph.

## Registration

The geometry and optical samplers live in `src/native/`. Each layout describes ink islands or enclosed paper windows in its own artwork. The reader proposes alignments from image or page bounds and from corresponding connected components. It refines page edges and native contours, measures ink and paper locally, then samples the data. The recovered header, error correction and CRC verify each format hypothesis. Earlier ring-based codes retain their corresponding readers.

## Camera snapshots

The UI captures three separate full-resolution frames approximately 45 ms apart, capped at 2560 pixels wide. Laplacian energy on a thumbnail ranks sharpness, using the recently detected code region when available. Region history expires after 1.5 seconds. `decodeBurst` independently registers and decodes each candidate, highest score first, stopping only at a verified message. It does not blend pixels, combine pose estimates, or fuse bits from different frames. This tolerates some motion between exposures; it does not undo motion blur within one exposure. The successful frame index is returned for display and saving.

## Capacity and framing

For a logical count N² and b bits per position, B=floor(N²b/8). Split B codewords evenly into ceil(B/128) blocks. Protection ratios are 0.16, 0.28, 0.40, 0.52. Each block uses ceil(n×ratio) parity bytes. Net payload capacity is total data bytes minus a 24-byte header.

All integers are big-endian. Header offsets:

| Offset | Length | Field |
|---:|---:|---|
| 0 | 2 | ASCII RS |
| 2 | 1 | Version 6 |
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

The tests rasterize actual SVG exports and read their pixels. They cover all 96 combinations of style, size and protection at full capacity, mirrored images, v4/v5 compatibility, a moving snapshot burst, obscured native features, small tilted codes and faded oblique prints. A code containing only a few guide stones must fail verification.

The image benchmark uses three messages per style across 17 alterations. Its centred masks cover a fraction of the nominal pattern field. The camera benchmark uses three messages per style across nine captures, including oblique, faded prints with simulated ink gain or loss. A required case combines a 37° rotation, 0.9-pixel blur and 6% cover at 360 pixels for every style. Unit tests also mask individual Constellation guides and exercise all four layout variants. Compare in the app shows the measured successes and failures. Physical printer and camera performance, curved surfaces and severe glare require separate trials.
