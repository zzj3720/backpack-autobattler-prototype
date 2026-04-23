const playwrightModule =
  process.env.PLAYWRIGHT_MODULE ??
  "/Users/zuozijian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const { chromium } = await import(playwrightModule);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") {
    errors.push(message.text());
  }
});

await page.goto(process.env.WEB_SMOKE_URL ?? "http://127.0.0.1:5173", { waitUntil: "networkidle" });
await page.waitForSelector("#game");
await page.mouse.click(1070, 112);
await page.mouse.click(990, 160);
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
    brightPixels
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
