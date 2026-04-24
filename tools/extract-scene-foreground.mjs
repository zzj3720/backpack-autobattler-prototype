import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const WIDTH = 1280;
const HEIGHT = 760;

const playwrightModule =
  process.env.PLAYWRIGHT_MODULE ??
  "/Users/zuozijian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const { chromium } = await import(playwrightModule);

const args = parseArgs(process.argv.slice(2));
if (!args.source || !args.output) {
  printHelp();
  process.exit(1);
}

const regions = args.regions ? parseRegions(args.regions) : defaultRegions();
const source = await readFile(args.source);
const imageUrl = `data:image/png;base64,${source.toString("base64")}`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });

const dataUrl = await page.evaluate(
  async ({ imageUrl, regions }) => {
    const image = new Image();
    const loaded = new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });
    image.src = imageUrl;
    await loaded;

    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = 1280;
    sourceCanvas.height = 760;
    const sourceContext = sourceCanvas.getContext("2d");
    if (!sourceContext) {
      throw new Error("Missing source canvas context.");
    }

    const scale = Math.max(
      sourceCanvas.width / image.naturalWidth,
      sourceCanvas.height / image.naturalHeight,
    );
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    sourceContext.drawImage(
      image,
      (sourceCanvas.width - drawWidth) / 2,
      (sourceCanvas.height - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );
    sourceContext.fillStyle = "rgba(4, 8, 9, 0.12)";
    sourceContext.fillRect(0, 0, 1280, 760);
    const vignette = sourceContext.createRadialGradient(
      1280 * 0.48,
      760 * 0.43,
      140,
      1280 * 0.48,
      760 * 0.43,
      760,
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.54)");
    sourceContext.fillStyle = vignette;
    sourceContext.fillRect(0, 0, 1280, 760);

    const output = document.createElement("canvas");
    output.width = 1280;
    output.height = 760;
    const outputContext = output.getContext("2d");
    if (!outputContext) {
      throw new Error("Missing output canvas context.");
    }

    for (const region of regions) {
      outputContext.drawImage(
        sourceCanvas,
        region.x,
        region.y,
        region.w,
        region.h,
        region.x,
        region.y,
        region.w,
        region.h,
      );
    }

    return output.toDataURL("image/png");
  },
  { imageUrl, regions },
);

await browser.close();
await mkdir(dirname(args.output), { recursive: true });
await writeFile(args.output, Buffer.from(dataUrl.split(",")[1] ?? "", "base64"));
console.log(JSON.stringify({ source: args.source, output: args.output, regions }));

function defaultRegions() {
  return [
    { x: 966, y: 232, w: 238, h: 26 },
    { x: 966, y: 352, w: 238, h: 26 },
    { x: 966, y: 472, w: 238, h: 26 },
    { x: 295, y: 604, w: 690, h: 84 },
  ];
}

function parseArgs(argv) {
  const parsed = { source: "", output: "", regions: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--source":
        parsed.source = argv[++index] ?? "";
        break;
      case "--output":
        parsed.output = argv[++index] ?? "";
        break;
      case "--regions":
        parsed.regions = argv[++index] ?? "";
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function parseRegions(value) {
  return value.split(";").map((entry) => {
    const [x, y, w, h] = entry.split(",").map(Number);
    if (![x, y, w, h].every(Number.isFinite)) {
      throw new Error(`Invalid region: ${entry}`);
    }
    return { x, y, w, h };
  });
}

function printHelp() {
  console.log(`Usage:
node tools/extract-scene-foreground.mjs \\
  --source public/assets/backgrounds/dungeon-workbench-permanent-bg-v4.png \\
  --output public/assets/scene/permanent-foreground-v4.png

Optional:
  --regions "x,y,w,h;x,y,w,h"`);
}
