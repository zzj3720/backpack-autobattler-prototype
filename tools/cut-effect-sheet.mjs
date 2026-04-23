import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const playwrightModule =
  process.env.PLAYWRIGHT_MODULE ??
  "/Users/zuozijian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const { chromium } = await import(playwrightModule);

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

if (!args.source || !args.output) {
  printHelp("Missing required --source or --output.");
  process.exit(1);
}

const sourceBytes = await readFile(args.source);
const dataUrl = `data:image/png;base64,${sourceBytes.toString("base64")}`;
const browser = await chromium.launch();
const page = await browser.newPage();

const rendered = await page.evaluate(
  async ({
    imageUrl,
    columns,
    rows,
    outputCellSize,
    keyColor,
    tolerance,
    feather,
    cropPadding,
    trimEdge,
    noCrop,
  }) => {
    const image = new Image();
    const loaded = new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });
    image.src = imageUrl;
    await loaded;

    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = image.naturalWidth;
    sourceCanvas.height = image.naturalHeight;
    const sourceContext = sourceCanvas.getContext("2d");
    if (!sourceContext) {
      throw new Error("Missing source canvas context.");
    }
    sourceContext.drawImage(image, 0, 0);
    const sourcePixels = sourceContext.getImageData(
      0,
      0,
      sourceCanvas.width,
      sourceCanvas.height,
    ).data;

    const frames = columns * rows;

    const strip = document.createElement("canvas");
    strip.width = frames * outputCellSize;
    strip.height = outputCellSize;
    const stripContext = strip.getContext("2d");
    if (!stripContext) {
      throw new Error("Missing strip canvas context.");
    }

    const frameCanvas = document.createElement("canvas");
    frameCanvas.width = outputCellSize;
    frameCanvas.height = outputCellSize;
    const frameContext = frameCanvas.getContext("2d");
    if (!frameContext) {
      throw new Error("Missing frame canvas context.");
    }

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const maxDiff = (r, g, b) =>
      Math.max(Math.abs(r - keyColor.r), Math.abs(g - keyColor.g), Math.abs(b - keyColor.b));
    const despillChannel = (channel, key, alphaRatio) =>
      clamp(Math.round((channel - key * (1 - alphaRatio)) / Math.max(alphaRatio, 0.0001)), 0, 255);

    let minX = sourceCanvas.width;
    let minY = sourceCanvas.height;
    let maxX = -1;
    let maxY = -1;
    for (let index = 0; index < sourcePixels.length; index += 4) {
      const alpha = sourcePixels[index + 3];
      if (alpha === 0) {
        continue;
      }
      const diff = maxDiff(sourcePixels[index], sourcePixels[index + 1], sourcePixels[index + 2]);
      if (diff <= tolerance) {
        continue;
      }
      const pixelIndex = index / 4;
      const x = pixelIndex % sourceCanvas.width;
      const y = Math.floor(pixelIndex / sourceCanvas.width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }

    const cropLeft = noCrop
      ? 0
      : maxX >= 0
        ? clamp(minX - cropPadding, 0, sourceCanvas.width - 1)
        : 0;
    const cropTop = noCrop
      ? 0
      : maxY >= 0
        ? clamp(minY - cropPadding, 0, sourceCanvas.height - 1)
        : 0;
    const cropRight = noCrop
      ? sourceCanvas.width - 1
      : maxX >= 0
        ? clamp(maxX + cropPadding, 0, sourceCanvas.width - 1)
        : sourceCanvas.width - 1;
    const cropBottom = noCrop
      ? sourceCanvas.height - 1
      : maxY >= 0
        ? clamp(maxY + cropPadding, 0, sourceCanvas.height - 1)
        : sourceCanvas.height - 1;
    const cropWidth = cropRight - cropLeft + 1;
    const cropHeight = cropBottom - cropTop + 1;
    const cellWidth = cropWidth / columns;
    const cellHeight = cropHeight / rows;

    let frameIndex = 0;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        frameContext.clearRect(0, 0, outputCellSize, outputCellSize);
        frameContext.imageSmoothingEnabled = true;
        frameContext.imageSmoothingQuality = "high";
        frameContext.drawImage(
          image,
          cropLeft + column * cellWidth,
          cropTop + row * cellHeight,
          cellWidth,
          cellHeight,
          0,
          0,
          outputCellSize,
          outputCellSize,
        );

        const imageData = frameContext.getImageData(0, 0, outputCellSize, outputCellSize);
        const { data } = imageData;
        for (let index = 0; index < data.length; index += 4) {
          const pixelIndex = index / 4;
          const x = pixelIndex % outputCellSize;
          const y = Math.floor(pixelIndex / outputCellSize);
          if (
            trimEdge > 0 &&
            (x < trimEdge ||
              x >= outputCellSize - trimEdge ||
              y < trimEdge ||
              y >= outputCellSize - trimEdge)
          ) {
            data[index + 3] = 0;
            continue;
          }
          const alpha = data[index + 3];
          if (alpha === 0) {
            continue;
          }
          const diff = maxDiff(data[index], data[index + 1], data[index + 2]);
          if (diff <= tolerance) {
            data[index + 3] = 0;
            continue;
          }
          let alphaRatio = 1;
          if (feather > 0 && diff <= tolerance + feather) {
            alphaRatio = clamp((diff - tolerance) / feather, 0, 1);
            data[index + 3] = Math.round(alpha * alphaRatio);
          }
          const finalAlpha = data[index + 3];
          if (finalAlpha === 0) {
            continue;
          }
          const finalAlphaRatio = finalAlpha / 255;
          if (finalAlphaRatio < 1) {
            data[index] = despillChannel(data[index], keyColor.r, finalAlphaRatio);
            data[index + 1] = despillChannel(data[index + 1], keyColor.g, finalAlphaRatio);
            data[index + 2] = despillChannel(data[index + 2], keyColor.b, finalAlphaRatio);
          }
        }
        frameContext.putImageData(imageData, 0, 0);
        stripContext.clearRect(frameIndex * outputCellSize, 0, outputCellSize, outputCellSize);
        stripContext.drawImage(frameCanvas, frameIndex * outputCellSize, 0);
        frameIndex += 1;
      }
    }

    return {
      frameCount: frames,
      frameWidth: outputCellSize,
      frameHeight: outputCellSize,
      crop: {
        x: cropLeft,
        y: cropTop,
        width: cropWidth,
        height: cropHeight,
      },
      dataUrl: strip.toDataURL("image/png"),
    };
  },
  {
    imageUrl: dataUrl,
    columns: args.columns,
    rows: args.rows,
    outputCellSize: args.outputCellSize,
    keyColor: parseHexColor(args.key),
    tolerance: args.tolerance,
    feather: args.feather,
    cropPadding: args.cropPadding,
    trimEdge: args.trimEdge,
    noCrop: args.noCrop,
  },
);

