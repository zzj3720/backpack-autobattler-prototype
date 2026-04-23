import {
  GRID_HEIGHT,
  GRID_WIDTH,
  createGame,
  dispatchCommand,
  querySnapshot,
  tickGame,
  type GameSnapshot,
  type GameState,
  type EffectDef,
  type ItemDef,
  type ItemSnapshot,
  type Rarity,
  type Stats,
} from "../../../packages/core/src/index.ts";
import "./style.css";

const WIDTH = 1280;
const HEIGHT = 760;
const BAG_SOURCE_W = 421;
const BAG_SOURCE_H = 466;
const BAG_GRID_SOURCE_X = 80;
const BAG_GRID_SOURCE_Y = 120;
const BAG_GRID_SOURCE_CELL = 52;
const BAG_SCALE = 520 / BAG_SOURCE_H;
const CELL = Math.round(BAG_GRID_SOURCE_CELL * BAG_SCALE);
const BAG_H = 520;
const BAG_W = Math.round(BAG_H * (BAG_SOURCE_W / BAG_SOURCE_H));
const BAG_X = (WIDTH - BAG_W) / 2;
const BAG_OPEN_Y = 226;
const BAG_CLOSED_Y = 690;
const REWARD_CARD_W = 288;
const REWARD_CARD_H = 72;
const REWARD_CARD_GAP = 16;

const rarityLabel: Record<Rarity, string> = {
  common: "普通",
  uncommon: "优秀",
  rare: "稀有",
  epic: "史诗",
};

const statLabel: Record<keyof Stats, string> = {
  maxHp: "生命",
  attack: "攻击",
  attackSpeed: "攻速",
  armor: "护甲",
  regen: "回复",
  burn: "燃烧",
  poison: "毒",
  thorns: "反伤",
  critChance: "暴击",
};

const tagLabel: Record<string, string> = {
  weapon: "武器",
  metal: "金属",
  shield: "盾牌",
  wood: "木质",
  poison: "毒系",
  alchemy: "炼金",
  fire: "火系",
  stone: "石质",
  trinket: "饰品",
  machine: "机械",
  nature: "自然",
  sound: "声响",
  glass: "玻璃",
  curse: "诅咒",
};

const spriteBase = "/assets/sprites";
const itemSprites: Record<string, string> = {
  rusty_blade: `${spriteBase}/items/rusty_blade.png`,
  wooden_shield: `${spriteBase}/items/wooden_shield.png`,
  poison_vial: `${spriteBase}/items/poison_vial.png`,
  spark_stone: `${spriteBase}/items/spark_stone.png`,
  lucky_coin: `${spriteBase}/items/lucky_coin.png`,
  iron_dagger: `${spriteBase}/items/iron_dagger.png`,
  gear_spring: `${spriteBase}/items/gear_spring.png`,
  oil_lamp: `${spriteBase}/items/oil_lamp.png`,
  thorn_bark: `${spriteBase}/items/thorn_bark.png`,
  jade_leaf: `${spriteBase}/items/jade_leaf.png`,
  war_drum: `${spriteBase}/items/war_drum.png`,
  mirror_shard: `${spriteBase}/items/mirror_shard.png`,
  blood_contract: `${spriteBase}/items/blood_contract.png`,
  bone_ring: `${spriteBase}/items/bone_ring.png`,
  phoenix_ember: `${spriteBase}/items/phoenix_ember.png`,
  black_star: `${spriteBase}/items/black_star.png`,
};
const actorSprites: Record<string, string> = {
  hero: `${spriteBase}/actors/hero.png`,
  slime: `${spriteBase}/actors/slime.png`,
  rat: `${spriteBase}/actors/rat.png`,
  imp: `${spriteBase}/actors/imp.png`,
  brute: `${spriteBase}/actors/brute.png`,
  boss: `${spriteBase}/actors/boss.png`,
};
const backgroundSprite = "/assets/backgrounds/dungeon-workbench.png";
const uiBase = "/assets/ui";
const uiSprites = {
  bagOpen: `${uiBase}/bag-open.png`,
  bagClosed: `${uiBase}/bag-closed.png`,
  rewardCard: `${uiBase}/reward-card.png`,
  tooltipParchment: `${uiBase}/tooltip-parchment.png`,
  buttonNormal: `${uiBase}/button-normal.png`,
  buttonPressed: `${uiBase}/button-pressed.png`,
  buttonDisabled: `${uiBase}/button-disabled.png`,
  smallSeal: `${uiBase}/small-seal.png`,
  inventorySlot: `${uiBase}/inventory-slot.png`,
  frameCommon: `${uiBase}/frame-common.png`,
  frameRare: `${uiBase}/frame-rare.png`,
  battleLedger: `${uiBase}/battle-ledger.png`,
};
const rewardCardSprites: Record<Rarity, { normal: string; hover: string }> = {
  common: {
    normal: `${uiBase}/reward-card-common.png`,
    hover: `${uiBase}/reward-card-common-hover.png`,
  },
  uncommon: {
    normal: `${uiBase}/reward-card-uncommon.png`,
    hover: `${uiBase}/reward-card-uncommon-hover.png`,
  },
  rare: {
    normal: `${uiBase}/reward-card-rare.png`,
    hover: `${uiBase}/reward-card-rare-hover.png`,
  },
  epic: {
    normal: `${uiBase}/reward-card-epic.png`,
    hover: `${uiBase}/reward-card-epic-hover.png`,
  },
};
const spriteCache = new Map<string, HTMLImageElement>();

interface HitZone {
  x: number;
  y: number;
  w: number;
  h: number;
  onClick: () => void;
}

