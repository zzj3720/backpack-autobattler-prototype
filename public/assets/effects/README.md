# Combat Effect Assets

- `*-strip-8.png`: early raw imagegen outputs. These are not the preferred long-term source format.
- `*-strip-8x256.png`: runtime-ready horizontal sprite sheets with `8` frames at `256x256`.
- `manifest.json`: file list and usage hints for runtime integration.
- `tools/cut-effect-sheet.mjs`: slicer for equal-cell effect sheets on a flat chroma background.

## Preferred source format

Future effect assets should be generated as strict equal-cell sheets rather than freeform strips:

- one effect per sheet
- fixed grid, usually `8 x 1`
- equal square cells
- flat solid chroma-key background
- visible spacing between cells by using the same solid background as gutter
- effect centered in each cell with a safe margin
- no text, labels, or decorative sheet background

## Cutout rule

Any asset that needs keying must include edge feathering. Do not use hard binary cutouts as the default.

The cutter already defaults to feathered keying:

```bash
node tools/cut-effect-sheet.mjs \
  --source public/assets/effects/source-sheet.png \
  --output public/assets/effects/hit-spark-strip-8x256.png \
  --columns 8 --rows 1 --output-cell-size 256 \
  --key ff00ff --tolerance 60 --feather 24 --crop-padding 6 --trim-edge 24
```

Use the standardized strips for direct frame animation in the web client. Keep raw sources only as re-export material.