await browser.close();
await mkdir(dirname(args.output), { recursive: true });
await writeFile(args.output, Buffer.from(rendered.dataUrl.split(",")[1], "base64"));

console.log(
  JSON.stringify({
    output: args.output,
    frameCount: rendered.frameCount,
    frameWidth: rendered.frameWidth,
    frameHeight: rendered.frameHeight,
    key: normalizeHex(args.key),
    tolerance: args.tolerance,
    feather: args.feather,
    crop: rendered.crop,
    trimEdge: args.trimEdge,
    noCrop: args.noCrop,
  }),
);

function parseArgs(argv) {
  const options = {
    source: "",
    output: "",
    columns: 8,
    rows: 1,
    outputCellSize: 256,
    key: "ff00ff",
    tolerance: 60,
    feather: 24,
    cropPadding: 6,
    trimEdge: 24,
    noCrop: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--source":
        options.source = argv[++index] ?? "";
        break;
      case "--output":
        options.output = argv[++index] ?? "";
        break;
      case "--columns":
        options.columns = Number(argv[++index] ?? options.columns);
        break;
      case "--rows":
        options.rows = Number(argv[++index] ?? options.rows);
        break;
      case "--output-cell-size":
        options.outputCellSize = Number(argv[++index] ?? options.outputCellSize);
        break;
      case "--key":
        options.key = argv[++index] ?? options.key;
        break;
      case "--tolerance":
        options.tolerance = Number(argv[++index] ?? options.tolerance);
        break;
      case "--feather":
        options.feather = Number(argv[++index] ?? options.feather);
        break;
      case "--crop-padding":
        options.cropPadding = Number(argv[++index] ?? options.cropPadding);
        break;
      case "--trim-edge":
        options.trimEdge = Number(argv[++index] ?? options.trimEdge);
        break;
      case "--no-crop":
        options.noCrop = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function normalizeHex(input) {
  const value = input.replace(/^#/, "").trim().toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(value)) {
    throw new Error(`Expected a 6-digit hex color, got "${input}".`);
  }
  return value;
}

function parseHexColor(input) {
  const value = normalizeHex(input);
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function printHelp(prefix = "") {
  if (prefix) {
    console.error(prefix);
    console.error("");
  }
  console.error(`Usage:
  node tools/cut-effect-sheet.mjs \\
    --source public/assets/effects/source-sheet.png \\
    --output public/assets/effects/poison-puff-strip-8x256.png \\
    --columns 8 --rows 1 --output-cell-size 256 \\
    --key ff00ff --tolerance 60 --feather 24 --crop-padding 6 --trim-edge 24

Options:
  --no-crop    Preserve the source grid exactly. Use this for character animations
               where per-frame footing and headroom must stay locked.

Notes:
  - Input should be a strict equal-cell sheet on a flat solid background.
  - Cells are read left-to-right, top-to-bottom.
  - The output is a single horizontal strip for runtime playback.`);
}
