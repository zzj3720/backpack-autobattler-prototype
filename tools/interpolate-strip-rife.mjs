import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const playwrightModule =
  process.env.PLAYWRIGHT_MODULE ??
  "/Users/zuozijian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const { chromium } = await import(playwrightModule);

const args = parseArgs(process.argv.slice(2));

if (args.help || !args.input || !args.output || !args.rife || !args.model) {
  printHelp(args.help ? undefined : "Missing required arguments.");
  process.exit(args.help ? 0 : 1);
}

const frameWidth = Number(args.frameWidth ?? 256);
const frameHeight = Number(args.frameHeight ?? 256);
const explicitFrames = args.frames ? Number(args.frames) : null;
const sourcePath = resolve(args.input);
const outputPath = resolve(args.output);
const workDir = resolve(args.workDir ?? `.tools/rife-work/${basename(outputPath, ".png")}`);

await rm(workDir, { force: true, recursive: true });
await mkdir(workDir, { recursive: true });
await mkdir(dirname(outputPath), { recursive: true });

const sourceBytes = await readFile(sourcePath);
const dataUrl = `data:image/png;base64,${sourceBytes.toString("base64")}`;
const browser = await chromium.launch();
const page = await browser.newPage();

const split = await page.evaluate(
  async ({ imageUrl, frameWidth: fw, frameHeight: fh, explicitFrames: expectedFrames }) => {
    const image = new Image();
    await new Promise((resolveLoaded, reject) => {
      image.onload = resolveLoaded;
      image.onerror = reject;
      image.src = imageUrl;
    });

    if (image.naturalHeight !== fh) {
      throw new Error(`Expected strip height ${fh}, got ${image.naturalHeight}.`);
    }
    if (image.naturalWidth % fw !== 0) {
      throw new Error(`Expected strip width to be divisible by ${fw}, got ${image.naturalWidth}.`);
    }

    const sourceFrames = image.naturalWidth / fw;
    if (expectedFrames !== null && sourceFrames !== expectedFrames) {
      throw new Error(`Expected ${expectedFrames} frames, got ${sourceFrames}.`);
    }

    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = image.naturalWidth;
    sourceCanvas.height = image.naturalHeight;
    const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
    if (!sourceContext) {
      throw new Error("Missing source canvas context.");
    }
    sourceContext.drawImage(image, 0, 0);

    const frameCanvas = document.createElement("canvas");
    frameCanvas.width = fw;
    frameCanvas.height = fh;
    const frameContext = frameCanvas.getContext("2d", { willReadFrequently: true });
    if (!frameContext) {
      throw new Error("Missing frame canvas context.");
    }

    const colorCanvas = document.createElement("canvas");
    colorCanvas.width = fw;
    colorCanvas.height = fh;
    const colorContext = colorCanvas.getContext("2d", { willReadFrequently: true });
    if (!colorContext) {
      throw new Error("Missing color canvas context.");
    }

    const alphaCanvas = document.createElement("canvas");
    alphaCanvas.width = fw;
    alphaCanvas.height = fh;
    const alphaContext = alphaCanvas.getContext("2d", { willReadFrequently: true });
    if (!alphaContext) {
      throw new Error("Missing alpha canvas context.");
    }

    const originals = [];
    const colors = [];
    const alphas = [];
    for (let index = 0; index < sourceFrames; index += 1) {
      frameContext.clearRect(0, 0, fw, fh);
      frameContext.drawImage(sourceCanvas, index * fw, 0, fw, fh, 0, 0, fw, fh);
      const frameData = frameContext.getImageData(0, 0, fw, fh);
      originals.push(frameCanvas.toDataURL("image/png").split(",")[1]);

      const colorData = colorContext.createImageData(fw, fh);
      colorData.data.set(frameData.data);
      dilateTransparentRgb(colorData.data, fw, fh, 34);
      for (let pixel = 0; pixel < fw * fh; pixel += 1) {
        colorData.data[pixel * 4 + 3] = 255;
      }
      colorContext.putImageData(colorData, 0, 0);
      colors.push(colorCanvas.toDataURL("image/png").split(",")[1]);

      const alphaData = alphaContext.createImageData(fw, fh);
      for (let pixel = 0; pixel < fw * fh; pixel += 1) {
        const alpha = frameData.data[pixel * 4 + 3] ?? 0;
        alphaData.data[pixel * 4] = alpha;
        alphaData.data[pixel * 4 + 1] = alpha;
        alphaData.data[pixel * 4 + 2] = alpha;
        alphaData.data[pixel * 4 + 3] = 255;
      }
      alphaContext.putImageData(alphaData, 0, 0);
      alphas.push(alphaCanvas.toDataURL("image/png").split(",")[1]);
    }

    return { sourceFrames, targetFrames: sourceFrames * 2 - 1, originals, colors, alphas };

    function dilateTransparentRgb(data, width, height, iterations) {
      let visible = new Uint8Array(width * height);
      for (let pixel = 0; pixel < width * height; pixel += 1) {
        visible[pixel] = (data[pixel * 4 + 3] ?? 0) > 8 ? 1 : 0;
      }

      for (let iteration = 0; iteration < iterations; iteration += 1) {
        const nextVisible = visible.slice();
        const nextRgb = new Uint8ClampedArray(data);
        let changed = 0;
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const pixel = y * width + x;
            if (visible[pixel]) {
              continue;
            }
            let r = 0;
            let g = 0;
            let b = 0;
            let count = 0;
            for (let dy = -1; dy <= 1; dy += 1) {
              for (let dx = -1; dx <= 1; dx += 1) {
                if (dx === 0 && dy === 0) {
                  continue;
                }
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
                  continue;
                }
                const neighbor = ny * width + nx;
                if (!visible[neighbor]) {
                  continue;
                }
                const offset = neighbor * 4;
                r += data[offset] ?? 0;
                g += data[offset + 1] ?? 0;
                b += data[offset + 2] ?? 0;
                count += 1;
              }
            }
            if (count === 0) {
              continue;
            }
            const offset = pixel * 4;
            nextRgb[offset] = Math.round(r / count);
            nextRgb[offset + 1] = Math.round(g / count);
            nextRgb[offset + 2] = Math.round(b / count);
            nextVisible[pixel] = 1;
            changed += 1;
          }
        }
        data.set(nextRgb);
        visible = nextVisible;
        if (changed === 0) {
          break;
        }
      }
    }
  },
  { imageUrl: dataUrl, frameWidth, frameHeight, explicitFrames },
);

