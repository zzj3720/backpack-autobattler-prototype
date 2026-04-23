import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const playwrightModule =
  process.env.PLAYWRIGHT_MODULE ??
  "/Users/zuozijian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const { chromium } = await import(playwrightModule);

const source = "apps/web/assets/sprites/generated-sheet.png";
const columns = 4;
const rows = 6;
const size = 128;

const cells = [
  ["items/rusty_blade.png", "items/wooden_shield.png", "items/poison_vial.png", "items/spark_stone.png"],
  ["items/lucky_coin.png", "items/iron_dagger.png", "items/gear_spring.png", "items/oil_lamp.png"],
  ["items/thorn_bark.png", "items/jade_leaf.png", "items/war_drum.png", "items/mirror_shard.png"],
  ["items/blood_contract.png", "items/bone_ring.png", "items/phoenix_ember.png", "items/black_star.png"],
  ["actors/hero.png", "actors/slime.png", "actors/rat.png", "actors/imp.png"],
  ["actors/brute.png", "actors/boss.png", "ui/empty_slot.png", "ui/reward_chest.png"]
];

const sourceBytes = await readFile(source);
const dataUrl = `data:image/png;base64,${sourceBytes.toString("base64")}`;
const browser = await chromium.launch();
const page = await browser.newPage();
const sprites = await page.evaluate(
  async ({ dataUrl: imageUrl, cells: spriteCells, columns: columnCount, rows: rowCount, size: spriteSize }) => {
    const image = new Image();
    const loaded = new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });
    image.src = imageUrl;
    await loaded;

    const cellWidth = image.naturalWidth / columnCount;
    const cellHeight = image.naturalHeight / rowCount;
    const canvas = document.createElement("canvas");
    canvas.width = spriteSize;
    canvas.height = spriteSize;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Missing canvas context.");
    }

    const outputs = [];
    for (let row = 0; row < rowCount; row += 1) {
      for (let column = 0; column < columnCount; column += 1) {
        context.clearRect(0, 0, spriteSize, spriteSize);
        context.imageSmoothingQuality = "high";
        context.drawImage(
          image,
          column * cellWidth,
          row * cellHeight,
          cellWidth,
          cellHeight,
          0,
          0,
          spriteSize,
          spriteSize
        );
        outputs.push({
          output: spriteCells[row][column],
          dataUrl: canvas.toDataURL("image/png")
        });
      }
    }
    return outputs;
  },
  { dataUrl, cells, columns, rows, size }
);
await browser.close();

for (const sprite of sprites) {
  const output = join("apps/web/assets/sprites", sprite.output);
  await mkdir(dirname(output), { recursive: true });
  const base64 = sprite.dataUrl.split(",")[1];
  await writeFile(output, Buffer.from(base64, "base64"));
}

console.log(`Cut ${sprites.length} sprites from generated-sheet.png`);
