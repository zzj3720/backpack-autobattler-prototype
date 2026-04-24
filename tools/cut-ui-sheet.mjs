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

if (!args.source || args.outputs.length === 0) {
  printHelp("Missing required --source or --outputs.");
  process.exit(1);
}

const regions = parseRegions(args.regions);
const expectedCount = regions.length > 0 ? regions.length : args.columns * args.rows;
if (args.outputs.length !== expectedCount) {
  throw new Error(`Expected ${expectedCount} outputs, got ${args.outputs.length}.`);
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
    regions,
    keyColor,
    tolerance,
    feather,
    spillCleanup,
    edgeContract,
    cropPadding,
    trimEdge,
  }) => {
    const image = new Image();
    const loaded = new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });
    image.src = imageUrl;
    await loaded;

    const cellWidth = image.naturalWidth / columns;
    const cellHeight = image.naturalHeight / rows;
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = image.naturalWidth;
    sourceCanvas.height = image.naturalHeight;
    const sourceContext = sourceCanvas.getContext("2d");
    if (!sourceContext) {
      throw new Error("Missing source context.");
    }
    sourceContext.drawImage(image, 0, 0);

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const maxDiff = (r, g, b) =>
      Math.max(Math.abs(r - keyColor.r), Math.abs(g - keyColor.g), Math.abs(b - keyColor.b));
    const despillChannel = (channel, key, alphaRatio) =>
      clamp(Math.round((channel - key * (1 - alphaRatio)) / Math.max(alphaRatio, 0.0001)), 0, 255);
    const cleanupKeySpill = (r, g, b) => {
      const channels = [r, g, b];
      const keyChannels = [keyColor.r, keyColor.g, keyColor.b];
      const protectedMax = Math.max(...channels.filter((_, index) => keyChannels[index] < 128), 0);
      for (let index = 0; index < channels.length; index += 1) {
        if (keyChannels[index] > 200 && channels[index] > protectedMax + 4) {
          channels[index] = protectedMax + 4;
        }
      }
      return channels;
    };

    const outputs = [];
    const cells =
      regions.length > 0
        ? regions.map((region) => ({
            sx: region.x,
            sy: region.y,
            sw: region.width,
            sh: region.height,
          }))
        : Array.from({ length: rows * columns }, (_, index) => {
            const column = index % columns;
            const row = Math.floor(index / columns);
            return {
              sx: Math.round(column * cellWidth),
              sy: Math.round(row * cellHeight),
              sw: Math.round(cellWidth),
              sh: Math.round(cellHeight),
            };
          });

    for (const cell of cells) {
      const sx = Math.round(cell.sx);
      const sy = Math.round(cell.sy);
      const sw = Math.round(cell.sw);
      const sh = Math.round(cell.sh);

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
        if (spillCleanup) {
          const cleaned = cleanupKeySpill(data[index], data[index + 1], data[index + 2]);
          data[index] = cleaned[0];
          data[index + 1] = cleaned[1];
          data[index + 2] = cleaned[2];
        }
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      }

      if (edgeContract > 0) {
        contractAlphaEdges(data, sw, sh, edgeContract);
      }

      minX = sw;
      minY = sh;
      maxX = -1;
      maxY = -1;
      for (let index = 0; index < data.length; index += 4) {
        if (data[index + 3] === 0) {
          continue;
        }
        const pixelIndex = index / 4;
        const px = pixelIndex % sw;
        const py = Math.floor(pixelIndex / sw);
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

      const outCanvas = document.createElement("canvas");
      outCanvas.width = cropWidth;
      outCanvas.height = cropHeight;
      const outContext = outCanvas.getContext("2d");
      if (!outContext) {
        throw new Error("Missing output context.");
      }
      outContext.drawImage(
        cellCanvas,
        cropLeft,
        cropTop,
        cropWidth,
        cropHeight,
        0,
        0,
        cropWidth,
        cropHeight,
      );

      outputs.push({
        crop: { x: cropLeft, y: cropTop, width: cropWidth, height: cropHeight },
        dataUrl: outCanvas.toDataURL("image/png"),
      });
    }

    return outputs;

    function contractAlphaEdges(data, width, height, amount) {
      const sourceAlpha = new Uint8ClampedArray(width * height);
      for (let index = 0; index < sourceAlpha.length; index += 1) {
        sourceAlpha[index] = data[index * 4 + 3];
      }
      const radius = Math.max(1, Math.round(amount));
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const alphaIndex = y * width + x;
          if (sourceAlpha[alphaIndex] === 0) {
            continue;
          }
          let nearTransparent = false;
          for (let dy = -radius; dy <= radius && !nearTransparent; dy += 1) {
            for (let dx = -radius; dx <= radius; dx += 1) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
                nearTransparent = true;
                break;
              }
              if (sourceAlpha[ny * width + nx] < 10) {
                nearTransparent = true;
                break;
              }
            }
          }
          if (nearTransparent) {
            data[alphaIndex * 4 + 3] = Math.max(0, sourceAlpha[alphaIndex] - 170);
          }
        }
      }
    }
  },
  {
    imageUrl: dataUrl,
    columns: args.columns,
    rows: args.rows,
    regions,
    keyColor: parseHexColor(args.key),
    tolerance: args.tolerance,
    feather: args.feather,
    spillCleanup: args.spillCleanup,
    edgeContract: args.edgeContract,
    cropPadding: args.cropPadding,
    trimEdge: args.trimEdge,
  },
);

