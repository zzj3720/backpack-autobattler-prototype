import {
  GRID_HEIGHT,
  GRID_WIDTH,
  createGame,
  defaultContent,
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
const GRID_X = 54;
const GRID_Y = 164;
const CELL = 82;
const ARENA_X = 500;
const ARENA_Y = 154;
const ARENA_W = 386;
const ARENA_H = 430;
const PANEL_X = 934;
const PANEL_Y = 64;
const PANEL_W = 292;

const rarityColor: Record<Rarity, string> = {
  common: "#8b949e",
  uncommon: "#3fb950",
  rare: "#58a6ff",
  epic: "#d2a8ff",
};

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

let state: GameState = createGame(dailySeed());
let snapshot: GameSnapshot = querySnapshot(state);
let paused = false;
let lastFrame = performance.now();
let accumulatorMs = 0;
let draggingItemId: string | null = null;
let pointer: Point = { x: 0, y: 0 };
let hitZones: HitZone[] = [];
const debugWindow = window as typeof window & { __backpackDebug?: () => GameSnapshot };
debugWindow.__backpackDebug = () => querySnapshot(state);
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

  render();
  requestAnimationFrame(frame);
}

function render(): void {
  snapshot = querySnapshot(state);
  hitZones = [];
  const hoveredItem = !draggingItemId ? itemAt(pointer.x, pointer.y) : null;
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawBackground();
  drawHeader();
  drawBackpack(hoveredItem);
  drawArena();
  drawSidePanel();
  drawTimeline();
  if (hoveredItem) {
    drawItemTooltip(hoveredItem);
  }
  drawGhost();
}

function drawBackground(): void {
  ctx.fillStyle = "#0b0f12";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#121a1f";
  roundRect(28, 52, 420, 560, 8, true);
  roundRect(470, 52, 448, 560, 8, true);
  roundRect(914, 52, 334, 646, 8, true);
  ctx.strokeStyle = "#20313a";
  ctx.lineWidth = 1;
  for (let x = 40; x < WIDTH; x += 34) {
    line(x, 52, x + 180, HEIGHT);
  }
}

function drawHeader(): void {
  text("背包构筑自动战斗", 52, 28, 28, "#f3d18a");
  text(`Seed ${snapshot.seed}  |  ${snapshot.shareCode}`, 356, 34, 15, "#8fb6c8");
  text("5x4 背包", 52, 112, 20, "#f5f0dc");
  text("自动战斗", 500, 112, 20, "#f5f0dc");
  text("奖励 / 调试 / 结算", 934, 32, 20, "#f5f0dc");
}

function drawBackpack(hoveredItem: ItemSnapshot | null): void {
  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      const px = GRID_X + x * CELL;
      const py = GRID_Y + y * CELL;
      ctx.fillStyle = "#182229";
      roundRect(px, py, CELL - 8, CELL - 8, 6, true);
      ctx.strokeStyle = "#32434d";
      ctx.lineWidth = 1;
      roundRect(px, py, CELL - 8, CELL - 8, 6, false);
    }
  }

  if (hoveredItem) {
    drawItemLinkHighlights(hoveredItem);
  }

  for (const item of snapshot.items) {
    const px = GRID_X + item.instance.x * CELL + 7;
    const py = GRID_Y + item.instance.y * CELL + 7;
    ctx.fillStyle = "#1d2a31";
    roundRect(px, py, CELL - 22, CELL - 22, 6, true);
    ctx.strokeStyle = rarityColor[item.def.rarity];
    ctx.lineWidth = hoveredItem?.instance.id === item.instance.id ? 5 : 3;
    roundRect(px, py, CELL - 22, CELL - 22, 6, false);
    if (!drawSprite(itemSprites[item.def.id], px + 5, py + 5, CELL - 32, CELL - 32, 6)) {
      text(item.def.symbol, px + 30, py + 18, 24, "#fff7d6", "center", "monospace");
    }
    ctx.fillStyle = "rgba(8, 12, 14, 0.72)";
    roundRect(px + 5, py + 43, CELL - 32, 14, 4, true);
    text(item.def.name.slice(0, 4), px + 30, py + 44, 11, "#f7fbff", "center");
  }

  const stats = snapshot.player.stats;
  wrapText(formatStats(stats), 54, 520, 380, 20, 15, "#afc7d0");
  text("拖动物品改变邻接。战斗阶段锁定背包。", 54, 624, 13, "#718894");
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