const colorInput = join(workDir, "color-in");
const alphaInput = join(workDir, "alpha-in");
const colorOutput = join(workDir, "color-out");
const alphaOutput = join(workDir, "alpha-out");
await mkdir(colorInput, { recursive: true });
await mkdir(alphaInput, { recursive: true });
await mkdir(colorOutput, { recursive: true });
await mkdir(alphaOutput, { recursive: true });

for (let index = 0; index < split.sourceFrames; index += 1) {
  const name = `${String(index + 1).padStart(8, "0")}.png`;
  await writeFile(join(colorInput, name), Buffer.from(split.colors[index], "base64"));
  await writeFile(join(alphaInput, name), Buffer.from(split.alphas[index], "base64"));
}

runRife({
  rifePath: resolve(args.rife),
  input: colorInput,
  output: colorOutput,
  targetFrames: split.targetFrames,
  model: resolve(args.model),
});
runRife({
  rifePath: resolve(args.rife),
  input: alphaInput,
  output: alphaOutput,
  targetFrames: split.targetFrames,
  model: resolve(args.model),
});

const colorFrames = [];
const alphaFrames = [];
for (let index = 0; index < split.targetFrames; index += 1) {
  const name = `${String(index + 1).padStart(8, "0")}.png`;
  if (index % 2 === 1) {
    colorFrames[index] = (await readFile(join(colorOutput, name))).toString("base64");
    alphaFrames[index] = (await readFile(join(alphaOutput, name))).toString("base64");
  }
}