interface Point {
  x: number;
  y: number;
}

const canvas = document.querySelector<HTMLCanvasElement>("#game");
if (!canvas) {
  throw new Error("Missing #game canvas.");
}
const ctx = canvas.getContext("2d");
if (!ctx) {
  throw new Error("Canvas 2D context is unavailable.");
}
let canvasScale = 1;

let state: GameState = createGame(dailySeed());
let snapshot: GameSnapshot = querySnapshot(state);
let paused = false;
let lastFrame = performance.now();
let accumulatorMs = 0;
let draggingItemId: string | null = null;
let pointer: Point = { x: 0, y: 0 };
let hitZones: HitZone[] = [];
let battleBannerUntilMs = 0;
let backpackVisualY = BAG_OPEN_Y;
const debugWindow = window as typeof window & {
  __backpackDebug?: () => GameSnapshot;
  __backpackDebugForceResult?: (phase?: "victory" | "defeat") => GameSnapshot;
};
debugWindow.__backpackDebug = () => querySnapshot(state);
if (import.meta.env.DEV) {
  debugWindow.__backpackDebugForceResult = (phase = "victory") => {
    state.phase = phase;
    state.endReason = phase === "victory" ? "调试结算：击败深渊核心" : "调试结算：倒在矿坑深处";
    state.totals.kills = Math.max(state.totals.kills, phase === "victory" ? 38 : 9);
    state.totals.damageDone = Math.max(state.totals.damageDone, phase === "victory" ? 8420 : 1560);
    state.enemies = [];
    paused = true;
    backpackVisualY = BAG_CLOSED_Y;
    render();
    return querySnapshot(state);
  };
}
syncCanvasScale();
preloadSprites();

canvas.addEventListener("pointerdown", (event) => {
  pointer = pointerFromEvent(event);

  const item = itemAt(pointer.x, pointer.y);
  if (item && state.phase === "draft") {
    draggingItemId = item.instance.id;
    canvas.setPointerCapture(event.pointerId);
    return;
  }

  const hit = hitZones.find((zone) => inside(pointer, zone));
  if (hit) {
    hit.onClick();
    render();
  }
});

canvas.addEventListener("pointermove", (event) => {
  pointer = pointerFromEvent(event);
});

canvas.addEventListener("pointerup", (event) => {
  pointer = pointerFromEvent(event);
  if (draggingItemId) {
    const cell = pointerToCell(pointer.x, pointer.y);
    if (cell) {
      state = dispatchCommand(state, {
        type: "moveItem",
        instanceId: draggingItemId,
        x: cell.x,
        y: cell.y,
      });
    }
    draggingItemId = null;
    canvas.releasePointerCapture(event.pointerId);
    render();
  }
});

window.addEventListener("resize", () => {
  syncCanvasScale();
  render();
});

requestAnimationFrame(frame);

function frame(now: number): void {
  const delta = Math.min(120, now - lastFrame);
  lastFrame = now;

  if (!paused && state.phase === "battle") {
    accumulatorMs += delta;
    while (accumulatorMs >= 50) {
      tickGame(state, 50);
      accumulatorMs -= 50;
    }
  }

  const targetBagY = state.phase === "draft" ? BAG_OPEN_Y : BAG_CLOSED_Y;
  backpackVisualY += (targetBagY - backpackVisualY) * Math.min(1, delta / 170);
  if (Math.abs(backpackVisualY - targetBagY) < 0.5) {
    backpackVisualY = targetBagY;
  }

  render();
  requestAnimationFrame(frame);
}

function render(): void {
  syncCanvasScale();
  snapshot = querySnapshot(state);
  hitZones = [];
  const hoveredItem =
    !draggingItemId && snapshot.phase === "draft" ? itemAt(pointer.x, pointer.y) : null;
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawBackground();
  drawHeader();
  drawArena();
  drawRewardChoices();
  drawBackpack(hoveredItem);
  drawSidePanel();
  if (hoveredItem) {
    drawItemTooltip(hoveredItem);
  }
  drawGhost();
}

function syncCanvasScale(): void {
  const ratio = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  if (
    canvasScale === ratio &&
    canvas.width === Math.round(WIDTH * ratio) &&
    canvas.height === Math.round(HEIGHT * ratio)
  ) {
    return;
  }
  canvasScale = ratio;
  canvas.width = Math.round(WIDTH * ratio);
  canvas.height = Math.round(HEIGHT * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
}

function drawBackground(): void {
  if (drawBackgroundImage()) {
    ctx.fillStyle = "rgba(4, 8, 9, 0.12)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const vignette = ctx.createRadialGradient(
      WIDTH * 0.48,
      HEIGHT * 0.43,
      140,
      WIDTH * 0.48,
      HEIGHT * 0.43,
      760,
    );
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.54)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  } else {
    const floor = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    floor.addColorStop(0, "#111819");
    floor.addColorStop(0.45, "#151611");
    floor.addColorStop(1, "#080d0e");
    ctx.fillStyle = floor;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    drawStoneFloor();
    drawWorkbench();
  }
}