function drawArena(): void {
  ctx.fillStyle = "#10181d";
  roundRect(ARENA_X, ARENA_Y, ARENA_W, ARENA_H, 8, true);
  ctx.strokeStyle = "#35505a";
  ctx.lineWidth = 2;
  roundRect(ARENA_X, ARENA_Y, ARENA_W, ARENA_H, 8, false);

  ctx.strokeStyle = "#23323a";
  ctx.lineWidth = 1;
  for (let laneIndex = 0; laneIndex < 3; laneIndex += 1) {
    const y = ARENA_Y + 100 + laneIndex * 105;
    line(ARENA_X + 24, y, ARENA_X + ARENA_W - 24, y);
  }

  drawPlayer(ARENA_X + 86, ARENA_Y + 216);
  drawEnemies();
  text(
    `第 ${snapshot.waveIndex + 1} 波：${snapshot.waveName}`,
    ARENA_X + 24,
    ARENA_Y + 24,
    18,
    "#f5f0dc",
  );
  text(phaseLabel(), ARENA_X + 24, ARENA_Y + 50, 14, "#8fb6c8");
}

function drawPlayer(x: number, y: number): void {
  ctx.fillStyle = "#13232b";
  roundRect(x - 40, y - 44, 80, 82, 10, true);
  ctx.strokeStyle = "#f3d18a";
  ctx.lineWidth = 3;
  roundRect(x - 40, y - 44, 80, 82, 10, false);
  if (!drawSprite(actorSprites.hero, x - 34, y - 38, 68, 68, 8)) {
    text("HERO", x, y - 9, 13, "#f7fbff", "center");
  }
  drawBar(x - 48, y + 48, 96, 8, snapshot.player.hp / snapshot.player.maxHp, "#5bd48a");
  text(
    `${Math.ceil(snapshot.player.hp)} / ${Math.ceil(snapshot.player.maxHp)}`,
    x - 45,
    y + 62,
    12,
    "#b8cbd3",
  );
}

function drawEnemies(): void {
  const laneCounts = [0, 0, 0];
  for (const enemy of snapshot.enemies) {
    const laneIndex = Math.max(0, Math.min(2, enemy.instance.lane));
    const order = laneCounts[laneIndex] ?? 0;
    laneCounts[laneIndex] = order + 1;
    const x = ARENA_X + 260 + order * 46;
    const y = ARENA_Y + 100 + laneIndex * 105;
    ctx.fillStyle = enemy.def.id === "boss" ? "#74363d" : "#4a3930";
    roundRect(x - 26, y - 28, 52, 48, 7, true);
    ctx.strokeStyle = enemy.def.id === "boss" ? "#e05d5d" : "#9e7656";
    ctx.lineWidth = 2;
    roundRect(x - 26, y - 28, 52, 48, 7, false);
    if (!drawSprite(actorSprites[enemy.def.id], x - 23, y - 25, 46, 42, 6)) {
      text(enemy.def.symbol, x, y - 10, 13, "#fff4df", "center", "monospace");
    }
    drawBar(x - 26, y + 26, 52, 6, enemy.instance.hp / enemy.def.maxHp, "#cf4e4e");
  }
}

