const playwrightModule =
  process.env.PLAYWRIGHT_MODULE ??
  "/Users/zuozijian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const { chromium } = await import(playwrightModule);

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 844, height: 390 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
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

async function pointer(type, x, y, buttons = 1) {
  const point = await logicalPoint(x, y);
  await page.$eval(
    "#game",
    (canvas, eventInit) => {
      canvas.dispatchEvent(
        new PointerEvent(eventInit.type, {
          bubbles: true,
          cancelable: true,
          pointerId: 7,
          pointerType: "touch",
          isPrimary: true,
          clientX: eventInit.x,
          clientY: eventInit.y,
          buttons: eventInit.buttons,
        }),
      );
    },
    { type, x: point.x, y: point.y, buttons },
  );
}

async function tap(x, y) {
  await pointer("pointerdown", x, y, 1);
  await pointer("pointerup", x, y, 0);
}

async function drag(fromX, fromY, toX, toY) {
  await pointer("pointerdown", fromX, fromY, 1);
  for (let step = 1; step <= 8; step += 1) {
    const ratio = step / 8;
    await pointer("pointermove", fromX + (toX - fromX) * ratio, fromY + (toY - fromY) * ratio, 1);
  }
  await pointer("pointerup", toX, toY, 0);
}

await tap(336, 140);
await drag(521, 445, 753, 619);
const draftSnapshot = await page.evaluate(() => window.__backpackDebug?.());
if (!draftSnapshot?.items.some((item) => item.instance.x === 4 && item.instance.y === 4)) {
  throw new Error(
    `Expected touch drag to land in bottom-right cell: ${JSON.stringify(draftSnapshot)}`,
  );
}
await tap(754, 693);
await page.waitForTimeout(500);

const metrics = await page.evaluate(() => {
  const canvas = document.querySelector("#game");
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("Missing canvas.");
  }
  const viewport = document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? "";
  const computedCanvas = getComputedStyle(canvas);
  const computedBody = getComputedStyle(document.body);
  return {
    width: canvas.width,
    height: canvas.height,
    viewport,
    canvasTouchAction: computedCanvas.touchAction,
    bodyTouchAction: computedBody.touchAction,
    bodyOverflow: computedBody.overflow,
  };
});
const snapshot = await page.evaluate(() => window.__backpackDebug?.());

await page.screenshot({ path: "tests/mobile-smoke.png", fullPage: true });
await context.close();
await browser.close();

if (errors.length > 0) {
  throw new Error(`Browser errors:\n${errors.join("\n")}`);
}
if (
  !metrics.viewport.includes("user-scalable=no") ||
  !metrics.viewport.includes("maximum-scale=1")
) {
  throw new Error(`Viewport zoom is not disabled: ${JSON.stringify(metrics)}`);
}
if (
  metrics.canvasTouchAction !== "none" ||
  metrics.bodyTouchAction !== "none" ||
  metrics.bodyOverflow !== "hidden"
) {
  throw new Error(`Unexpected mobile touch CSS: ${JSON.stringify(metrics)}`);
}
if (metrics.width < 1280 || metrics.height < 760) {
  throw new Error(`Unexpected canvas backing size: ${JSON.stringify(metrics)}`);
}
if (!snapshot || snapshot.phase !== "battle" || snapshot.tick <= 0) {
  throw new Error(`Expected battle after touch reward and start: ${JSON.stringify(snapshot)}`);
}

console.log(JSON.stringify({ ...metrics, phase: snapshot.phase, tick: snapshot.tick }));