function drawBackgroundImage(): boolean {
  const image = spriteCache.get(backgroundSprite);
  if (!image?.complete || image.naturalWidth === 0) {
    return false;
  }

  const scale = Math.max(WIDTH / image.naturalWidth, HEIGHT / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  ctx.drawImage(image, (WIDTH - drawWidth) / 2, (HEIGHT - drawHeight) / 2, drawWidth, drawHeight);
  return true;
}

function drawStoneFloor(): void {
  ctx.strokeStyle = "rgba(87, 110, 108, 0.16)";
  ctx.lineWidth = 1;
  for (let y = 22; y < HEIGHT; y += 58) {
    line(0, y, WIDTH, y + 20);
  }
  for (let x = -80; x < WIDTH; x += 92) {
    line(x, 0, x + 250, HEIGHT);
  }

  ctx.fillStyle = "rgba(93, 79, 55, 0.16)";
  for (let index = 0; index < 16; index += 1) {
    const x = (index * 173) % WIDTH;
    const y = 78 + ((index * 97) % 590);
    roundRect(x, y, 34 + (index % 3) * 12, 3, 2, true);
  }
}

function drawWorkbench(): void {
  const table = ctx.createLinearGradient(0, 52, 0, 698);
  table.addColorStop(0, "rgba(39, 31, 22, 0.34)");
  table.addColorStop(1, "rgba(20, 17, 13, 0.48)");
  ctx.fillStyle = table;
  roundRect(18, 52, WIDTH - 36, 646, 10, true);

  ctx.strokeStyle = "rgba(143, 111, 70, 0.18)";
  ctx.lineWidth = 2;
  for (let x = 28; x < WIDTH - 28; x += 88) {
    line(x, 58, x + 132, 692);
  }
}

function drawHeader(): void {
  text("背包构筑自动战斗", 54, 30, 29, "#f3d18a", "left", '"Songti SC", Georgia, serif');
  drawSmallSeal(WIDTH / 2 - 128, 28, 256, `第 ${snapshot.waveIndex + 1} 波 · ${snapshot.waveName}`);
  drawSmallSeal(WIDTH - 248, 28, 190, `纹章 ${snapshot.shareCode}`);
}

function drawBackpack(hoveredItem: ItemSnapshot | null): void {
  const bagY = backpackVisualY;
  const open = snapshot.phase === "draft";
  drawBackpackBody(BAG_X, bagY, BAG_W, BAG_H, open);

  if (!open) {
    text("行囊已收起", BAG_X + BAG_W / 2, bagY + 22, 15, "#d6c5a1", "center");
    return;
  }

  const origin = gridOrigin();
  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      if (!itemAtCell(x, y)) {
        drawCellEmptyState(origin.x + x * CELL, origin.y + y * CELL);
      }
    }
  }

  if (hoveredItem) {
    drawItemLinkHighlights(hoveredItem);
  }

  for (const item of snapshot.items) {
    const px = origin.x + item.instance.x * CELL + 2;
    const py = origin.y + item.instance.y * CELL + 2;
    const frameSprite =
      item.def.rarity === "rare" || item.def.rarity === "epic"
        ? uiSprites.frameRare
        : uiSprites.frameCommon;
    drawSprite(frameSprite, px - 2, py - 2, CELL - 4, CELL - 4, 0);
    if (hoveredItem?.instance.id === item.instance.id) {
      ctx.strokeStyle = "#f3d18a";
      ctx.lineWidth = 3;
      roundRect(px - 1, py - 1, CELL - 6, CELL - 6, 5, false);
    }
    if (!drawSprite(itemSprites[item.def.id], px + 7, py + 7, CELL - 20, CELL - 20, 5)) {
      text(item.def.symbol, px + 27, py + 16, 18, "#fff7d6", "center", "monospace");
    }
    ctx.fillStyle = "rgba(16, 10, 7, 0.78)";
    roundRect(px + 4, py + CELL - 21, CELL - 16, 12, 4, true);
    text(item.def.name.slice(0, 3), px + CELL / 2 - 2, py + CELL - 21, 10, "#ffe6aa", "center");
  }

  drawPlayerStatusPanel(42, 432, 330, 250);
}

function drawItemLinkHighlights(item: ItemSnapshot): void {
  const itemCenter = cellCenter(item.instance.x, item.instance.y);
  const activeTargets = new Set<string>();
  const candidateTargets = new Set<string>();

  for (const effect of item.def.effects) {
    for (const target of effectTargetCells(item, effect)) {
      if (target.active) {
        activeTargets.add(`${target.x},${target.y}`);
      } else {
        candidateTargets.add(`${target.x},${target.y}`);
      }
    }
  }

  for (const key of candidateTargets) {
    if (activeTargets.has(key)) {
      continue;
    }
    const [x, y] = key.split(",").map(Number) as [number, number];
    strokeCell(x, y, "#3f5660", 2);
  }

  for (const key of activeTargets) {
    const [x, y] = key.split(",").map(Number) as [number, number];
    const targetCenter = cellCenter(x, y);
    ctx.strokeStyle = "#f3d18a";
    ctx.lineWidth = 3;
    line(itemCenter.x, itemCenter.y, targetCenter.x, targetCenter.y);
    strokeCell(x, y, "#f3d18a", 4);
  }
}

function drawRewardChoices(): void {
  if (snapshot.phase !== "draft" || snapshot.rewards.length === 0) {
    return;
  }

  const y = BAG_OPEN_Y - 122;
  const totalW =
    REWARD_CARD_W * snapshot.rewards.length + REWARD_CARD_GAP * (snapshot.rewards.length - 1);
  let x = (WIDTH - totalW) / 2;
  text("选择一件战利品", WIDTH / 2, y - 34, 22, "#f3d18a", "center", '"Songti SC", Georgia, serif');
  for (const reward of snapshot.rewards) {
    rewardCard(x, y, reward);
    x += REWARD_CARD_W + REWARD_CARD_GAP;
  }
}

function drawArena(): void {
  drawSceneGround();
  drawPlayer(210, 360);
  drawEnemies();
  drawBattleBanner();
  if (snapshot.phase !== "draft") {
    text(phaseLabel(), WIDTH / 2, 78, 16, "#d6c5a1", "center");
  }
}