await browser.close();

for (let index = 0; index < args.outputs.length; index += 1) {
  const output = args.outputs[index];
  if (!output) {
    continue;
  }
  await mkdir(dirname(output), { recursive: true });
  const renderedItem = rendered[index];
  if (!renderedItem) {
    continue;
  }
  const base64 = renderedItem.dataUrl.split(",")[1];
  await writeFile(output, Buffer.from(base64, "base64"));
}

console.log(
  JSON.stringify({
    source: args.source,
    outputs: args.outputs,
    key: normalizeHex(args.key),
    tolerance: args.tolerance,
    feather: args.feather,
    spillCleanup: args.spillCleanup,
    edgeContract: args.edgeContract,
    cropPadding: args.cropPadding,
    trimEdge: args.trimEdge,
    crops: rendered.map((item, index) => ({ output: args.outputs[index], crop: item.crop })),
  }),
);

function parseArgs(argv) {
  const options = {
    source: "",
    columns: 3,
    rows: 2,
    outputs: [],
    regions: "",
    key: "ff00ff",
    tolerance: 60,
    feather: 24,
    spillCleanup: false,
    edgeContract: 0,
    cropPadding: 8,
    trimEdge: 0,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--source":
        options.source = argv[++index] ?? "";
        break;
      case "--columns":
        options.columns = Number(argv[++index] ?? options.columns);
        break;
      case "--rows":
        options.rows = Number(argv[++index] ?? options.rows);
        break;
      case "--outputs":
        options.outputs = (argv[++index] ?? "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
        break;
      case "--regions":
        options.regions = argv[++index] ?? "";
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
      case "--spill-cleanup":
        options.spillCleanup = true;
        break;
      case "--edge-contract":
        options.edgeContract = Number(argv[++index] ?? options.edgeContract);
        break;
      case "--crop-padding":
        options.cropPadding = Number(argv[++index] ?? options.cropPadding);
        break;
      case "--trim-edge":
        options.trimEdge = Number(argv[++index] ?? options.trimEdge);
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

function parseRegions(input) {
  if (!input) {
    return [];
  }
  return input.split(";").map((entry) => {
    const values = entry.split(",").map((value) => Number(value.trim()));
    if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
      throw new Error(`Invalid region "${entry}". Expected x,y,width,height.`);
    }
    const [x, y, width, height] = values;
    return { x, y, width, height };
  });
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
  node tools/cut-ui-sheet.mjs \\
    --source public/assets/ui/source/health-bars-sheet.png \\
    --columns 3 --rows 2 \\
    --outputs public/assets/ui/bar-player-frame.png,public/assets/ui/bar-enemy-frame.png,... \\
    --key ff00ff --tolerance 60 --feather 24 --spill-cleanup --edge-contract 1 --crop-padding 8 --trim-edge 4

  node tools/cut-ui-sheet.mjs \\
    --source public/assets/ui/source/health-bars-sheet.png \\
    --regions 29,122,517,311\\;567,122,485,314 \\
    --outputs public/assets/ui/bar-player-frame.png,public/assets/ui/bar-enemy-frame.png`);
}
