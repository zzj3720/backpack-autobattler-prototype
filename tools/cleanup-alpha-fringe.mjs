import { readFile, writeFile } from "node:fs/promises";

const playwrightModule =
  process.env.PLAYWRIGHT_MODULE ??
  "/Users/zuozijian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const { chromium } = await import(playwrightModule);

const args = parseArgs(process.argv.slice(2));
if (args.help || args.inputs.length === 0) {
  printHelp();
  process.exit(args.inputs.length === 0 ? 1 : 0);
}

const browser = await chromium.launch();
const page = await browser.newPage();

for (const input of args.inputs) {
  const sourceBytes = await readFile(input);
  const dataUrl = `data:image/png;base64,${sourceBytes.toString("base64")}`;
  const result = await page.evaluate(
    async ({ imageUrl, radius, threshold, edgeAlphaDrop }) => {
      const image = new Image();
      const loaded = new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
      });
      image.src = imageUrl;
      await loaded;

      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Missing canvas context.");
      }
      context.drawImage(image, 0, 0);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const { data } = imageData;
      const alpha = new Uint8ClampedArray(canvas.width * canvas.height);
      for (let index = 0; index < alpha.length; index += 1) {
        alpha[index] = data[index * 4 + 3];
      }

      let changed = 0;
      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          const pixel = y * canvas.width + x;
          const offset = pixel * 4;
          if (
            alpha[pixel] === 0 ||
            !isEdgePixel(alpha, canvas.width, canvas.height, x, y, radius)
          ) {
            continue;
          }

          const beforeR = data[offset];
          const beforeG = data[offset + 1];
          const beforeB = data[offset + 2];
          const cleaned = despillEdgeColor(beforeR, beforeG, beforeB, threshold);
          data[offset] = cleaned[0];
          data[offset + 1] = cleaned[1];
          data[offset + 2] = cleaned[2];

          if (cleaned[3] && alpha[pixel] < 248) {
            data[offset + 3] = Math.max(0, Math.round(alpha[pixel] * edgeAlphaDrop));
          }

          if (
            beforeR !== data[offset] ||
            beforeG !== data[offset + 1] ||
            beforeB !== data[offset + 2] ||
            alpha[pixel] !== data[offset + 3]
          ) {
            changed += 1;
          }
        }
      }

      context.putImageData(imageData, 0, 0);
      return {
        changed,
        dataUrl: canvas.toDataURL("image/png"),
      };

      function isEdgePixel(alpha, width, height, x, y, radius) {
        if (alpha[y * width + x] < 245) {
          return true;
        }
        for (let dy = -radius; dy <= radius; dy += 1) {
          for (let dx = -radius; dx <= radius; dx += 1) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
              return true;
            }
            if (alpha[ny * width + nx] < 12) {
              return true;
            }
          }
        }
        return false;
      }

      function despillEdgeColor(r, g, b, threshold) {
        let changed = false;
        const channels = [r, g, b];
        const keys = [
          { high: [1], protected: [0, 2] },
          { high: [0], protected: [1, 2] },
          { high: [2], protected: [0, 1] },
          { high: [0, 2], protected: [1] },
          { high: [1, 2], protected: [0] },
        ];

        for (const key of keys) {
          const protectedMax = Math.max(...key.protected.map((index) => channels[index]));
          const highMin = Math.min(...key.high.map((index) => channels[index]));
          if (highMin <= protectedMax + threshold) {
            continue;
          }
          for (const index of key.high) {
            channels[index] = Math.min(channels[index], protectedMax + 4);
          }
          changed = true;
        }
        return [channels[0], channels[1], channels[2], changed];
      }
    },
    {
      imageUrl: dataUrl,
      radius: args.radius,
      threshold: args.threshold,
      edgeAlphaDrop: args.edgeAlphaDrop,
    },
  );
  await writeFile(input, Buffer.from(result.dataUrl.split(",", 2)[1], "base64"));
  console.log(JSON.stringify({ input, changed: result.changed }));
}

await browser.close();

function parseArgs(argv) {
  const options = {
    inputs: [],
    radius: 2,
    threshold: 18,
    edgeAlphaDrop: 0.7,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--radius":
        options.radius = Number(argv[++index] ?? options.radius);
        break;
      case "--threshold":
        options.threshold = Number(argv[++index] ?? options.threshold);
        break;
      case "--edge-alpha-drop":
        options.edgeAlphaDrop = Number(argv[++index] ?? options.edgeAlphaDrop);
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        options.inputs.push(arg);
        break;
    }
  }
  return options;
}

function printHelp() {
  console.error(`Usage:
  node tools/cleanup-alpha-fringe.mjs [--radius 2] [--threshold 18] [--edge-alpha-drop 0.7] <png...>

Removes chroma-key color spill from pixels near the transparent alpha edge of
already-cut PNG assets. This is intended for generated game sprites and UI
assets with green, red, blue, cyan, or magenta edge halos.`);
}