function drawBattleBanner(): void {
  if (snapshot.phase !== "battle" || performance.now() > battleBannerUntilMs) {
    return;
  }
  const alpha = Math.max(0, Math.min(1, (battleBannerUntilMs - performance.now()) / 850));
  ctx.save();
  ctx.globalAlpha = alpha;
  drawNinePatch(uiSprites.smallSeal, WIDTH / 2 - 78, 102, 156, 40, 28);
  text("战鼓已响", WIDTH / 2, 112, 18, "#f3d18a", "center");
  ctx.restore();
}

function drawPlayer(x: number, y: number): void {
  drawActorShadow(x, y + 98, 168, 34);
  if (!drawActorSprite(actorSprites.hero, x - 88, y - 96, 176, 176)) {
    text("HERO", x, y - 9, 13, "#f7fbff", "center");
  }
  drawBar(x - 64, y + 94, 128, 9, snapshot.player.hp / snapshot.player.maxHp, "#5bd48a");
  text(
    `${Math.ceil(snapshot.player.hp)} / ${Math.ceil(snapshot.player.maxHp)}`,
    x,
    y + 108,
    12,
    "#d6c5a1",
    "center",
  );
}

function drawEnemies(): void {
  const laneCounts = [0, 0, 0];
  if (snapshot.enemies.length === 0) {
    drawActorShadow(1010, 448, 170, 34);
    text("矿坑深处", 1010, 354, 16, "#7d8f8d", "center");
    return;
  }

  for (const enemy of snapshot.enemies) {
    const laneIndex = Math.max(0, Math.min(2, enemy.instance.lane));
    const order = laneCounts[laneIndex] ?? 0;
    laneCounts[laneIndex] = order + 1;
    const x = 925 + order * 100;
    const y = 270 + laneIndex * 118;
    const spriteId = enemy.def.spriteId ?? enemy.def.id;
    const size = spriteId === "boss" ? 158 : 116;
    drawActorShadow(x, y + size * 0.42, size, 22);
    if (!drawActorSprite(actorSprites[spriteId], x - size / 2, y - size / 2, size, size)) {
      text(enemy.def.symbol, x, y - 10, 13, "#fff4df", "center", "monospace");
    }
    drawBar(x - size / 2, y + size * 0.48, size, 7, enemy.instance.hp / enemy.def.maxHp, "#cf4e4e");
  }
}

function drawSidePanel(): void {
  if (snapshot.phase === "draft") {
    const y = backpackVisualY + BAG_H - 74;
    button(BAG_X + BAG_W - 206, y, 170, 42, "敲响战鼓", () => {
      const phaseBefore = state.phase;
      state = dispatchCommand(state, { type: "startBattle" });
      if (phaseBefore === "draft" && state.phase === "battle") {
        paused = false;
        battleBannerUntilMs = performance.now() + 850;
      }
    });
    button(BAG_X + 36, y + 2, 142, 38, "重启远征", restartRun);
  } else if (snapshot.phase === "battle") {
    button(
      BAG_X + BAG_W - 206,
      backpackVisualY + 18,
      170,
      38,
      paused ? "转动沙漏" : "凝住沙漏",
      () => {
        paused = !paused;
      },
    );
  } else {
    button(BAG_X + BAG_W - 206, backpackVisualY + 18, 170, 38, "重启远征", restartRun);
  }

  if (snapshot.phase === "victory" || snapshot.phase === "defeat") {
    drawResultCard();
    return;
  }

  if (snapshot.phase === "battle") {
    drawBattleLedger();
  }
}

function restartRun(): void {
  state = dispatchCommand(state, { type: "restart", seed: randomSeed() });
  paused = false;
  backpackVisualY = BAG_OPEN_Y;
}

function drawBattleLedger(): void {
  const x = 76;
  const y = 112;
  text("战绩", x, y, 18, "#f3d18a", "left", '"Songti SC", Georgia, serif');
  text(`击杀 ${snapshot.totals.kills}`, x, y + 30, 14, "#d6c5a1");
  text(`伤害 ${Math.round(snapshot.totals.damageDone)}`, x, y + 52, 14, "#d6c5a1");
  for (const lineText of snapshot.log.slice(-2)) {
    wrapText(lineText, x, y + 82, 230, 18, 12, "#aeb8ad");
  }
}

function rewardCard(x: number, y: number, item: ItemDef): void {
  const hovered =
    pointer.x >= x &&
    pointer.x <= x + REWARD_CARD_W &&
    pointer.y >= y &&
    pointer.y <= y + REWARD_CARD_H;
  const cardSprite = rewardCardSprites[item.rarity];
  drawSprite(hovered ? cardSprite.hover : cardSprite.normal, x, y, REWARD_CARD_W, REWARD_CARD_H, 0);
  drawSprite(itemSprites[item.id], x + 17, y + 12, 48, 48, 5);
  text(item.name, x + 86, y + 11, 15, "#f5f0dc");
  text(`${rarityLabel[item.rarity]} | ${rewardStatSummary(item)}`, x + 86, y + 31, 12, "#9cb4bd");
  wrapText(rewardEffectSummary(item), x + 86, y + 49, 168, 14, 11, "#f3d18a");
  hitZones.push({
    x,
    y,
    w: REWARD_CARD_W,
    h: REWARD_CARD_H,
    onClick: () => {
      state = dispatchCommand(state, { type: "chooseReward", itemId: item.id });
    },
  });
}

function rewardStatSummary(item: ItemDef): string {
  const stats = statLines({ ...zeroStats(), ...item.stats });
  return stats.length > 0 ? stats.slice(0, 2).join(" / ") : "无基础数值";
}

