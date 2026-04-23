const playwrightModule =
  process.env.PLAYWRIGHT_MODULE ??
  "/Users/zuozijian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const { chromium } = await import(playwrightModule);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") {
    errors.push(message.text());
  }
});

await page.goto(process.env.WEB_SMOKE_URL ?? "http://127.0.0.1:5173", { waitUntil: "networkidle" });
await page.waitForSelector("#game");

async function logicalPoint(x, y) {
  return page.$eval(
    "#game",
    (canvas, point) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: rect.left + (point.x / 1280) * rect.width,
        y: rect.top + (point.y / 760) * rect.height,
      };
    },
    { x, y },
  );
}

async function logicalClick(x, y) {
  const point = await logicalPoint(x, y);
  await page.mouse.click(point.x, point.y);
}

async function logicalDrag(fromX, fromY, toX, toY) {
  const from = await logicalPoint(fromX, fromY);
  const to = await logicalPoint(toX, toY);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

await logicalClick(336, 140);
await logicalDrag(521, 445, 753, 619);
const draftSnapshot = await page.evaluate(() => window.__backpackDebug?.());
if (!draftSnapshot?.items.some((item) => item.instance.x === 4 && item.instance.y === 4)) {
  throw new Error(
    `Expected drag to land in the visual bottom-right cell: ${JSON.stringify(draftSnapshot)}`,
  );
}
await logicalClick(754, 693);
await page.waitForTimeout(700);

const metrics = await page.evaluate(() => {
  const canvas = document.querySelector("#game");
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("Missing canvas.");
  }
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Missing 2D context.");
  }
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let brightPixels = 0;
  for (let index = 0; index < data.length; index += 4) {
    if (data[index] + data[index + 1] + data[index + 2] > 100) {
      brightPixels += 1;
    }
  }
  return {
    width: canvas.width,
    height: canvas.height,
    brightPixels,
  };
});
const snapshot = await page.evaluate(() => window.__backpackDebug?.());

await page.screenshot({ path: "tests/web-smoke.png", fullPage: true });
await browser.close();

if (errors.length > 0) {
  throw new Error(`Browser errors:\n${errors.join("\n")}`);
}
if (metrics.width !== 1280 || metrics.height !== 760 || metrics.brightPixels < 10000) {
  throw new Error(`Unexpected canvas metrics: ${JSON.stringify(metrics)}`);
}
if (!snapshot || snapshot.phase !== "battle" || snapshot.tick <= 0) {
  throw new Error(`Expected battle after reward and start clicks: ${JSON.stringify(snapshot)}`);
}

console.log(JSON.stringify({ ...metrics, phase: snapshot.phase, tick: snapshot.tick }));