const combined = await page.evaluate(
  async ({
    originals,
    colorFrames,
    alphaFrames,
    frameWidth: fw,
    frameHeight: fh,
    targetFrames,
  }) => {
    const output = document.createElement("canvas");
    output.width = fw * targetFrames;
    output.height = fh;
    const outputContext = output.getContext("2d", { willReadFrequently: true });
    if (!outputContext) {
      throw new Error("Missing output canvas context.");
    }

    for (let index = 0; index < targetFrames; index += 1) {
      if (index % 2 === 0) {
        const original = await loadImageFromBase64(originals[index / 2]);
        outputContext.drawImage(original, index * fw, 0);
        continue;
      }

      const colorImage = await loadImageFromBase64(colorFrames[index]);
      const alphaImage = await loadImageFromBase64(alphaFrames[index]);
      const frame = document.createElement("canvas");
      frame.width = fw;
      frame.height = fh;
      const frameContext = frame.getContext("2d", { willReadFrequently: true });
      if (!frameContext) {
        throw new Error("Missing combine frame context.");
      }
      frameContext.drawImage(colorImage, 0, 0);
      const colorData = frameContext.getImageData(0, 0, fw, fh);
      frameContext.clearRect(0, 0, fw, fh);
      frameContext.drawImage(alphaImage, 0, 0);
      const alphaData = frameContext.getImageData(0, 0, fw, fh);

      for (let pixel = 0; pixel < fw * fh; pixel += 1) {
        const offset = pixel * 4;
        const alpha = Math.round(
          ((alphaData.data[offset] ?? 0) +
            (alphaData.data[offset + 1] ?? 0) +
            (alphaData.data[offset + 2] ?? 0)) /
            3,
        );
        const cleanedAlpha = alpha <= 3 ? 0 : alpha >= 252 ? 255 : alpha;
        colorData.data[offset + 3] = cleanedAlpha;
        if (cleanedAlpha === 0) {
          colorData.data[offset] = 0;
          colorData.data[offset + 1] = 0;
          colorData.data[offset + 2] = 0;
        }
      }
      frameContext.putImageData(colorData, 0, 0);
      outputContext.drawImage(frame, index * fw, 0);
    }

    return output.toDataURL("image/png").split(",")[1];

    async function loadImageFromBase64(base64) {
      const image = new Image();
      await new Promise((resolveLoaded, reject) => {
        image.onload = resolveLoaded;
        image.onerror = reject;
        image.src = `data:image/png;base64,${base64}`;
      });
      return image;
    }
  },
  {
    originals: split.originals,
    colorFrames,
    alphaFrames,
    frameWidth,
    frameHeight,
    targetFrames: split.targetFrames,
  },
);

await browser.close();
await writeFile(outputPath, Buffer.from(combined, "base64"));
if (!args.keepWork) {
  await rm(workDir, { force: true, recursive: true });
}
console.log(`${sourcePath} -> ${outputPath} (${split.sourceFrames} -> ${split.targetFrames})`);

function runRife({ rifePath, input, output, targetFrames, model }) {
  const result = spawnSync(
    rifePath,
    ["-i", input, "-o", output, "-n", String(targetFrames), "-m", model, "-f", "png"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  if (result.status !== 0) {
    throw new Error(
      [`RIFE failed for ${input}`, result.stdout.trim(), result.stderr.trim()]
        .filter(Boolean)
        .join("\n"),
    );
  }
}

function parseArgs(argv) {
  const parsed = { keepWork: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--keep-work") {
      parsed.keepWork = true;
      continue;
    }
    if (!arg.startsWith("--")) {
      throw new Error(`Unknown argument ${arg}`);
    }
    const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    parsed[key] = value;
    index += 1;
  }
  return parsed;
}

function printHelp(error) {
  if (error) {
    console.error(error);
  }
  console.log(`Usage: node tools/interpolate-strip-rife.mjs \\
  --input public/assets/actors/hero-attack-strip-24x256.png \\
  --output public/assets/actors/hero-attack-strip-47x256.png \\
  --frames 24 \\
  --frame-width 256 \\
  --frame-height 256 \\
  --rife .tools/rife/rife-ncnn-vulkan-20221029-macos/rife-ncnn-vulkan \\
  --model .tools/rife/rife-ncnn-vulkan-20221029-macos/rife-v4.6`);
}