function rewardEffectSummary(item: ItemDef): string {
  if (item.effects.length === 0) {
    return item.description;
  }
  return item.effects.slice(0, 2).map(effectDescription).join("；");
}

function drawResultCard(): void {
  const w = 560;
  const h = 188;
  const x = (WIDTH - w) / 2;
  const y = 488;
  const inset = 70;
  const contentW = w - inset * 2;
  const isVictory = snapshot.phase === "victory";

  drawNinePatch(uiSprites.tooltipParchment, x, y, w, h, 44);
  text(
    isVictory ? "胜利结算" : "失败结算",
    x + w / 2,
    y + 46,
    22,
    isVictory ? "#2b3c14" : "#4a180f",
    "center",
    '"Songti SC", Georgia, serif',
    "#f2d99b",
  );

  const reason = snapshot.endReason ?? (isVictory ? "远征完成" : "远征中止");
  wrapText(reason, x + inset, y + 82, contentW, 20, 14, "#241006", "#f2d99b");
  drawDivider(x + inset, y + 112, contentW);
  text(
    `击杀 ${snapshot.totals.kills}`,
    x + inset,
    y + 128,
    14,
    "#3a1a0a",
    "left",
    undefined,
    "#f2d99b",
  );
  text(
    `伤害 ${Math.round(snapshot.totals.damageDone)}`,
    x + w / 2,
    y + 128,
    14,
    "#3a1a0a",
    "center",
    undefined,
    "#f2d99b",
  );
  text(
    `纹章 ${snapshot.shareCode}`,
    x + w - inset,
    y + 128,
    14,
    "#3a1a0a",
    "right",
    undefined,
    "#f2d99b",
  );
}

function drawItemTooltip(item: ItemSnapshot): void {
  const statEntries = statPairs(item.stats).slice(0, 6);
  const effectRows = tooltipEffectRows(item);
  const w = 430;
  const innerX = 54;
  const innerW = w - innerX * 2;
  const descHeight = measureWrappedTextHeight(item.def.description, innerW, 18, 13);
  const statRows = Math.ceil(statEntries.length / 2);
  const effectHeight = Math.max(28, effectRows.length * 30);
  const h = 116 + descHeight + 14 + 23 + Math.max(1, statRows) * 30 + 16 + 22 + effectHeight + 54;
  const preferredX = pointer.x + 34;
  const x = preferredX + w <= WIDTH - 24 ? preferredX : pointer.x - w - 34;
  const y = Math.min(HEIGHT - 24 - h, Math.max(78, pointer.y - 86));

  drawNinePatch(uiSprites.tooltipParchment, x, y, w, h, 44);

  drawSprite(uiSprites.frameCommon, x + innerX, y + 44, 62, 62, 0);
  drawSprite(itemSprites[item.def.id], x + innerX + 5, y + 49, 52, 52, 5);
  text(
    item.def.name,
    x + innerX + 78,
    y + 48,
    20,
    "#241006",
    "left",
    '"Songti SC", Georgia, serif',
    "#f2d99b",
  );
  text(
    `${rarityLabel[item.def.rarity]} | ${item.def.tags.map(formatTag).join(" / ")}`,
    x + innerX + 78,
    y + 78,
    13,
    "#4f2a12",
    "left",
    undefined,
    "#f2d99b",
  );
  const descriptionHeight = wrapText(
    item.def.description,
    x + innerX,
    y + 116,
    innerW,
    18,
    13,
    "#241006",
    "#f2d99b",
  );

  let cursorY = y + 116 + descriptionHeight + 14;
  drawDivider(x + innerX, cursorY, innerW);
  cursorY += 12;
  text("当前贡献", x + innerX, cursorY, 14, "#3a1a0a", "left", undefined, "#f2d99b");
  cursorY += 23;
  for (let index = 0; index < statEntries.length; index += 1) {
    const column = index % 2;
    const row = Math.floor(index / 2);
    drawStatChip(
      x + innerX + column * 162,
      cursorY + row * 30,
      144,
      statEntries[index]!.label,
      statEntries[index]!.value,
    );
  }
  cursorY += Math.max(1, statRows) * 30 + 4;
  drawDivider(x + innerX, cursorY, innerW);
  cursorY += 12;
  text("连携状态", x + innerX, cursorY, 14, "#3a1a0a", "left", undefined, "#f2d99b");
  cursorY += 22;
  if (effectRows.length === 0) {
    text("无连携效果", x + innerX, cursorY, 13, "#4f2a12", "left", undefined, "#f2d99b");
    return;
  }
  for (const row of effectRows) {
    drawEffectRow(x + innerX, cursorY, innerW, row);
    cursorY += 30;
  }
}

function statLines(stats: Stats): string[] {
  return statPairs(stats).map(({ label, value }) => `${label} ${value}`);
}

function statPairs(stats: Stats): Array<{ label: string; value: string }> {
  return (Object.entries(stats) as Array<[keyof Stats, number]>)
    .filter(([, value]) => Math.abs(value) > 0.001)
    .map(([stat, value]) => ({
      label: statLabel[stat],
      value: `${value > 0 ? "+" : ""}${fmtStat(stat, value)}`,
    }));
}

function tooltipEffectRows(item: ItemSnapshot): Array<{ active: boolean; description: string }> {
  const activeLabels = new Set(item.labels.map((label) => label.split(" (")[0]));
  return item.def.effects.map((effect) => ({
    active: activeLabels.has(effect.label),
    description: effectDescription(effect),
  }));
}

