import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const playwrightModule =
  process.env.PLAYWRIGHT_MODULE ??
  "/Users/zuozijian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const { chromium } = await import(playwrightModule);

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.source || !args.output) {
  printHelp();
  process.exit(args.help ? 0 : 1);
}

const sourceBytes = await readFile(args.source);
const dataUrl = `data:image/png;base64,${sourceBytes.toString("base64")}`;
const browser = await chromium.launch();
const page = await browser.newPage();

const result = await page.evaluate(
  async ({
    imageUrl,
    columns,
    rows,
    outputCellWidth,
    outputCellHeight,
    keyColor,
    tolerance,
    feather,
    cropPadding,
    trimEdge,
    fitScale,
  }) => {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = imageUrl;
    });

    const cellWidth = image.naturalWidth / columns;
    const cellHeight = image.naturalHeight / rows;
    const output = document.createElement("canvas");
    output.width = columns * outputCellWidth;
    output.height = rows * outputCellHeight;
    const outputContext = output.getContext("2d");
    if (!outputContext) {
      throw new Error("Missing output context.");
    }
    outputContext.imageSmoothingEnabled = true;
    outputContext.imageSmoothingQuality = "high";

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const maxDiff = (r, g, b) =>
      Math.max(Math.abs(r - keyColor.r), Math.abs(g - keyColor.g), Math.abs(b - keyColor.b));
    const despillChannel = (channel, key, alphaRatio) =>
      clamp(Math.round((channel - key * (1 - alphaRatio)) / Math.max(alphaRatio, 0.0001)), 0, 255);

    const crops = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const sx = Math.round(column * cellWidth);
        const sy = Math.round(row * cellHeight);
        const sw = Math.round(cellWidth);
        const sh = Math.round(cellHeight);
        const cellCanvas = document.createElement("canvas");
        cellCanvas.width = sw;
        cellCanvas.height = sh;
        const cellContext = cellCanvas.getContext("2d");
        if (!cellContext) {
          throw new Error("Missing cell context.");
        }
        cellContext.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
        const imageData = cellContext.getImageData(0, 0, sw, sh);
        const { data } = imageData;
        let minX = sw;
        let minY = sh;
        let maxX = -1;
        let maxY = -1;

        for (let index = 0; index < data.length; index += 4) {
          const pixelIndex = index / 4;
          const px = pixelIndex % sw;
          const py = Math.floor(pixelIndex / sw);
          if (
            trimEdge > 0 &&
            (px < trimEdge || px >= sw - trimEdge || py < trimEdge || py >= sh - trimEdge)
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
          minX = Math.min(minX, px);
          minY = Math.min(minY, py);
          maxX = Math.max(maxX, px);
          maxY = Math.max(maxY, py);
        }
        cellContext.putImageData(imageData, 0, 0);

        const cropLeft = maxX >= 0 ? clamp(minX - cropPadding, 0, sw - 1) : 0;
        const cropTop = maxY >= 0 ? clamp(minY - cropPadding, 0, sh - 1) : 0;
        const cropRight = maxX >= 0 ? clamp(maxX + cropPadding, 0, sw - 1) : sw - 1;
        const cropBottom = maxY >= 0 ? clamp(maxY + cropPadding, 0, sh - 1) : sh - 1;
        const cropWidth = cropRight - cropLeft + 1;
        const cropHeight = cropBottom - cropTop + 1;
        const scale =
          Math.min(outputCellWidth / cropWidth, outputCellHeight / cropHeight, 1) * fitScale;
        const drawW = cropWidth * scale;
        const drawH = cropHeight * scale;
        const dx = column * outputCellWidth + (outputCellWidth - drawW) / 2;
        const dy = row * outputCellHeight + (outputCellHeight - drawH) / 2;
        outputContext.drawImage(
          cellCanvas,
          cropLeft,
          cropTop,
          cropWidth,
          cropHeight,
          dx,
          dy,
          drawW,
          drawH,
        );
        crops.push({
          column,
          row,
          crop: { x: cropLeft, y: cropTop, width: cropWidth, height: cropHeight },
        });
      }
    }

    return { dataUrl: output.toDataURL("image/png"), crops };
  },
  {
    imageUrl: dataUrl,
    columns: args.columns,
    rows: args.rows,
    outputCellWidth: args.outputCellWidth,
    outputCellHeight: args.outputCellHeight,
    keyColor: parseHexColor(args.key),
    tolerance: args.tolerance,
    feather: args.feather,
    cropPadding: args.cropPadding,
    trimEdge: args.trimEdge,
    fitScale: args.fitScale,
  },
);

await browser.close();
await mkdir(dirname(args.output), { recursive: true });
await writeFile(args.output, Buffer.from(result.dataUrl.split(",")[1], "base64"));
console.log(JSON.stringify({ source: args.source, output: args.output, crops: result.crops }));

function parseArgs(argv) {
  const options = {
    source: "",
    output: "",
    columns: 1,
    rows: 1,
    outputCellWidth: 64,
    outputCellHeight: 64,
    key: "ff00ff",
    tolerance: 60,
    feather: 24,
    cropPadding: 8,
    trimEdge: 0,
    fitScale: 1,
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
      case "--output-cell-width":
        options.outputCellWidth = Number(argv[++index] ?? options.outputCellWidth);
        break;
      case "--output-cell-height":
        options.outputCellHeight = Number(argv[++index] ?? options.outputCellHeight);
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
      case "--fit-scale":
        options.fitScale = Number(argv[++index] ?? options.fitScale);
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

function printHelp() {
  console.error(`Usage:
  node tools/normalize-text-grid.mjs \\
    --source public/assets/text/source/skill-damage.png \\
    --output public/assets/text/skill/damage-digits.png \\
    --columns 12 --rows 5 --output-cell-width 64 --output-cell-height 82 \\
    --key ff00ff --tolerance 78 --feather 30 --crop-padding 8 --trim-edge 8 --fit-scale 0.9`);
}