function drawSidePanel(): void {
  let y = PANEL_Y;
  text("奖励选择", PANEL_X + 16, y, 18, "#f3d18a");
  y += 32;

  if (snapshot.rewards.length > 0 && snapshot.phase === "draft") {
    for (const reward of snapshot.rewards) {
      rewardCard(PANEL_X + 16, y, reward);
      y += 88;
    }
  } else {
    text("本轮奖励已选择。", PANEL_X + 16, y, 14, "#8da2aa");
    y += 46;
  }

  button(PANEL_X + 16, y, 126, 36, "开战", () => {
    state = dispatchCommand(state, { type: "startBattle" });
  });
  button(PANEL_X + 154, y, 98, 36, paused ? "继续" : "暂停", () => {
    paused = !paused;
  });
  y += 50;

  text("Debug", PANEL_X + 16, y, 17, "#f3d18a");
  y += 30;
  button(PANEL_X + 16, y, 92, 32, "单步", () => {
    tickGame(state, 50);
  });
  button(PANEL_X + 116, y, 92, 32, "回血", () => {
    state = dispatchCommand(state, { type: "debugHeal" });
  });
  y += 42;
  button(PANEL_X + 16, y, 116, 32, "加随机装", () => {
    const item = defaultContent.items[Math.floor(Math.random() * defaultContent.items.length)]!;
    state = dispatchCommand(state, { type: "debugAddItem", itemId: item.id });
  });
  button(PANEL_X + 144, y, 98, 32, "新 Seed", () => {
    state = dispatchCommand(state, { type: "restart", seed: randomSeed() });
    paused = false;
  });
  y += 52;

  drawDamageChart(PANEL_X + 16, y);
  y += 122;

  text("日志", PANEL_X + 16, y, 17, "#f3d18a");
  y += 28;
  for (const lineText of snapshot.log.slice(-5)) {
    wrapText(lineText, PANEL_X + 16, y, PANEL_W - 34, 18, 12, "#b8cbd3");
    y += 20;
  }

  if (snapshot.phase === "victory" || snapshot.phase === "defeat") {
    drawResultCard();
  }
}

function rewardCard(x: number, y: number, item: ItemDef): void {
  ctx.fillStyle = "#162126";
  roundRect(x, y, 252, 76, 7, true);
  ctx.strokeStyle = rarityColor[item.rarity];
  ctx.lineWidth = 2;
  roundRect(x, y, 252, 76, 7, false);
  ctx.fillStyle = "#0f171b";
  roundRect(x + 10, y + 10, 56, 56, 6, true);
  drawSprite(itemSprites[item.id], x + 12, y + 12, 52, 52, 5);
  text(item.name, x + 76, y + 10, 15, "#f5f0dc");
  wrapText(
    `${rarityLabel[item.rarity]} | ${item.description}`,
    x + 76,
    y + 32,
    166,
    16,
    12,
    "#9cb4bd",
  );
  hitZones.push({
    x,
    y,
    w: 252,
    h: 76,
    onClick: () => {
      state = dispatchCommand(state, { type: "chooseReward", itemId: item.id });
    },
  });
}

function drawDamageChart(x: number, y: number): void {
  text("伤害来源", x, y, 17, "#f3d18a");
  const sourceNames = new Map(snapshot.items.map((item) => [item.instance.id, item.def.name]));
  const entries = Object.entries(snapshot.totals.damageByItem)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4);
  const maxDamage = Math.max(1, ...entries.map((entry) => entry[1]));

  if (entries.length === 0) {
    wrapText("开战后这里会显示结算图雏形。", x, y + 30, 230, 18, 13, "#8da2aa");
    return;
  }

  entries.forEach(([sourceId, damage], index) => {
    const rowY = y + 32 + index * 22;
    const label = sourceNames.get(sourceId) ?? "基础";
    text(label.slice(0, 5), x, rowY, 12, "#c7d7dd");
    ctx.fillStyle = "#31444b";
    roundRect(x + 72, rowY + 2, 132, 10, 4, true);
    ctx.fillStyle = "#f3d18a";
    roundRect(x + 72, rowY + 2, 132 * (damage / maxDamage), 10, 4, true);
    text(`${Math.round(damage)}`, x + 212, rowY - 1, 12, "#c7d7dd");
  });
}