function effectDescription(effect: EffectDef): string {
  const amount = `${effect.amount > 0 ? "+" : ""}${fmtStat(effect.stat, effect.amount)} ${statLabel[effect.stat]}`;
  switch (effect.type) {
    case "adjacentTag":
      return `邻接 ${formatTag(effect.tag)} ${amount}`;
    case "sameRowTag":
      return `同行 ${formatTag(effect.tag)} ${amount}`;
    case "corner":
      return `放在角落 ${amount}`;
    case "emptyNeighbor":
      return `每个空邻格 ${amount}`;
    case "lowHp":
      return `生命低于 ${Math.round(effect.threshold * 100)}% ${amount}`;
  }
}

function formatTag(tag: string): string {
  return tagLabel[tag] ?? tag;
}

function effectTargetCells(
  item: ItemSnapshot,
  effect: EffectDef,
): Array<{ x: number; y: number; active: boolean }> {
  switch (effect.type) {
    case "adjacentTag":
      return neighbors(item.instance.x, item.instance.y).map((cell) => ({
        ...cell,
        active: itemAtCell(cell.x, cell.y)?.def.tags.includes(effect.tag) ?? false,
      }));
    case "sameRowTag":
      return Array.from({ length: GRID_WIDTH }, (_, x) => ({
        x,
        y: item.instance.y,
        active:
          x !== item.instance.x &&
          (itemAtCell(x, item.instance.y)?.def.tags.includes(effect.tag) ?? false),
      })).filter((cell) => cell.x !== item.instance.x);
    case "corner":
      return [
        { x: 0, y: 0 },
        { x: GRID_WIDTH - 1, y: 0 },
        { x: 0, y: GRID_HEIGHT - 1 },
        { x: GRID_WIDTH - 1, y: GRID_HEIGHT - 1 },
      ].map((cell) => ({
        ...cell,
        active: cell.x === item.instance.x && cell.y === item.instance.y,
      }));
    case "emptyNeighbor":
      return neighbors(item.instance.x, item.instance.y).map((cell) => ({
        ...cell,
        active: itemAtCell(cell.x, cell.y) === null,
      }));
    case "lowHp":
      return [];
  }
}

function drawGhost(): void {
  if (!draggingItemId) {
    return;
  }
  const item = snapshot.items.find((candidate) => candidate.instance.id === draggingItemId);
  if (!item) {
    return;
  }
  ctx.globalAlpha = 0.78;
  const frameSprite =
    item.def.rarity === "rare" || item.def.rarity === "epic"
      ? uiSprites.frameRare
      : uiSprites.frameCommon;
  drawSprite(frameSprite, pointer.x - 30, pointer.y - 30, CELL - 4, CELL - 4, 0);
  if (
    !drawSprite(itemSprites[item.def.id], pointer.x - 25, pointer.y - 25, CELL - 32, CELL - 32, 6)
  ) {
    text(item.def.symbol, pointer.x, pointer.y - 7, 24, "#fff7d6", "center", "monospace");
  }
  ctx.globalAlpha = 1;
}

function button(
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  enabled = true,
): void {
  const hovered =
    enabled && pointer.x >= x && pointer.x <= x + w && pointer.y >= y && pointer.y <= y + h;
  drawNinePatch(
    enabled
      ? hovered
        ? uiSprites.buttonPressed
        : uiSprites.buttonNormal
      : uiSprites.buttonDisabled,
    x,
    y,
    w,
    h,
    46,
  );
  text(label, x + w / 2, y + h / 2 - 7, 14, enabled ? "#ffe6aa" : "#7d9199", "center");
  if (enabled) {
    hitZones.push({ x, y, w, h, onClick });
  }
}

function drawBar(x: number, y: number, w: number, h: number, ratio: number, color: string): void {
  ctx.fillStyle = "rgba(35, 27, 20, 0.88)";
  roundRect(x, y, w, h, h / 2, true);
  ctx.fillStyle = color;
  roundRect(x, y, Math.max(0, Math.min(w, w * ratio)), h, h / 2, true);
  ctx.strokeStyle = "rgba(255, 235, 180, 0.22)";
  ctx.lineWidth = 1;
  roundRect(x, y, w, h, h / 2, false);
}

function itemAt(x: number, y: number): GameSnapshot["items"][number] | null {
  const cell = pointerToCell(x, y);
  if (!cell) {
    return null;
  }
  return itemAtCell(cell.x, cell.y);
}

function itemAtCell(x: number, y: number): GameSnapshot["items"][number] | null {
  return snapshot.items.find((item) => item.instance.x === x && item.instance.y === y) ?? null;
}

function pointerToCell(x: number, y: number): Point | null {
  const origin = gridOrigin();
  const gx = Math.floor((x - origin.x) / CELL);
  const gy = Math.floor((y - origin.y) / CELL);
  if (gx < 0 || gx >= GRID_WIDTH || gy < 0 || gy >= GRID_HEIGHT) {
    return null;
  }
  return { x: gx, y: gy };
}

function neighbors(x: number, y: number): Point[] {
  return [
    { x: x - 1, y },
    { x: x + 1, y },
    { x, y: y - 1 },
    { x, y: y + 1 },
  ].filter((cell) => cell.x >= 0 && cell.x < GRID_WIDTH && cell.y >= 0 && cell.y < GRID_HEIGHT);
}

function cellCenter(x: number, y: number): Point {
  const origin = gridOrigin();
  return {
    x: origin.x + x * CELL + (CELL - 4) / 2,
    y: origin.y + y * CELL + (CELL - 4) / 2,
  };
}

