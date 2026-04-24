import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const playwrightModule =
  process.env.PLAYWRIGHT_MODULE ??
  "/Users/zuozijian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const { chromium } = await import(playwrightModule);

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.input || args.outputs.length === 0) {
  printHelp(args.help ? undefined : "Missing required --input or --outputs.");
  process.exit(args.help ? 0 : 1);
}

if (args.outputs.length !== args.rows) {
  throw new Error(`Expected ${args.rows} outputs, got ${args.outputs.length}.`);
}

const source = await readFile(args.input);
const dataUrl = `data:image/png;base64,${source.toString("base64")}`;
const browser = await chromium.launch();
const page = await browser.newPage();

const rows = await page.evaluate(
  async ({ imageUrl, columns, rows: rowCount, frameWidth, frameHeight }) => {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = imageUrl;
    });

    if (image.naturalWidth !== columns * rowCount * frameWidth) {
      throw new Error(
        `Expected width ${columns * rowCount * frameWidth}, got ${image.naturalWidth}.`,
      );
    }
    if (image.naturalHeight !== frameHeight) {
      throw new Error(`Expected height ${frameHeight}, got ${image.naturalHeight}.`);
    }

    const output = [];
    for (let row = 0; row < rowCount; row += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = columns * frameWidth;
      canvas.height = frameHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Missing row canvas context.");
      }
      context.drawImage(
        image,
        row * columns * frameWidth,
        0,
        columns * frameWidth,
        frameHeight,
        0,
        0,
        columns * frameWidth,
        frameHeight,
      );
      output.push(canvas.toDataURL("image/png").split(",")[1]);
    }
    return output;
  },
  {
    imageUrl: dataUrl,
    columns: args.columns,
    rows: args.rows,
    frameWidth: args.frameWidth,
    frameHeight: args.frameHeight,
  },
);

await browser.close();

for (let index = 0; index < rows.length; index += 1) {
  const output = args.outputs[index];
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, Buffer.from(rows[index], "base64"));
  console.log(`${args.input} row ${index + 1} -> ${output}`);
}

function parseArgs(argv) {
  const parsed = {
    input: "",
    outputs: [],
    columns: 4,
    rows: 4,
    frameWidth: 256,
    frameHeight: 256,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--input":
        parsed.input = argv[++index] ?? "";
        break;
      case "--outputs":
        index += 1;
        while (index < argv.length && !argv[index].startsWith("--")) {
          parsed.outputs.push(argv[index]);
          index += 1;
        }
        index -= 1;
        break;
      case "--columns":
        parsed.columns = Number(argv[++index] ?? parsed.columns);
        break;
      case "--rows":
        parsed.rows = Number(argv[++index] ?? parsed.rows);
        break;
      case "--frame-width":
        parsed.frameWidth = Number(argv[++index] ?? parsed.frameWidth);
        break;
      case "--frame-height":
        parsed.frameHeight = Number(argv[++index] ?? parsed.frameHeight);
        break;
      case "--help":
      case "-h":
        parsed.help = true;
        break;
      default:
        throw new Error(`Unknown argument ${arg}`);
    }
  }
  return parsed;
}

function printHelp(error) {
  if (error) {
    console.error(error);
    console.error("");
  }
  console.error(`Usage:
  node tools/split-strip-rows.mjs \\
    --input public/assets/actors/slime-actions-strip-16x256.png \\
    --outputs public/assets/actors/slime-idle-strip-4x256.png \\
      public/assets/actors/slime-attack-strip-4x256.png \\
      public/assets/actors/slime-hit-strip-4x256.png \\
      public/assets/actors/slime-death-strip-4x256.png`);
}