function drawResultCard(): void {
  const x = 470;
  const y = 626;
  ctx.fillStyle = "#142025";
  roundRect(x, y, 448, 70, 8, true);
  ctx.strokeStyle = snapshot.phase === "victory" ? "#f3d18a" : "#cf4e4e";
  ctx.lineWidth = 2;
  roundRect(x, y, 448, 70, 8, false);
  text(snapshot.phase === "victory" ? "胜利结算" : "失败结算", x + 18, y + 14, 18, "#f5f0dc");
  wrapText(
    `${snapshot.endReason ?? ""} | 击杀 ${snapshot.totals.kills} | 伤害 ${Math.round(snapshot.totals.damageDone)} | Build ${snapshot.shareCode}`,
    x + 18,
    y + 40,
    410,
    18,
    14,
    "#b8cbd3",
  );
}

function drawTimeline(): void {
  const labels = ["选奖励", "摆装备", "跑战斗", "打 Boss", "晒结算"];
  const x = 54;
  const y = 670;
  for (let index = 0; index < labels.length; index += 1) {
    const cx = x + index * 112;
    const active =
      (snapshot.phase === "draft" && index <= 1) ||
      (snapshot.phase === "battle" && index >= 2 && index <= 3) ||
      ((snapshot.phase === "victory" || snapshot.phase === "defeat") && index === 4);
    ctx.fillStyle = active ? "#f3d18a" : "#263740";
    circle(cx, y, 11, true);
    if (index < labels.length - 1) {
      ctx.strokeStyle = "#263740";
      ctx.lineWidth = 2;
      line(cx + 16, y, cx + 96, y);
    }
    text(labels[index]!, cx - 23, y + 22, 13, active ? "#f3d18a" : "#8da2aa");
  }
  text("3 分钟短局 | 固定 Seed | Build 分享码", 650, y - 9, 15, "#8fb6c8");
}

function drawItemTooltip(item: ItemSnapshot): void {
  const lines = tooltipLines(item);
  const w = 360;
  const descHeight = measureWrappedTextHeight(item.def.description, w - 28, 17, 12);
  const lineHeights = lines.map((lineText) => measureWrappedTextHeight(lineText, w - 28, 19, 12));
  const h =
    78 + descHeight + 12 + lineHeights.reduce((sum, lineHeight) => sum + lineHeight, 0) + 14;
  const x = Math.min(WIDTH - w - 24, Math.max(40, pointer.x + 24));
  const y = Math.min(HEIGHT - 24 - h, Math.max(72, pointer.y + 18));

  ctx.fillStyle = "rgba(10, 15, 18, 0.96)";
  roundRect(x, y, w, h, 8, true);
  ctx.strokeStyle = rarityColor[item.def.rarity];
  ctx.lineWidth = 2;
  roundRect(x, y, w, h, 8, false);

  ctx.fillStyle = "#111b20";
  roundRect(x + 14, y + 14, 54, 54, 6, true);
  drawSprite(itemSprites[item.def.id], x + 17, y + 17, 48, 48, 5);
  text(item.def.name, x + 78, y + 14, 17, "#f5f0dc");
  text(
    `${rarityLabel[item.def.rarity]} | ${item.def.tags.join(" / ")}`,
    x + 78,
    y + 39,
    12,
    "#8fb6c8",
  );
  const descriptionHeight = wrapText(
    item.def.description,
    x + 14,
    y + 78,
    w - 28,
    17,
    12,
    "#b8cbd3",
  );

  let cursorY = y + 78 + descriptionHeight + 12;
  for (const lineText of lines) {
    const active = lineText.startsWith("已触发");
    cursorY += wrapText(lineText, x + 14, cursorY, w - 28, 19, 12, active ? "#f3d18a" : "#8da2aa");
  }
}

function tooltipLines(item: ItemSnapshot): string[] {
  const activeLabels = new Set(item.labels.map((label) => label.split(" (")[0]));
  const baseStats = statLines(item.stats).slice(0, 4);
  const effectLines =
    item.def.effects.length > 0
      ? item.def.effects.map((effect) => {
          const active = activeLabels.has(effect.label);
          const stateLabel = active ? "已触发" : "未触发";
          return `${stateLabel}：${effectDescription(effect)}`;
        })
      : ["无连携效果"];
  return [...baseStats, ...effectLines].slice(0, 8);
}