function strokeCell(x: number, y: number, color: string, width: number): void {
  const origin = gridOrigin();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  roundRect(origin.x + x * CELL, origin.y + y * CELL, CELL - 4, CELL - 4, 6, false);
}

function pointerFromEvent(event: PointerEvent): Point {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / WIDTH, rect.height / HEIGHT);
  const contentWidth = WIDTH * scale;
  const contentHeight = HEIGHT * scale;
  const contentX = (rect.width - contentWidth) / 2;
  const contentY = (rect.height - contentHeight) / 2;
  return {
    x: ((event.clientX - rect.left - contentX) / contentWidth) * WIDTH,
    y: ((event.clientY - rect.top - contentY) / contentHeight) * HEIGHT,
  };
}

function inside(point: Point, zone: HitZone): boolean {
  return (
    point.x >= zone.x &&
    point.x <= zone.x + zone.w &&
    point.y >= zone.y &&
    point.y <= zone.y + zone.h
  );
}

function preloadSprites(): void {
  for (const path of [
    backgroundSprite,
    ...Object.values(itemSprites),
    ...Object.values(actorSprites),
    ...Object.values(uiSprites),
    ...Object.values(rewardCardSprites).flatMap((sprites) => [sprites.normal, sprites.hover]),
  ]) {
    const image = new Image();
    image.onload = () => render();
    image.src = path;
    spriteCache.set(path, image);
  }
}

function drawSprite(
  path: string | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): boolean {
  if (!path) {
    return false;
  }
  const image = spriteCache.get(path);
  if (!image?.complete || image.naturalWidth === 0) {
    return false;
  }

  ctx.save();
  clippedRoundRect(x, y, w, h, radius);
  ctx.drawImage(image, x, y, w, h);
  ctx.restore();
  return true;
}

function drawNinePatch(
  path: string,
  x: number,
  y: number,
  w: number,
  h: number,
  inset: number,
): boolean {
  const image = spriteCache.get(path);
  if (!image?.complete || image.naturalWidth === 0) {
    return false;
  }
  const iw = image.naturalWidth;
  const ih = image.naturalHeight;
  const sourceInset = Math.max(1, Math.min(inset, Math.floor(iw / 2) - 1, Math.floor(ih / 2) - 1));
  const maxDestInset = Math.max(1, Math.floor(Math.min(w, h) * 0.32));
  const destInset = Math.max(1, Math.min(sourceInset, maxDestInset));
  const dx = [x, x + destInset, x + w - destInset];
  const dy = [y, y + destInset, y + h - destInset];
  const dw = [destInset, Math.max(0, w - destInset * 2), destInset];
  const dh = [destInset, Math.max(0, h - destInset * 2), destInset];
  const sx = [0, sourceInset, iw - sourceInset];
  const sy = [0, sourceInset, ih - sourceInset];
  const sw = [sourceInset, Math.max(0, iw - sourceInset * 2), sourceInset];
  const sh = [sourceInset, Math.max(0, ih - sourceInset * 2), sourceInset];

  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      if (dw[column]! <= 0 || dh[row]! <= 0 || sw[column]! <= 0 || sh[row]! <= 0) {
        continue;
      }
      ctx.drawImage(
        image,
        sx[column]!,
        sy[row]!,
        sw[column]!,
        sh[row]!,
        dx[column]!,
        dy[row]!,
        dw[column]!,
        dh[row]!,
      );
    }
  }
  return true;
}

function drawActorSprite(
  path: string | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  ctx.save();
  ctx.filter = "drop-shadow(0 0 2px rgba(0, 0, 0, 0.9)) drop-shadow(0 6px 5px rgba(0, 0, 0, 0.58))";
  const rendered = drawSprite(path, x, y, w, h, 0);
  ctx.restore();
  return rendered;
}

function text(
  value: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = "left",
  family = "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  outlineColor?: string,
): void {
  ctx.font = `${size}px ${family}`;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  if (outlineColor) {
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(2, Math.round(size * 0.18));
    ctx.strokeStyle = outlineColor;
    ctx.strokeText(value, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

function wrapText(
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  size: number,
  color: string,
  outlineColor?: string,
): number {
  const lines = wrapLines(value, maxWidth, size);
  let cursorY = y;
  for (const lineText of lines) {
    text(lineText, x, cursorY, size, color, "left", undefined, outlineColor);
    cursorY += lineHeight;
  }
  return Math.max(lineHeight, cursorY - y);
}

function measureWrappedTextHeight(
  value: string,
  maxWidth: number,
  lineHeight: number,
  size: number,
): number {
  return Math.max(lineHeight, wrapLines(value, maxWidth, size).length * lineHeight);
}

function wrapLines(value: string, maxWidth: number, size: number): string[] {
  ctx.font = `${size}px Inter, ui-sans-serif, system-ui, sans-serif`;
  return value.split("\n").flatMap((paragraph) => {
    const words = paragraph.split("");
    const lines: string[] = [];
    let lineText = "";
    for (const word of words) {
      const testLine = lineText + word;
      if (ctx.measureText(testLine).width > maxWidth && lineText.length > 0) {
        lines.push(lineText);
        lineText = word;
      } else {
        lineText = testLine;
      }
    }
    lines.push(lineText);
    return lines;
  });
}

function phaseLabel(): string {
  if (snapshot.phase === "battle") {
    return paused ? "沙漏凝住" : "队伍自动交锋";
  }
  if (snapshot.phase === "victory") {
    return "胜利";
  }
  if (snapshot.phase === "defeat") {
    return "失败";
  }
  return "择宝与整备";
}

function gridOrigin(): Point {
  return {
    x: BAG_X + BAG_GRID_SOURCE_X * BAG_SCALE,
    y: backpackVisualY + BAG_GRID_SOURCE_Y * BAG_SCALE,
  };
}

function drawSceneGround(): void {
  ctx.save();
  ctx.globalAlpha = 0.42;
  const glow = ctx.createRadialGradient(WIDTH / 2, 420, 80, WIDTH / 2, 420, 520);
  glow.addColorStop(0, "rgba(234, 176, 92, 0.22)");
  glow.addColorStop(0.45, "rgba(45, 72, 68, 0.12)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 140, WIDTH, 470);
  ctx.restore();

  ctx.strokeStyle = "rgba(220, 162, 75, 0.18)";
  ctx.lineWidth = 2;
  line(300, 434, 900, 434);
}

function drawActorShadow(x: number, y: number, w: number, h: number): void {
  ctx.save();
  ctx.globalAlpha = 0.52;
  const shadow = ctx.createRadialGradient(x, y, 2, x, y, w / 2);
  shadow.addColorStop(0, "rgba(0, 0, 0, 0.72)");
  shadow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBackpackBody(x: number, y: number, w: number, h: number, open: boolean): void {
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.48)";
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 8;
  if (open) {
    drawSprite(uiSprites.bagOpen, x, y, w, h, 0);
  } else {
    drawSprite(uiSprites.bagClosed, x + 72, y, w - 144, 112, 0);
  }
  ctx.restore();
}

function drawSmallSeal(x: number, y: number, w: number, label: string): void {
  const h = 28;
  drawNinePatch(uiSprites.smallSeal, x, y, w, h, 24);
  text(label, x + w / 2, y + 7, 13, "#d7c394", "center");
}

function drawCellEmptyState(x: number, y: number): void {
  ctx.save();
  ctx.globalAlpha = 0.16;
  drawSprite(uiSprites.inventorySlot, x + 2, y + 2, CELL - 8, CELL - 8, 0);
  ctx.restore();
}

function drawPlayerStatusPanel(x: number, y: number, w: number, h: number): void {
  const stats = snapshot.player.stats;
  drawNinePatch(uiSprites.tooltipParchment, x, y, w, h, 44);
  const inset = 58;

  text(
    "英雄状态",
    x + inset,
    y + 50,
    18,
    "#241006",
    "left",
    '"Songti SC", Georgia, serif',
    "#f2d99b",
  );
  text(
    `${Math.ceil(snapshot.player.hp)}/${Math.ceil(stats.maxHp)}`,
    x + w - inset,
    y + 52,
    14,
    "#241006",
    "right",
    undefined,
    "#f2d99b",
  );
  drawBar(x + inset, y + 76, w - inset * 2, 8, snapshot.player.hp / stats.maxHp, "#63d990");
  drawDivider(x + inset, y + 91, w - inset * 2);

  const rows = [
    ["攻击", fmt(stats.attack), "攻速", fmt(stats.attackSpeed)],
    ["护甲", fmt(stats.armor), "回复", fmt(stats.regen)],
    ["燃烧", fmt(stats.burn), "毒", fmt(stats.poison)],
    ["反伤", fmt(stats.thorns), "暴击", `${Math.round(stats.critChance * 100)}%`],
  ] as const;

  let cursorY = y + 103;
  for (const [leftLabel, leftValue, rightLabel, rightValue] of rows) {
    drawCompactStat(x + inset, cursorY, 90, leftLabel, leftValue);
    drawCompactStat(x + inset + 124, cursorY, 90, rightLabel, rightValue);
    cursorY += 21;
  }
}

function drawCompactStat(x: number, y: number, w: number, label: string, value: string): void {
  text(label, x, y + 2, 12, "#3a1a0a", "left", undefined, "#f2d99b");
  text(value, x + w, y + 2, 13, "#140904", "right", undefined, "#f2d99b");
}

function drawStatChip(x: number, y: number, w: number, label: string, value: string): void {
  text(label, x, y + 4, 13, "#3a1a0a", "left", undefined, "#f2d99b");
  text(value, x + w, y + 4, 13, "#140904", "right", undefined, "#f2d99b");
}

function drawDivider(x: number, y: number, w: number): void {
  ctx.strokeStyle = "rgba(92, 52, 22, 0.34)";
  ctx.lineWidth = 1;
  line(x, y, x + w, y);
}

function drawEffectRow(
  x: number,
  y: number,
  w: number,
  row: { active: boolean; description: string },
): void {
  text(
    row.active ? "已触发" : "未触发",
    x,
    y + 4,
    13,
    row.active ? "#7a2e14" : "#4b3020",
    "left",
    undefined,
    "#f2d99b",
  );
  text(row.description, x + 80, y + 4, 13, "#140904", "left", undefined, "#f2d99b");
}

function roundRect(x: number, y: number, w: number, h: number, r: number, fill: boolean): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
  if (fill) {
    ctx.fill();
  } else {
    ctx.stroke();
  }
}

function clippedRoundRect(x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
  ctx.clip();
}

function line(x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function fmt(value: number): string {
  return `${Math.round(value * 10) / 10}`;
}

function fmtStat(stat: keyof Stats, value: number): string {
  if (stat === "critChance") {
    return `${Math.round(value * 100)}%`;
  }
  return fmt(value);
}

function zeroStats(): Stats {
  return {
    maxHp: 0,
    attack: 0,
    attackSpeed: 0,
    armor: 0,
    regen: 0,
    burn: 0,
    poison: 0,
    thorns: 0,
    critChance: 0,
  };
}

function dailySeed(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `daily-${year}${month}${day}`;
}

function randomSeed(): string {
  return `run-${Math.random().toString(36).slice(2, 8)}`;
}