function statLines(stats: Stats): string[] {
  return (Object.entries(stats) as Array<[keyof Stats, number]>)
    .filter(([, value]) => Math.abs(value) > 0.001)
    .map(([stat, value]) => `${statLabel[stat]} ${value > 0 ? "+" : ""}${fmtStat(stat, value)}`);
}

function effectDescription(effect: EffectDef): string {
  const amount = `${effect.amount > 0 ? "+" : ""}${fmtStat(effect.stat, effect.amount)} ${statLabel[effect.stat]}`;
  switch (effect.type) {
    case "adjacentTag":
      return `邻接 ${effect.tag} ${amount}`;
    case "sameRowTag":
      return `同行 ${effect.tag} ${amount}`;
    case "corner":
      return `放在角落 ${amount}`;
    case "emptyNeighbor":
      return `每个空邻格 ${amount}`;
    case "lowHp":
      return `生命低于 ${Math.round(effect.threshold * 100)}% ${amount}`;
  }
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
  ctx.fillStyle = "#1d2a31";
  roundRect(pointer.x - 30, pointer.y - 30, CELL - 22, CELL - 22, 6, true);
  ctx.strokeStyle = rarityColor[item.def.rarity];
  ctx.lineWidth = 3;
  roundRect(pointer.x - 30, pointer.y - 30, CELL - 22, CELL - 22, 6, false);
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
): void {
  ctx.fillStyle = "#24333a";
  roundRect(x, y, w, h, 6, true);
  ctx.strokeStyle = "#4c626c";
  ctx.lineWidth = 1;
  roundRect(x, y, w, h, 6, false);
  text(label, x + w / 2, y + h / 2 - 7, 14, "#eef7fa", "center");
  hitZones.push({ x, y, w, h, onClick });
}

function drawBar(x: number, y: number, w: number, h: number, ratio: number, color: string): void {
  ctx.fillStyle = "#243038";
  roundRect(x, y, w, h, h / 2, true);
  ctx.fillStyle = color;
  roundRect(x, y, Math.max(0, Math.min(w, w * ratio)), h, h / 2, true);
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
  const gx = Math.floor((x - GRID_X) / CELL);
  const gy = Math.floor((y - GRID_Y) / CELL);
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
  return {
    x: GRID_X + x * CELL + (CELL - 8) / 2,
    y: GRID_Y + y * CELL + (CELL - 8) / 2,
  };
}

function strokeCell(x: number, y: number, color: string, width: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  roundRect(GRID_X + x * CELL, GRID_Y + y * CELL, CELL - 8, CELL - 8, 6, false);
}

function pointerFromEvent(event: PointerEvent): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
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
  for (const path of [...Object.values(itemSprites), ...Object.values(actorSprites)]) {
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

function text(
  value: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = "left",
  family = "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
): void {
  ctx.fillStyle = color;
  ctx.font = `${size}px ${family}`;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
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
): number {
  const lines = wrapLines(value, maxWidth, size);
  let cursorY = y;
  for (const lineText of lines) {
    text(lineText, x, cursorY, size, color);
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

function formatStats(stats: Stats): string {
  return [
    `生命 ${Math.ceil(snapshot.player.hp)}/${Math.ceil(stats.maxHp)}`,
    `攻击 ${fmt(stats.attack)}  攻速 ${fmt(stats.attackSpeed)}`,
    `护甲 ${fmt(stats.armor)}  回复 ${fmt(stats.regen)}`,
    `燃烧 ${fmt(stats.burn)}  毒 ${fmt(stats.poison)}  反伤 ${fmt(stats.thorns)}`,
    `暴击 ${Math.round(stats.critChance * 100)}%`,
  ].join("\n");
}

function phaseLabel(): string {
  if (snapshot.phase === "battle") {
    return paused ? "已暂停" : "自动战斗中";
  }
  if (snapshot.phase === "victory") {
    return "胜利";
  }
  if (snapshot.phase === "defeat") {
    return "失败";
  }
  return "选奖励 / 摆装备";
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

function circle(x: number, y: number, r: number, fill: boolean): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) {
    ctx.fill();
  } else {
    ctx.stroke();
  }
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
