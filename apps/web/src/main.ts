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
const REWARD_CARD_W = 400;
const REWARD_CARD_H = 120;
const REWARD_CARD_GAP = 18;

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
  venom_gland: `${spriteBase}/items/venom_gland.png`,
  serpent_censer: `${spriteBase}/items/serpent_censer.png`,
  plague_idol: `${spriteBase}/items/plague_idol.png`,
  ember_saber: `${spriteBase}/items/ember_saber.png`,
  forge_heart: `${spriteBase}/items/forge_heart.png`,
  clockwork_halberd: `${spriteBase}/items/clockwork_halberd.png`,
  siege_chime: `${spriteBase}/items/siege_chime.png`,
  guardian_root: `${spriteBase}/items/guardian_root.png`,
  elder_moss: `${spriteBase}/items/elder_moss.png`,
  moon_eye: `${spriteBase}/items/moon_eye.png`,
  astral_core: `${spriteBase}/items/astral_core.png`,
  lich_crown: `${spriteBase}/items/lich_crown.png`,
};
const actorSprites: Record<string, string> = {
  hero: `${spriteBase}/actors/hero.png`,
  slime: `${spriteBase}/actors/slime.png`,
  rat: `${spriteBase}/actors/rat.png`,
  imp: `${spriteBase}/actors/imp.png`,
  brute: `${spriteBase}/actors/brute.png`,
  boss: `${spriteBase}/actors/boss.png`,
};
interface StripDef {
  path: string;
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  anchorBottom?: boolean;
}

const actorAnimationStrips: Record<string, StripDef> = {
  heroAttack: {
    path: "/assets/actors/hero-attack-strip-24x256.png",
    frameCount: 24,
    frameWidth: 256,
    frameHeight: 256,
    anchorBottom: true,
  },
};
const backgroundSprite = "/assets/backgrounds/dungeon-workbench.png";
const uiBase = "/assets/ui";
const effectsBase = "/assets/effects";
const uiSprites = {
  bagOpen: `${uiBase}/bag-open.png`,
  bagClosed: `${uiBase}/bag-closed.png`,
  barPlayerFrame: `${uiBase}/bar-player-frame.png`,
  barEnemyFrame: `${uiBase}/bar-enemy-frame.png`,
  barPlayerFill: `${uiBase}/bar-player-fill.png`,
  barEnemyFill: `${uiBase}/bar-enemy-fill.png`,
  debuffPoison: `${uiBase}/debuff-poison.png`,
  debuffBurn: `${uiBase}/debuff-burn.png`,
  rewardCard: `${uiBase}/reward-card.png`,
  tooltipParchment: `${uiBase}/tooltip-parchment.png`,
  panelItemTooltip: `${uiBase}/panel-item-tooltip.png`,
  panelHeroStatus: `${uiBase}/panel-hero-status.png`,
  panelResult: `${uiBase}/panel-result.png`,
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
const effectStrips: Record<string, StripDef> = {
  hitSpark: {
    path: `${effectsBase}/hit-spark-strip-8x256.png`,
    frameCount: 8,
    frameWidth: 256,
    frameHeight: 256,
  },
  poisonPuff: {
    path: `${effectsBase}/poison-puff-strip-8x256.png`,
    frameCount: 8,
    frameWidth: 256,
    frameHeight: 256,
  },
  fusionGlow: {
    path: `${effectsBase}/fusion-glow-strip-8x256.png`,
    frameCount: 8,
    frameWidth: 256,
    frameHeight: 256,
  },
};
const spriteCache = new Map<string, HTMLImageElement>();
const actorSpriteSurfaceCache = new Map<string, HTMLCanvasElement>();
const actorStripFrameSurfaceCache = new Map<string, HTMLCanvasElement>();
const actorSpriteBoundsCache = new Map<string, SpriteBounds>();
const ACTOR_FILTER =
  "drop-shadow(0 0 2px rgba(0, 0, 0, 0.9)) drop-shadow(0 6px 5px rgba(0, 0, 0, 0.58))";
interface FrameBounds {
  top: number;
  bottom: number;
}

interface SpriteBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface StripBoundsCacheEntry {
  frames: FrameBounds[];
  maxBottom: number;
}

const stripBoundsCache = new Map<string, StripBoundsCacheEntry>();
let backgroundLayerCache: HTMLCanvasElement | null = null;
const barThemes: Record<BarThemeName, BarTheme> = {
  player: {
    framePath: uiSprites.barPlayerFrame,
    fillPath: uiSprites.barPlayerFill,
    frameCropHeight: 266,
    frameLeftCap: 184,
    frameCenterX: 250,
    frameCenterWidth: 92,
    frameRightCapX: 412,
    fillLeft: 80,
    fillTop: 119,
    fillWidth: 438,
    fillHeight: 86,
    troughColor: "rgba(12, 17, 12, 0.88)",
    sparkColor: "#d0ff8e",
    glossColor: "rgba(255, 255, 255, 0.58)",
  },
  enemy: {
    framePath: uiSprites.barEnemyFrame,
    fillPath: uiSprites.barEnemyFill,
    frameCropHeight: 270,
    frameLeftCap: 188,
    frameCenterX: 254,
    frameCenterWidth: 96,
    frameRightCapX: 420,
    fillLeft: 81,
    fillTop: 120,
    fillWidth: 443,
    fillHeight: 84,
    troughColor: "rgba(18, 10, 10, 0.9)",
    sparkColor: "#ffb178",
    glossColor: "rgba(255, 244, 220, 0.46)",
  },
};

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

interface ActorDrawOptions {
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  alpha?: number;
}

interface FloatingText {
  id: number;
  x: number;
  y: number;
  dx: number;
  value: string;
  color: string;
  size: number;
  outline: string;
  startedAt: number;
  durationMs: number;
}

interface EnemyHitEffect {
  until: number;
  critical: boolean;
}

interface StrikeEffect {
  id: number;
  from: Point;
  to: Point;
  color: string;
  startedAt: number;
  durationMs: number;
  critical: boolean;
}

interface HeroAttackEffect {
  id: number;
  target: Point;
  startedAt: number;
  durationMs: number;
  critical: boolean;
}
type SpriteStripDef = StripDef;
type DamageCombatEvent = Extract<GameSnapshot["combatEvents"][number], { type: "damage" }>;

interface AnimatedSpriteEffect {
  id: number;
  strip: SpriteStripDef;
  x: number;
  y: number;
  startedAt: number;
  durationMs: number;
  size: number;
  opacity: number;
  rotation: number;
  lift: number;
  blendMode: GlobalCompositeOperation;
  anchorCell?: Point;
}

interface DeferredVisualAction {
  id: number;
  triggerAt: number;
  run: () => void;
}

interface EnemyPoisonState {
  activeUntil: number;
  tickFlashUntil: number;
}

interface EnemyBurnState {
  activeUntil: number;
  tickFlashUntil: number;
}

type BarThemeName = "player" | "enemy";

interface BarTheme {
  framePath: string;
  fillPath: string;
  frameCropHeight: number;
  frameLeftCap: number;
  frameCenterX: number;
  frameCenterWidth: number;
  frameRightCapX: number;
  fillLeft: number;
  fillTop: number;
  fillWidth: number;
  fillHeight: number;
  troughColor: string;
  sparkColor: string;
  glossColor: string;
}

interface BarStatusVisuals {
  poison?: EnemyPoisonState | null;
  burn?: EnemyBurnState | null;
}

interface BarFrameLayout {
  leftCapW: number;
  centerW: number;
  rightCapW: number;
  railW: number;
  centerX: number;
  rightRailX: number;
  rightCapX: number;
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
let landscapeLockRequested = false;
let lastCombatEventId = 0;
let screenShakeUntil = 0;
let screenShakeStrength = 0;
const floatingTexts: FloatingText[] = [];
const enemyHitEffects = new Map<string, EnemyHitEffect>();
const itemPulseUntil = new Map<string, number>();
const strikeEffects: StrikeEffect[] = [];
const heroAttackEffects: HeroAttackEffect[] = [];
const arenaSpriteEffects: AnimatedSpriteEffect[] = [];
const uiSpriteEffects: AnimatedSpriteEffect[] = [];
const deferredVisualActions: DeferredVisualAction[] = [];
const enemyPoisonStates = new Map<string, EnemyPoisonState>();
const enemyBurnStates = new Map<string, EnemyBurnState>();
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
  event.preventDefault();
  requestLandscapeViewport();
  pointer = pointerFromEvent(event);

  const item = itemAt(pointer.x, pointer.y);
  if (item && state.phase === "draft") {
    draggingItemId = item.instance.id;
    capturePointer(event.pointerId);
    return;
  }

  const hit = hitZones.find((zone) => inside(pointer, zone));
  if (hit) {
    hit.onClick();
    render();
  }
});

canvas.addEventListener("pointermove", (event) => {
  event.preventDefault();
  pointer = pointerFromEvent(event);
});

canvas.addEventListener("pointerup", (event) => {
  event.preventDefault();
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
    releasePointer(event.pointerId);
    render();
  }
});

canvas.addEventListener("pointercancel", (event) => {
  event.preventDefault();
  draggingItemId = null;
  releasePointer(event.pointerId);
});

canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
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
  const now = performance.now();
  consumeCombatEvents(now);
  flushDeferredVisualActions(now);
  pruneCombatVisuals(now);
  hitZones = [];
  const hoveredItem =
    !draggingItemId && snapshot.phase === "draft" ? itemAt(pointer.x, pointer.y) : null;
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawBackground();
  drawHeader();
  const shake = screenShakeOffset(now);
  ctx.save();
  ctx.translate(shake.x, shake.y);
  drawArena();
  drawCombatEffects(now);
  ctx.restore();
  drawRewardChoices();
  drawBackpack(hoveredItem);
  drawUiSpriteEffects(now);
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
  const layer = getBackgroundLayer();
  ctx.drawImage(layer, 0, 0, WIDTH, HEIGHT);
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
    drawClosedBagItemPulses(bagY);
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

  drawFusionHints();

  if (hoveredItem) {
    drawItemLinkHighlights(hoveredItem);
  }

  for (const item of snapshot.items) {
    const px = origin.x + item.instance.x * CELL + 2;
    const py = origin.y + item.instance.y * CELL + 2;
    const pulse = itemPulseAlpha(item.instance.id, performance.now());
    if (pulse > 0) {
      drawItemPulse(px - 2, py - 2, CELL - 4, pulse);
    }
    if (hoveredItem?.instance.id === item.instance.id) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.24;
      ctx.fillStyle = "#f3d18a";
      roundRect(px + 4, py + 4, CELL - 16, CELL - 16, 10, true);
      ctx.restore();
    }
    if (!drawSprite(itemSprites[item.def.id], px + 4, py + 4, CELL - 14, CELL - 14, 5)) {
      text(item.def.symbol, px + 27, py + 16, 18, "#fff7d6", "center", "monospace");
    }
    ctx.fillStyle = "rgba(16, 10, 7, 0.78)";
    roundRect(px + 4, py + CELL - 21, CELL - 16, 12, 4, true);
    text(item.def.name.slice(0, 3), px + CELL / 2 - 2, py + CELL - 21, 10, "#ffe6aa", "center");
  }

  drawFusionCellCues();
  drawFusionNotice();
  drawPlayerStatusPanel(42, 432, 330, 250);
}

function drawFusionHints(): void {
  const previews = snapshot.fusionPreviews.filter((preview) => !preview.queued);
  if (snapshot.phase !== "draft" || previews.length === 0) {
    return;
  }

  const pulse = 0.68 + Math.sin(performance.now() / 180) * 0.16;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(119, 255, 203, 0.72)";
  ctx.shadowBlur = 10;
  for (const preview of previews) {
    const centers = preview.ingredients.map((ingredient) => cellCenter(ingredient.x, ingredient.y));
    ctx.strokeStyle = `rgba(117, 245, 195, ${pulse})`;
    ctx.lineWidth = 4;
    for (let index = 1; index < centers.length; index += 1) {
      line(centers[index - 1]!.x, centers[index - 1]!.y, centers[index]!.x, centers[index]!.y);
    }
  }
  ctx.restore();
}

function drawFusionCellCues(): void {
  const previews = snapshot.fusionPreviews.filter((preview) => !preview.queued);
  if (snapshot.phase !== "draft" || previews.length === 0) {
    return;
  }

  const pulse = 0.68 + Math.sin(performance.now() / 180) * 0.16;
  ctx.save();
  ctx.shadowColor = "rgba(119, 255, 203, 0.72)";
  ctx.shadowBlur = 8;
  for (const preview of previews) {
    for (const ingredient of preview.ingredients) {
      drawFusionCellCue(ingredient.x, ingredient.y, pulse);
    }
  }
  ctx.restore();
}

function drawFusionCellCue(x: number, y: number, alpha: number): void {
  const origin = gridOrigin();
  const px = origin.x + x * CELL;
  const py = origin.y + y * CELL;
  ctx.fillStyle = `rgba(63, 196, 144, ${alpha * 0.18})`;
  roundRect(px + 2, py + 2, CELL - 8, CELL - 8, 7, true);
  ctx.strokeStyle = `rgba(144, 255, 207, ${alpha})`;
  ctx.lineWidth = 3;
  roundRect(px + 1, py + 1, CELL - 6, CELL - 6, 7, false);
  ctx.fillStyle = `rgba(13, 24, 19, ${0.72 + alpha * 0.12})`;
  roundRect(px + CELL - 23, py + 5, 17, 17, 5, true);
  text("合", px + CELL - 14, py + 6, 12, "#dfffe7", "center", '"Songti SC", Georgia, serif');
}

function drawFusionNotice(): void {
  const previews = snapshot.fusionPreviews.filter((preview) => !preview.queued);
  if (snapshot.phase !== "draft" || previews.length === 0) {
    return;
  }

  const label =
    previews.length === 1
      ? `战后合成: ${previews[0]!.result.name}`
      : `战后合成: ${previews[0]!.result.name} 等 ${previews.length} 组`;
  drawSmallSeal(BAG_X + 76, backpackVisualY + 82, BAG_W - 152, label);
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

  const y = BAG_OPEN_Y - 132;
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
  const now = performance.now();
  const attack = currentHeroAttack(now);
  const position = heroAttackPosition({ x, y }, attack, now);
  const frame = heroAttackFrame(attack, now);
  drawActorShadow(position.x, position.y + 98, attack ? 176 : 170, attack ? 31 : 33);
  if (
    !drawActorStripFrame(
      actorAnimationStrips.heroAttack,
      frame,
      position.x,
      position.y + 4,
      204,
      204,
    )
  ) {
    if (!drawActorSprite(actorSprites.hero, position.x - 88, position.y - 96, 176, 176)) {
      text("HERO", position.x, position.y - 9, 13, "#f7fbff", "center");
    }
  }
  const playerBarW = 190;
  const barX = position.x - playerBarW / 2;
  const barY = position.y + 79;
  drawHealthBar(
    barX,
    barY,
    playerBarW,
    40,
    snapshot.player.hp / snapshot.player.maxHp,
    "player",
    now,
  );
  text(
    `${Math.ceil(snapshot.player.hp)} / ${Math.ceil(snapshot.player.maxHp)}`,
    position.x,
    barY + 18,
    13,
    "#f5edd2",
    "center",
    undefined,
    "rgba(18, 11, 6, 0.9)",
  );
}
function drawEnemies(): void {
  const now = performance.now();
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
    const hit = enemyHitEffects.get(enemy.instance.id);
    const poisonState = enemyPoisonStates.get(enemy.instance.id);
    const burnState = enemyBurnStates.get(enemy.instance.id);
    const hitAlpha = hit ? Math.max(0, Math.min(1, (hit.until - now) / 240)) : 0;
    const hitBoost = hitAlpha * (hit?.critical ? 12 : 6);
    const groundY = y + size * 0.42;
    drawActorShadow(x, groundY, size, 22);
    if (
      !drawAnchoredActorSprite(actorSprites[spriteId], x, groundY, size + hitBoost, size + hitBoost)
    ) {
      text(enemy.def.symbol, x, y - 10, 13, "#fff4df", "center", "monospace");
    }
    if (poisonState && poisonState.activeUntil > now) {
      drawEnemyPoisonMotes(x, groundY - size * 0.44, size, poisonState, now);
    }
    if (burnState && burnState.activeUntil > now) {
      drawEnemyBurnMotes(x, groundY - size * 0.38, size, burnState, now);
    }
    const enemyBarW = spriteId === "boss" ? 212 : 176;
    const enemyBarH = spriteId === "boss" ? 38 : 32;
    const barX = x - enemyBarW / 2;
    const barY = groundY + 2;
    drawHealthBar(
      barX,
      barY,
      enemyBarW,
      enemyBarH,
      enemy.instance.hp / enemy.def.maxHp,
      "enemy",
      now,
      {
        poison: poisonState?.activeUntil && poisonState.activeUntil > now ? poisonState : null,
        burn: burnState?.activeUntil && burnState.activeUntil > now ? burnState : null,
      },
    );
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
  clearCombatVisuals();
}

function capturePointer(pointerId: number): void {
  try {
    canvas.setPointerCapture(pointerId);
  } catch {
    // Synthetic mobile smoke tests do not create a browser-level active pointer.
  }
}

function releasePointer(pointerId: number): void {
  try {
    if (canvas.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }
  } catch {
    // Pointer capture may already be gone after touch cancellation.
  }
}

function requestLandscapeViewport(): void {
  if (landscapeLockRequested || !window.matchMedia("(pointer: coarse)").matches) {
    return;
  }
  landscapeLockRequested = true;
  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (orientation: OrientationLockType) => Promise<void>;
  };
  void orientation.lock?.("landscape").catch(() => undefined);
}

function consumeCombatEvents(now: number): void {
  for (const event of snapshot.combatEvents) {
    if (event.id <= lastCombatEventId) {
      continue;
    }
    lastCombatEventId = Math.max(lastCombatEventId, event.id);
    handleCombatEvent(event, now);
  }
}

function handleCombatEvent(event: GameSnapshot["combatEvents"][number], now: number): void {
  switch (event.type) {
    case "waveStart":
      addFloatingText({
        id: event.id,
        x: WIDTH / 2,
        y: 112,
        dx: 0,
        value: "开战",
        color: "#f3d18a",
        size: 22,
        outline: "rgba(34, 17, 8, 0.85)",
        startedAt: now,
        durationMs: 780,
      });
      return;

    case "waveClear":
      addFloatingText({
        id: event.id,
        x: WIDTH / 2,
        y: 178,
        dx: 0,
        value: "清空",
        color: "#dfffe7",
        size: 24,
        outline: "rgba(18, 32, 23, 0.9)",
        startedAt: now,
        durationMs: 980,
      });
      return;

    case "damage": {
      const point = enemyPoint(event.targetLane, event.targetSlot);
      if (event.kind === "attack") {
        const attack = addHeroAttack(point, now, event.critical, event.id);
        const impactAt = heroAttackImpactAt(attack);
        queueDeferredVisualAction({
          id: event.id,
          triggerAt: impactAt,
          run: () => {
            emitDamageVisuals(event, point, impactAt);
          },
        });
      } else {
        emitDamageVisuals(event, point, now);
      }
      return;
    }

    case "enemyAttack": {
      const point = enemyPoint(event.enemyLane, event.enemySlot);
      addStrike(point, { x: 210, y: 452 }, "#ff7474", now, false, event.id);
      addFloatingText({
        id: event.id,
        x: 210 + jitter(event.id, 20),
        y: 430,
        dx: 0,
        value: `-${formatDamage(event.amount)}`,
        color: "#ff8b7a",
        size: 18,
        outline: "rgba(24, 6, 4, 0.9)",
        startedAt: now,
        durationMs: 720,
      });
      bumpScreenShake(now, 4, 140);
      return;
    }

    case "kill": {
      const point = enemyPoint(event.targetLane, event.targetSlot);
      addArenaSpriteEffect({
        id: event.id,
        strip: effectStrips.hitSpark,
        x: point.x,
        y: point.y,
        startedAt: now,
        durationMs: 320,
        size: 176,
        opacity: 0.88,
        rotation: jitter(event.id + 71, Math.PI * 0.5),
        lift: 0,
        blendMode: "screen",
      });
      addFloatingText({
        id: event.id,
        x: point.x,
        y: point.y - 86,
        dx: 0,
        value: "击破",
        color: "#fff2c4",
        size: 20,
        outline: "rgba(24, 13, 4, 0.92)",
        startedAt: now,
        durationMs: 900,
      });
      return;
    }

    case "fusionComplete":
      itemPulseUntil.set(event.resultInstanceId, now + 900);
      addUiSpriteEffect({
        id: event.id,
        strip: effectStrips.fusionGlow,
        x: BAG_X + BAG_W / 2,
        y: backpackVisualY + 164,
        anchorCell: { x: event.x, y: event.y },
        startedAt: now,
        durationMs: 620,
        size: 168,
        opacity: 0.94,
        rotation: 0,
        lift: 8,
        blendMode: "screen",
      });
      addFloatingText({
        id: event.id,
        x: BAG_X + BAG_W / 2,
        y: BAG_CLOSED_Y - 18,
        dx: 0,
        value: "合成完成",
        color: "#74f5c3",
        size: 20,
        outline: "rgba(7, 20, 15, 0.92)",
        startedAt: now,
        durationMs: 960,
      });
      return;
  }
}

function addFloatingText(textEffect: FloatingText): void {
  floatingTexts.push(textEffect);
}

function queueDeferredVisualAction(action: DeferredVisualAction): void {
  deferredVisualActions.push(action);
}

function addStrike(
  from: Point,
  to: Point,
  color: string,
  now: number,
  critical: boolean,
  id: number,
): void {
  strikeEffects.push({
    id,
    from,
    to,
    color,
    startedAt: now,
    durationMs: critical ? 360 : 280,
    critical,
  });
}

function addArenaSpriteEffect(effect: AnimatedSpriteEffect): void {
  arenaSpriteEffects.push(effect);
}

function addUiSpriteEffect(effect: AnimatedSpriteEffect): void {
  uiSpriteEffects.push(effect);
}

function bumpScreenShake(now: number, strength: number, durationMs: number): void {
  screenShakeStrength = Math.max(screenShakeStrength, strength);
  screenShakeUntil = Math.max(screenShakeUntil, now + durationMs);
}

function emitDamageVisuals(event: DamageCombatEvent, point: Point, startedAt: number): void {
  const color = damageColor(event.kind, event.critical);
  if (event.kind === "attack" || event.kind === "thorns") {
    enemyHitEffects.set(event.targetId, {
      until: startedAt + (event.critical ? 360 : 250),
      critical: event.critical,
    });
  }
  addFloatingText({
    id: event.id,
    x: point.x + jitter(event.id, 18),
    y: point.y - 58 + jitter(event.id + 11, 10),
    dx: jitter(event.id + 21, 18),
    value: `${event.critical ? "暴击 " : ""}${formatDamage(event.amount)}`,
    color,
    size: event.critical ? 24 : 17,
    outline: "rgba(6, 7, 6, 0.9)",
    startedAt,
    durationMs: event.critical ? 850 : 720,
  });
  if (event.kind === "thorns") {
    addArenaSpriteEffect({
      id: event.id,
      strip: effectStrips.hitSpark,
      x: point.x,
      y: point.y,
      startedAt,
      durationMs: 360,
      size: event.kind === "burn" ? 148 : 136,
      opacity: 0.9,
      rotation: jitter(event.id + 49, Math.PI * 0.32),
      lift: 0,
      blendMode: "screen",
    });
  } else if (event.kind === "burn") {
    const burnState = enemyBurnStates.get(event.targetId);
    enemyBurnStates.set(event.targetId, {
      activeUntil: Math.max(burnState?.activeUntil ?? 0, startedAt + 1450),
      tickFlashUntil: startedAt + 320,
    });
  } else if (event.kind === "poison") {
    const poisonState = enemyPoisonStates.get(event.targetId);
    enemyPoisonStates.set(event.targetId, {
      activeUntil: Math.max(poisonState?.activeUntil ?? 0, startedAt + 1450),
      tickFlashUntil: startedAt + 320,
    });
  }
  for (const sourceId of event.sourceIds) {
    itemPulseUntil.set(sourceId, startedAt + 620);
  }
  if (event.critical) {
    bumpScreenShake(startedAt, 9, 220);
  }
}

function drawCombatEffects(now: number): void {
  drawStrikes(now);
  drawArenaSpriteEffects(now);
  drawFloatingTexts(now);
}

function drawArenaSpriteEffects(now: number): void {
  drawSpriteEffects(arenaSpriteEffects, now);
}

function drawUiSpriteEffects(now: number): void {
  drawSpriteEffects(uiSpriteEffects, now);
}

function drawSpriteEffects(effects: AnimatedSpriteEffect[], now: number): void {
  for (const effect of effects) {
    const progress = Math.max(0, Math.min(1, (now - effect.startedAt) / effect.durationMs));
    const frame = Math.min(
      effect.strip.frameCount - 1,
      Math.floor(progress * effect.strip.frameCount),
    );
    const fade = progress < 0.72 ? 1 : 1 - (progress - 0.72) / 0.28;
    const point = effect.anchorCell
      ? cellCenter(effect.anchorCell.x, effect.anchorCell.y)
      : { x: effect.x, y: effect.y };
    const size = effect.size * (0.94 + easeOutCubic(progress) * 0.12);
    drawSpriteFrame(
      effect.strip,
      frame,
      point.x,
      point.y - effect.lift * easeOutCubic(progress),
      size,
      size,
      Math.max(0, fade * effect.opacity),
      effect.blendMode,
      effect.rotation,
    );
  }
}

function drawStrikes(now: number): void {
  ctx.save();
  ctx.lineCap = "round";
  ctx.globalCompositeOperation = "screen";
  for (const strike of strikeEffects) {
    const progress = Math.max(0, Math.min(1, (now - strike.startedAt) / strike.durationMs));
    const alpha = 1 - progress;
    const head = easeOutCubic(progress);
    const tail = Math.max(0, head - 0.28);
    const start = lerpPoint(strike.from, strike.to, tail);
    const end = lerpPoint(strike.from, strike.to, head);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = strike.color;
    ctx.lineWidth = strike.critical ? 8 : 5;
    line(start.x, start.y, end.x, end.y);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.78)";
    ctx.lineWidth = strike.critical ? 3 : 2;
    line(start.x, start.y, end.x, end.y);
  }
  ctx.restore();
}

function drawFloatingTexts(now: number): void {
  ctx.save();
  for (const float of floatingTexts) {
    const progress = Math.max(0, Math.min(1, (now - float.startedAt) / float.durationMs));
    const alpha = 1 - progress;
    const x = float.x + float.dx * progress;
    const y = float.y - 46 * easeOutCubic(progress);
    ctx.globalAlpha = alpha;
    text(float.value, x, y, float.size, float.color, "center", undefined, float.outline);
  }
  ctx.restore();
}

function drawItemPulse(x: number, y: number, size: number, alpha: number): void {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "#74f5c3";
  ctx.lineWidth = 4;
  roundRect(x - 2, y - 2, size + 4, size + 4, 8, false);
  ctx.globalAlpha = alpha * 0.18;
  ctx.fillStyle = "#74f5c3";
  roundRect(x, y, size, size, 8, true);
  ctx.restore();
}

function drawClosedBagItemPulses(bagY: number): void {
  const now = performance.now();
  const activeItems = snapshot.items
    .filter((item) => itemPulseAlpha(item.instance.id, now) > 0)
    .slice(0, 5);
  if (activeItems.length === 0) {
    return;
  }

  const iconSize = 34;
  const gap = 6;
  const totalW = activeItems.length * iconSize + (activeItems.length - 1) * gap;
  let x = BAG_X + BAG_W / 2 - totalW / 2;
  const y = bagY + 34;
  for (const item of activeItems) {
    const alpha = itemPulseAlpha(item.instance.id, now);
    ctx.save();
    ctx.globalAlpha = 0.66 + alpha * 0.34;
    drawItemPulse(x - 3, y - 3, iconSize + 6, alpha);
    drawSprite(itemSprites[item.def.id], x, y, iconSize, iconSize, 4);
    ctx.restore();
    x += iconSize + gap;
  }
}

function pruneCombatVisuals(now: number): void {
  removeExpired(floatingTexts, (item) => now - item.startedAt <= item.durationMs);
  removeExpired(strikeEffects, (item) => now - item.startedAt <= item.durationMs);
  removeExpired(heroAttackEffects, (item) => now - item.startedAt <= item.durationMs);
  removeExpired(arenaSpriteEffects, (item) => now - item.startedAt <= item.durationMs);
  removeExpired(uiSpriteEffects, (item) => now - item.startedAt <= item.durationMs);
  for (const [id, effect] of enemyHitEffects) {
    if (effect.until <= now) {
      enemyHitEffects.delete(id);
    }
  }
  for (const [id, until] of itemPulseUntil) {
    if (until <= now) {
      itemPulseUntil.delete(id);
    }
  }
  for (const [id, state] of enemyPoisonStates) {
    if (state.activeUntil <= now) {
      enemyPoisonStates.delete(id);
    }
  }
  for (const [id, state] of enemyBurnStates) {
    if (state.activeUntil <= now) {
      enemyBurnStates.delete(id);
    }
  }
  if (screenShakeUntil <= now) {
    screenShakeStrength = 0;
  }
}

function flushDeferredVisualActions(now: number): void {
  for (let index = deferredVisualActions.length - 1; index >= 0; index -= 1) {
    const action = deferredVisualActions[index]!;
    if (action.triggerAt > now) {
      continue;
    }
    deferredVisualActions.splice(index, 1);
    action.run();
  }
}

function clearCombatVisuals(): void {
  lastCombatEventId = 0;
  screenShakeUntil = 0;
  screenShakeStrength = 0;
  floatingTexts.length = 0;
  strikeEffects.length = 0;
  heroAttackEffects.length = 0;
  arenaSpriteEffects.length = 0;
  uiSpriteEffects.length = 0;
  deferredVisualActions.length = 0;
  enemyHitEffects.clear();
  enemyPoisonStates.clear();
  enemyBurnStates.clear();
  itemPulseUntil.clear();
}

function screenShakeOffset(now: number): Point {
  if (screenShakeUntil <= now || screenShakeStrength <= 0) {
    return { x: 0, y: 0 };
  }
  const progress = Math.max(0, Math.min(1, (screenShakeUntil - now) / 240));
  const amount = screenShakeStrength * progress;
  return {
    x: Math.sin(now * 0.09) * amount,
    y: Math.cos(now * 0.11) * amount * 0.62,
  };
}

function addHeroAttack(
  target: Point,
  now: number,
  critical: boolean,
  id: number,
): HeroAttackEffect {
  const durationMs = critical ? 610 : 540;
  const previous = heroAttackEffects.at(-1);
  const effect = {
    id,
    target,
    startedAt: previous ? Math.max(now, previous.startedAt + previous.durationMs) : now,
    durationMs,
    critical,
  };
  heroAttackEffects.push(effect);
  return effect;
}

function currentHeroAttack(now: number): HeroAttackEffect | null {
  for (let index = 0; index < heroAttackEffects.length; index += 1) {
    const effect = heroAttackEffects[index]!;
    if (now < effect.startedAt) {
      return null;
    }
    if (now - effect.startedAt <= effect.durationMs) {
      return effect;
    }
  }
  return null;
}

function heroAttackFrame(attack: HeroAttackEffect | null, now: number): number {
  if (!attack || now < attack.startedAt) {
    return 0;
  }
  const progress = heroAttackProgress(attack, now);
  const sequence = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 23, 23,
  ];
  return sequence[Math.min(sequence.length - 1, Math.floor(progress * sequence.length))] ?? 23;
}

function heroAttackProgress(attack: HeroAttackEffect | null, now: number): number {
  if (!attack || now < attack.startedAt) {
    return 0;
  }
  return Math.max(0, Math.min(1, (now - attack.startedAt) / attack.durationMs));
}

function heroAttackPosition(base: Point, attack: HeroAttackEffect | null, now: number): Point {
  if (!attack || now < attack.startedAt) {
    return base;
  }
  const progress = heroAttackProgress(attack, now);
  const staging = heroAttackStagingPoint(base, attack.target);
  if (progress < 0.44) {
    return lerpPoint(base, staging, easeOutCubic(progress / 0.44));
  }
  if (progress < 0.7) {
    const strikePhase = (progress - 0.44) / 0.26;
    const lunge = Math.sin(strikePhase * Math.PI) * 16;
    return {
      x: staging.x + lunge,
      y: staging.y - lunge * 0.08,
    };
  }
  return lerpPoint(staging, base, easeOutCubic((progress - 0.7) / 0.3));
}

function heroAttackImpactAt(attack: HeroAttackEffect): number {
  return attack.startedAt + attack.durationMs * (18 / 26);
}

function heroAttackStagingPoint(base: Point, target: Point): Point {
  const desiredX = Math.max(base.x + 32, Math.min(target.x - 132, WIDTH - 212));
  const desiredY = Math.max(280, Math.min(base.y + (target.y - base.y) * 0.55, 452));
  return {
    x: desiredX,
    y: desiredY,
  };
}

function itemPulseAlpha(instanceId: string, now: number): number {
  const until = itemPulseUntil.get(instanceId) ?? 0;
  return Math.max(0, Math.min(1, (until - now) / 620));
}

function enemyPoint(lane: number, slot: number): Point {
  return {
    x: 925 + Math.max(0, slot) * 100,
    y: 270 + Math.max(0, Math.min(2, lane)) * 118,
  };
}

function damageColor(kind: "attack" | "burn" | "poison" | "thorns", critical: boolean): string {
  if (critical) {
    return "#fff2c4";
  }
  switch (kind) {
    case "attack":
      return "#f3d18a";
    case "burn":
      return "#ff8a3d";
    case "poison":
      return "#74f5a0";
    case "thorns":
      return "#9ddcff";
  }
}

function formatDamage(amount: number): string {
  return `${Math.max(1, Math.round(amount))}`;
}

function jitter(id: number, amount: number): number {
  const raw = Math.sin(id * 12.9898) * 43758.5453;
  return (raw - Math.floor(raw) - 0.5) * amount;
}

function lerpPoint(from: Point, to: Point, ratio: number): Point {
  return {
    x: from.x + (to.x - from.x) * ratio,
    y: from.y + (to.y - from.y) * ratio,
  };
}

function easeOutCubic(value: number): number {
  return 1 - (1 - value) ** 3;
}

function removeExpired<T>(items: T[], keep: (item: T) => boolean): void {
  let writeIndex = 0;
  for (const item of items) {
    if (keep(item)) {
      items[writeIndex] = item;
      writeIndex += 1;
    }
  }
  items.length = writeIndex;
}

function drawBattleLedger(): void {
  const x = 76;
  const y = 112;
  text("战绩", x, y, 18, "#f3d18a", "left", '"Songti SC", Georgia, serif');
  text(`击杀 ${snapshot.totals.kills}`, x, y + 30, 14, "#d6c5a1");
  text(`伤害 ${Math.round(snapshot.totals.damageDone)}`, x, y + 52, 14, "#d6c5a1");
  let cursorY = y + 82;
  const queuedFusions = snapshot.fusionPreviews.filter((preview) => preview.queued);
  if (queuedFusions.length > 0) {
    text("战后合成", x, cursorY, 14, "#74f5c3");
    cursorY += 21;
    cursorY += wrapText(fusionPreviewSummary(queuedFusions), x, cursorY, 230, 17, 12, "#d6c5a1");
    cursorY += 8;
  }
  for (const lineText of snapshot.log.slice(-2)) {
    cursorY += wrapText(lineText, x, cursorY, 230, 18, 12, "#aeb8ad");
  }
}

function fusionPreviewSummary(previews: GameSnapshot["fusionPreviews"]): string {
  const labels = previews.map((preview) => {
    const ingredients = preview.ingredients.map((ingredient) => ingredient.def.name).join(" + ");
    return `${ingredients} -> ${preview.result.name}`;
  });
  if (labels.length <= 2) {
    return labels.join("；");
  }
  return `${labels.slice(0, 2).join("；")} 等 ${labels.length} 组`;
}

function rewardCard(x: number, y: number, item: ItemDef): void {
  const hovered =
    pointer.x >= x &&
    pointer.x <= x + REWARD_CARD_W &&
    pointer.y >= y &&
    pointer.y <= y + REWARD_CARD_H;
  const cardSprite = rewardCardSprites[item.rarity];
  drawSprite(hovered ? cardSprite.hover : cardSprite.normal, x, y, REWARD_CARD_W, REWARD_CARD_H, 0);
  drawSprite(itemSprites[item.id], x + 25, y + 27, 66, 66, 5);
  const textX = x + 140;
  const textY = y + 34;
  const textW = 178;
  ctx.save();
  ctx.beginPath();
  ctx.rect(textX, textY, textW, 58);
  ctx.clip();
  fittedText(item.name, textX, textY, textW, 16, "#fff2c4");
  text(rarityLabel[item.rarity], textX, textY + 23, 10, "#9cb4bd");
  fittedText(rewardPrimaryStat(item), textX + 38, textY + 21, textW - 38, 13, "#f3d18a");
  fittedText(shortRewardEffectSummary(item), textX, textY + 42, textW, 12, "#d6e2c4");
  ctx.restore();
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

function rewardPrimaryStat(item: ItemDef): string {
  const stat = statPairs({ ...zeroStats(), ...item.stats })[0];
  return stat ? `${stat.label} ${stat.value}` : "无基础数值";
}

function shortRewardEffectSummary(item: ItemDef): string {
  const effect = item.effects[0];
  return effect ? shortEffectDescription(effect) : item.description;
}

function drawResultCard(): void {
  const w = 560;
  const h = 188;
  const x = (WIDTH - w) / 2;
  const y = 488;
  const inset = 70;
  const contentW = w - inset * 2;
  const isVictory = snapshot.phase === "victory";

  drawPanelBackground(uiSprites.panelResult, x, y, w, h);
  text(
    isVictory ? "胜利结算" : "失败结算",
    x + w / 2,
    y + 46,
    22,
    isVictory ? "#ffe7a7" : "#ffc2a0",
    "center",
    '"Songti SC", Georgia, serif',
    "rgba(28, 12, 4, 0.9)",
  );

  const reason = snapshot.endReason ?? (isVictory ? "远征完成" : "远征中止");
  wrapText(reason, x + inset, y + 82, contentW, 20, 14, "#e4d1ad", "rgba(8, 6, 5, 0.86)");
  drawDivider(x + inset, y + 112, contentW);
  text(
    `击杀 ${snapshot.totals.kills}`,
    x + inset,
    y + 128,
    14,
    "#f1d59a",
    "left",
    undefined,
    "rgba(8, 6, 5, 0.86)",
  );
  text(
    `伤害 ${Math.round(snapshot.totals.damageDone)}`,
    x + w / 2,
    y + 128,
    14,
    "#f1d59a",
    "center",
    undefined,
    "rgba(8, 6, 5, 0.86)",
  );
  text(
    `纹章 ${snapshot.shareCode}`,
    x + w - inset,
    y + 128,
    14,
    "#f1d59a",
    "right",
    undefined,
    "rgba(8, 6, 5, 0.86)",
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

  drawPanelBackground(uiSprites.panelItemTooltip, x, y, w, h);

  drawSprite(itemSprites[item.def.id], x + innerX, y + 42, 68, 68, 6);
  text(
    item.def.name,
    x + innerX + 78,
    y + 48,
    20,
    "#ffe6aa",
    "left",
    '"Songti SC", Georgia, serif',
    "rgba(12, 7, 4, 0.9)",
  );
  text(
    `${rarityLabel[item.def.rarity]} | ${item.def.tags.map(formatTag).join(" / ")}`,
    x + innerX + 78,
    y + 78,
    13,
    "#b9c8b5",
    "left",
    undefined,
    "rgba(12, 7, 4, 0.9)",
  );
  const descriptionHeight = wrapText(
    item.def.description,
    x + innerX,
    y + 116,
    innerW,
    18,
    13,
    "#e6d2aa",
    "rgba(12, 7, 4, 0.86)",
  );

  let cursorY = y + 116 + descriptionHeight + 14;
  drawDivider(x + innerX, cursorY, innerW);
  cursorY += 12;
  text("当前贡献", x + innerX, cursorY, 14, "#f3d18a", "left", undefined, "rgba(12, 7, 4, 0.86)");
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
  text("连携状态", x + innerX, cursorY, 14, "#f3d18a", "left", undefined, "rgba(12, 7, 4, 0.86)");
  cursorY += 22;
  if (effectRows.length === 0) {
    text(
      "无连携效果",
      x + innerX,
      cursorY,
      13,
      "#b9c8b5",
      "left",
      undefined,
      "rgba(12, 7, 4, 0.86)",
    );
    return;
  }
  for (const row of effectRows) {
    drawEffectRow(x + innerX, cursorY, innerW, row);
    cursorY += 30;
  }
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

function shortEffectDescription(effect: EffectDef): string {
  const amount = `${statLabel[effect.stat]} ${effect.amount > 0 ? "+" : ""}${fmtStat(effect.stat, effect.amount)}`;
  switch (effect.type) {
    case "adjacentTag":
      return `邻接${formatTag(effect.tag)}: ${amount}`;
    case "sameRowTag":
      return `同行${formatTag(effect.tag)}: ${amount}`;
    case "corner":
      return `角落位: ${amount}`;
    case "emptyNeighbor":
      return `空邻格: ${amount}`;
    case "lowHp":
      return `低血量: ${amount}`;
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
  if (
    !drawSprite(itemSprites[item.def.id], pointer.x - 27, pointer.y - 27, CELL - 18, CELL - 18, 6)
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

function drawFallbackBar(
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  color: string,
): void {
  ctx.fillStyle = "rgba(35, 27, 20, 0.88)";
  roundRect(x, y, w, h, h / 2, true);
  ctx.fillStyle = color;
  roundRect(x, y, Math.max(0, Math.min(w, w * ratio)), h, h / 2, true);
  ctx.strokeStyle = "rgba(255, 235, 180, 0.22)";
  ctx.lineWidth = 1;
  roundRect(x, y, w, h, h / 2, false);
}

function drawHealthBar(
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  themeName: BarThemeName,
  now: number,
  states: BarStatusVisuals = {},
): void {
  const theme = barThemes[themeName];
  const frame = spriteCache.get(theme.framePath);
  if (!frame?.complete || frame.naturalWidth === 0) {
    drawFallbackBar(
      x,
      y + h * 0.36,
      w,
      h * 0.24,
      ratio,
      themeName === "player" ? "#63d990" : "#cf4e4e",
    );
    return;
  }

  const cropHeight = Math.min(theme.frameCropHeight, frame.naturalHeight);
  const layout = barFrameLayout(theme, frame.naturalWidth, x, w, h, cropHeight);
  const fillX = sourceBarXToDest(theme, frame.naturalWidth, layout, x, theme.fillLeft);
  const fillRight = sourceBarXToDest(
    theme,
    frame.naturalWidth,
    layout,
    x,
    theme.fillLeft + theme.fillWidth,
  );
  const fillY = y + (theme.fillTop / cropHeight) * h;
  const fillW = Math.max(0, fillRight - fillX);
  const fillH = (theme.fillHeight / cropHeight) * h;

  drawBarFill(themeName, fillX, fillY, fillW, fillH, ratio, now, states);
  drawStretchableBarFrame(frame, theme, x, y, h, cropHeight, layout);
  drawBarStatusBadges(x, y, w, h, now, states);
}

function drawStretchableBarFrame(
  frame: HTMLImageElement,
  theme: BarTheme,
  x: number,
  y: number,
  h: number,
  cropHeight: number,
  layout: BarFrameLayout,
): void {
  const rightCapSourceW = frame.naturalWidth - theme.frameRightCapX;

  drawFrameSlice(frame, 0, theme.frameLeftCap, x, y, layout.leftCapW, h, cropHeight);
  drawFrameSlice(
    frame,
    theme.frameLeftCap,
    theme.frameCenterX - theme.frameLeftCap,
    x + layout.leftCapW,
    y,
    layout.railW,
    h,
    cropHeight,
  );
  drawFrameSlice(
    frame,
    theme.frameCenterX,
    theme.frameCenterWidth,
    layout.centerX,
    y,
    layout.centerW,
    h,
    cropHeight,
  );
  drawFrameSlice(
    frame,
    theme.frameCenterX + theme.frameCenterWidth,
    theme.frameRightCapX - theme.frameCenterX - theme.frameCenterWidth,
    layout.rightRailX,
    y,
    layout.railW,
    h,
    cropHeight,
  );
  drawFrameSlice(
    frame,
    theme.frameRightCapX,
    rightCapSourceW,
    layout.rightCapX,
    y,
    layout.rightCapW,
    h,
    cropHeight,
  );
}

function barFrameLayout(
  theme: BarTheme,
  frameWidth: number,
  x: number,
  w: number,
  h: number,
  cropHeight: number,
): BarFrameLayout {
  const scale = h / cropHeight;
  const rightCapSourceW = frameWidth - theme.frameRightCapX;
  const leftCapW = Math.min(w * 0.28, theme.frameLeftCap * scale);
  const centerW = Math.min(w * 0.18, theme.frameCenterWidth * scale);
  const rightCapW = Math.min(w * 0.28, rightCapSourceW * scale);
  const railW = Math.max(1, (w - leftCapW - centerW - rightCapW) / 2);
  const centerX = x + leftCapW + railW;
  const rightRailX = centerX + centerW;
  const rightCapX = x + w - rightCapW;
  return { leftCapW, centerW, rightCapW, railW, centerX, rightRailX, rightCapX };
}

function sourceBarXToDest(
  theme: BarTheme,
  frameWidth: number,
  layout: BarFrameLayout,
  x: number,
  sourceX: number,
): number {
  if (sourceX <= theme.frameLeftCap) {
    return x + (sourceX / theme.frameLeftCap) * layout.leftCapW;
  }
  if (sourceX <= theme.frameCenterX) {
    const sourceW = theme.frameCenterX - theme.frameLeftCap;
    return x + layout.leftCapW + ((sourceX - theme.frameLeftCap) / sourceW) * layout.railW;
  }
  if (sourceX <= theme.frameCenterX + theme.frameCenterWidth) {
    return (
      layout.centerX + ((sourceX - theme.frameCenterX) / theme.frameCenterWidth) * layout.centerW
    );
  }
  if (sourceX <= theme.frameRightCapX) {
    const sourceW = theme.frameRightCapX - theme.frameCenterX - theme.frameCenterWidth;
    return (
      layout.rightRailX +
      ((sourceX - theme.frameCenterX - theme.frameCenterWidth) / sourceW) * layout.railW
    );
  }
  return (
    layout.rightCapX +
    ((sourceX - theme.frameRightCapX) / (frameWidth - theme.frameRightCapX)) * layout.rightCapW
  );
}

function drawFrameSlice(
  frame: HTMLImageElement,
  sourceX: number,
  sourceW: number,
  x: number,
  y: number,
  w: number,
  h: number,
  cropHeight: number,
): void {
  if (sourceW <= 0 || w <= 0) {
    return;
  }
  ctx.drawImage(frame, sourceX, 0, sourceW, cropHeight, x, y, w, h);
}

function drawBarFill(
  themeName: BarThemeName,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  now: number,
  states: BarStatusVisuals,
): void {
  const theme = barThemes[themeName];
  const fillRatio = Math.max(0, Math.min(1, ratio));
  const currentW = Math.max(0, w * fillRatio);
  const radius = Math.max(2, h / 2);

  ctx.save();
  ctx.fillStyle = theme.troughColor;
  roundRect(x, y, w, h, radius, true);
  ctx.restore();

  if (currentW <= 0.5) {
    return;
  }

  ctx.save();
  clippedRoundRect(x, y, currentW, h, Math.max(1, Math.min(radius, currentW / 2)));
  drawBarFillTexture(themeName, x, y, currentW, h);
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.18;
  const glossW = Math.max(24, currentW * 0.3);
  const glossX = x - glossW + ((now * 0.12) % (currentW + glossW));
  const gloss = ctx.createLinearGradient(glossX, y, glossX + glossW, y);
  gloss.addColorStop(0, "rgba(255,255,255,0)");
  gloss.addColorStop(0.5, theme.glossColor);
  gloss.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gloss;
  ctx.fillRect(glossX, y, glossW, h);
  drawBarStateEffects(x, y, currentW, h, now, states);
  drawBarSparkles(x, y, currentW, h, theme.sparkColor, now);
  ctx.restore();
}

function drawBarFillTexture(
  themeName: BarThemeName,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const theme = barThemes[themeName];
  const image = spriteCache.get(theme.fillPath);
  if (!image?.complete || image.naturalWidth === 0) {
    const gradient = ctx.createLinearGradient(x, y, x + w, y);
    gradient.addColorStop(0, themeName === "player" ? "#278c45" : "#8c1e18");
    gradient.addColorStop(0.5, themeName === "player" ? "#80ed62" : "#ff6a23");
    gradient.addColorStop(1, themeName === "player" ? "#1b6739" : "#6e1517");
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, w, h);
    return;
  }

  const sourceX = Math.round(image.naturalWidth * 0.22);
  const sourceY = Math.round(image.naturalHeight * 0.14);
  const sourceW = Math.round(image.naturalWidth * 0.56);
  const sourceH = Math.round(image.naturalHeight * 0.72);
  ctx.drawImage(image, sourceX, sourceY, sourceW, sourceH, x, y, w, h);
}

function drawBarStateEffects(
  x: number,
  y: number,
  w: number,
  h: number,
  now: number,
  states: BarStatusVisuals,
): void {
  if (states.poison) {
    const activeAlpha = Math.max(0, Math.min(1, (states.poison.activeUntil - now) / 1450));
    const flashAlpha = Math.max(0, Math.min(1, (states.poison.tickFlashUntil - now) / 320));
    const sweepW = Math.max(18, h * 1.35);
    const sweepX = x - sweepW + ((now * 0.13) % (w + sweepW));
    const sweep = ctx.createLinearGradient(sweepX, y, sweepX + sweepW, y);
    sweep.addColorStop(0, "rgba(75, 244, 126, 0)");
    sweep.addColorStop(0.5, `rgba(132, 255, 163, ${0.12 + activeAlpha * 0.2 + flashAlpha * 0.2})`);
    sweep.addColorStop(1, "rgba(75, 244, 126, 0)");
    ctx.fillStyle = sweep;
    ctx.fillRect(sweepX, y, sweepW, h);
  }
  if (states.burn) {
    const activeAlpha = Math.max(0, Math.min(1, (states.burn.activeUntil - now) / 1450));
    const flashAlpha = Math.max(0, Math.min(1, (states.burn.tickFlashUntil - now) / 320));
    for (let index = 0; index < 3; index += 1) {
      const emberX = x + ((now * 0.11 + index * 23) % Math.max(28, w));
      const emberY = y + h * (0.3 + ((index * 19) % 7) / 18);
      const emberR = 1.1 + flashAlpha * 1.1 + index * 0.18;
      ctx.globalAlpha = 0.18 + activeAlpha * 0.16 + flashAlpha * 0.12;
      ctx.fillStyle = index === 0 ? "#ffe4aa" : "#ff7d2d";
      ctx.beginPath();
      ctx.arc(emberX, emberY, emberR, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawBarSparkles(
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  now: number,
): void {
  if (w < 8) {
    return;
  }
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let index = 0; index < 3; index += 1) {
    const px = x + ((now * 0.05 + index * 37) % Math.max(16, w));
    const py = y + h * (0.22 + ((index * 11) % 7) / 16);
    const radius = index === 0 ? 1.4 : 1;
    ctx.globalAlpha = index === 0 ? 0.28 : 0.16;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBarStatusBadges(
  x: number,
  y: number,
  w: number,
  h: number,
  now: number,
  states: BarStatusVisuals,
): void {
  const badges: Array<{ path: string; activeUntil: number; flashUntil: number }> = [];
  if (states.poison) {
    badges.push({
      path: uiSprites.debuffPoison,
      activeUntil: states.poison.activeUntil,
      flashUntil: states.poison.tickFlashUntil,
    });
  }
  if (states.burn) {
    badges.push({
      path: uiSprites.debuffBurn,
      activeUntil: states.burn.activeUntil,
      flashUntil: states.burn.tickFlashUntil,
    });
  }
  if (badges.length === 0) {
    return;
  }

  const size = Math.max(12, Math.min(18, h * 0.44));
  const gap = Math.max(4, size * 0.16);
  const totalW = badges.length * size + (badges.length - 1) * gap;
  let iconX = x + w / 2 - totalW / 2;
  const iconY = y + h - 1;
  for (const badge of badges) {
    drawDebuffBadge(iconX, iconY, size, badge.path, badge.activeUntil, badge.flashUntil, now);
    iconX += size + gap;
  }
}

function drawDebuffBadge(
  x: number,
  y: number,
  size: number,
  path: string,
  activeUntil: number,
  flashUntil: number,
  now: number,
): void {
  const activeAlpha = Math.max(0, Math.min(1, (activeUntil - now) / 1450));
  const flashAlpha = Math.max(0, Math.min(1, (flashUntil - now) / 320));
  ctx.save();
  ctx.globalAlpha = 0.78 + activeAlpha * 0.18;
  ctx.shadowColor = `rgba(255, 239, 180, ${0.18 + flashAlpha * 0.22})`;
  ctx.shadowBlur = 10;
  drawSprite(path, x, y, size, size, Math.max(3, size * 0.2));
  ctx.restore();
}

function drawEnemyPoisonMotes(
  x: number,
  y: number,
  size: number,
  state: EnemyPoisonState,
  now: number,
): void {
  const activeAlpha = Math.max(0, Math.min(1, (state.activeUntil - now) / 1450));
  const flashAlpha = Math.max(0, Math.min(1, (state.tickFlashUntil - now) / 320));
  const radius = size * 0.24;

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let index = 0; index < 3; index += 1) {
    const angle = now / 260 + index * 2.2;
    const moteX = x + Math.cos(angle) * radius * (0.62 + index * 0.16);
    const moteY = y + Math.sin(angle * 1.1) * 7 - index * 6;
    const moteR = 2.4 + (index === 0 ? flashAlpha * 1.6 : activeAlpha * 0.8);
    ctx.globalAlpha = 0.18 + activeAlpha * 0.18 + flashAlpha * 0.28;
    ctx.fillStyle = index === 0 ? "#b8ffb0" : "#56d86d";
    ctx.beginPath();
    ctx.arc(moteX, moteY, moteR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawEnemyBurnMotes(
  x: number,
  y: number,
  size: number,
  state: EnemyBurnState,
  now: number,
): void {
  const activeAlpha = Math.max(0, Math.min(1, (state.activeUntil - now) / 1450));
  const flashAlpha = Math.max(0, Math.min(1, (state.tickFlashUntil - now) / 320));
  const radius = size * 0.19;

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let index = 0; index < 3; index += 1) {
    const angle = now / 220 + index * 2.4;
    const moteX = x + Math.cos(angle) * radius * (0.58 + index * 0.12);
    const moteY = y + Math.sin(angle * 1.3) * 5 - index * 5;
    const moteR = 1.9 + (index === 0 ? flashAlpha * 1.4 : activeAlpha * 0.7);
    ctx.globalAlpha = 0.16 + activeAlpha * 0.14 + flashAlpha * 0.24;
    ctx.fillStyle = index === 0 ? "#ffd594" : "#ff7d2d";
    ctx.beginPath();
    ctx.arc(moteX, moteY, moteR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
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
    ...Object.values(actorAnimationStrips).map((strip) => strip.path),
    ...Object.values(uiSprites),
    ...Object.values(effectStrips).map((strip) => strip.path),
    ...Object.values(rewardCardSprites).flatMap((sprites) => [sprites.normal, sprites.hover]),
  ]) {
    const image = new Image();
    image.onload = () => {
      invalidateDerivedSpriteCaches(path);
      render();
    };
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

function drawSpriteFrame(
  strip: SpriteStripDef,
  frame: number,
  x: number,
  y: number,
  w: number,
  h: number,
  alpha: number,
  blendMode: GlobalCompositeOperation,
  rotation = 0,
): boolean {
  const image = spriteCache.get(strip.path);
  if (!image?.complete || image.naturalWidth === 0) {
    return false;
  }
  const frameIndex = Math.max(0, Math.min(strip.frameCount - 1, frame));
  const sourceX = frameIndex * strip.frameWidth;
  ctx.save();
  ctx.translate(x, y);
  if (rotation !== 0) {
    ctx.rotate(rotation);
  }
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = blendMode;
  ctx.drawImage(image, sourceX, 0, strip.frameWidth, strip.frameHeight, -w / 2, -h / 2, w, h);
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
  destInsetOverride?: number,
): boolean {
  const image = spriteCache.get(path);
  if (!image?.complete || image.naturalWidth === 0) {
    return false;
  }
  const iw = image.naturalWidth;
  const ih = image.naturalHeight;
  const sourceInset = Math.max(1, Math.min(inset, Math.floor(iw / 2) - 1, Math.floor(ih / 2) - 1));
  const maxDestInset = Math.max(1, Math.floor(Math.min(w, h) * 0.32));
  const requestedDestInset = destInsetOverride ?? sourceInset;
  const destInset = Math.max(1, Math.min(requestedDestInset, maxDestInset));
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
  options: ActorDrawOptions = {},
): boolean {
  if (!path) {
    return false;
  }
  const image = spriteCache.get(path);
  if (!image?.complete || image.naturalWidth === 0) {
    return false;
  }
  const hasTransform =
    options.rotation || (options.scaleX ?? 1) !== 1 || (options.scaleY ?? 1) !== 1;
  if (!hasTransform && (options.alpha ?? 1) === 1) {
    const cached = getActorSpriteSurface(path, image, w, h);
    if (cached) {
      ctx.drawImage(cached, x - cached.width / 2, y - cached.height / 2);
      return true;
    }
  }
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  if (options.rotation) {
    ctx.rotate(options.rotation);
  }
  ctx.scale(options.scaleX ?? 1, options.scaleY ?? 1);
  ctx.globalAlpha = options.alpha ?? 1;
  ctx.filter = ACTOR_FILTER;
  ctx.drawImage(image, -w / 2, -h / 2, w, h);
  ctx.restore();
  return true;
}

function drawAnchoredActorSprite(
  path: string | undefined,
  anchorX: number,
  anchorBottomY: number,
  w: number,
  h: number,
): boolean {
  if (!path) {
    return false;
  }
  const image = spriteCache.get(path);
  if (!image?.complete || image.naturalWidth === 0) {
    return false;
  }
  const cached = getActorSpriteSurface(path, image, w, h);
  const bounds = getSpriteBounds(path, image);
  if (!cached || !bounds) {
    return drawActorSprite(path, anchorX - w / 2, anchorBottomY - h, w, h);
  }

  const paddingX = (cached.width - w) / 2;
  const paddingY = (cached.height - h) / 2;
  const visibleCenterX = paddingX + ((bounds.left + bounds.right) / 2 / image.naturalWidth) * w;
  const visibleBottomY = paddingY + (bounds.bottom / image.naturalHeight) * h;
  ctx.drawImage(cached, anchorX - visibleCenterX, anchorBottomY - visibleBottomY);
  return true;
}

function drawActorStripFrame(
  strip: SpriteStripDef,
  frame: number,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  const image = spriteCache.get(strip.path);
  if (!image?.complete || image.naturalWidth === 0) {
    return false;
  }
  const frameIndex = Math.max(0, Math.min(strip.frameCount - 1, frame));
  const sourceX = frameIndex * strip.frameWidth;
  let drawY = y;
  if (strip.anchorBottom) {
    const boundsEntry = getStripBounds(strip, image);
    const frameBounds = boundsEntry?.frames[frameIndex];
    if (frameBounds) {
      drawY += ((boundsEntry.maxBottom - frameBounds.bottom) / strip.frameHeight) * h;
    }
  }
  const cached = getActorStripFrameSurface(strip, image, frameIndex, w, h);
  if (cached) {
    ctx.drawImage(cached, x - cached.width / 2, drawY - cached.height / 2);
    return true;
  }
  ctx.save();
  ctx.translate(x, drawY);
  ctx.filter = ACTOR_FILTER;
  ctx.drawImage(image, sourceX, 0, strip.frameWidth, strip.frameHeight, -w / 2, -h / 2, w, h);
  ctx.restore();
  return true;
}

function getStripBounds(
  strip: SpriteStripDef,
  image: HTMLImageElement,
): StripBoundsCacheEntry | null {
  const cached = stripBoundsCache.get(strip.path);
  if (cached) {
    return cached;
  }
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }
  context.drawImage(image, 0, 0);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const frames: FrameBounds[] = [];
  let maxBottom = 0;

  for (let frameIndex = 0; frameIndex < strip.frameCount; frameIndex += 1) {
    const frameStartX = frameIndex * strip.frameWidth;
    let top = strip.frameHeight;
    let bottom = -1;

    for (let py = 0; py < strip.frameHeight; py += 1) {
      for (let px = 0; px < strip.frameWidth; px += 1) {
        const alphaIndex = (py * canvas.width + frameStartX + px) * 4 + 3;
        if ((data[alphaIndex] ?? 0) <= 8) {
          continue;
        }
        top = Math.min(top, py);
        bottom = Math.max(bottom, py);
      }
    }

    const resolved = {
      top: top === strip.frameHeight ? 0 : top,
      bottom: bottom < 0 ? strip.frameHeight - 1 : bottom,
    };
    frames.push(resolved);
    maxBottom = Math.max(maxBottom, resolved.bottom);
  }

  const entry = { frames, maxBottom };
  stripBoundsCache.set(strip.path, entry);
  return entry;
}

function getSpriteBounds(path: string, image: HTMLImageElement): SpriteBounds | null {
  const cached = actorSpriteBoundsCache.get(path);
  if (cached) {
    return cached;
  }
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }
  context.drawImage(image, 0, 0);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let left = canvas.width;
  let right = -1;
  let top = canvas.height;
  let bottom = -1;

  for (let py = 0; py < canvas.height; py += 1) {
    for (let px = 0; px < canvas.width; px += 1) {
      const alphaIndex = (py * canvas.width + px) * 4 + 3;
      if ((data[alphaIndex] ?? 0) <= 8) {
        continue;
      }
      left = Math.min(left, px);
      right = Math.max(right, px);
      top = Math.min(top, py);
      bottom = Math.max(bottom, py);
    }
  }

  const resolved = {
    left: left === canvas.width ? 0 : left,
    right: right < 0 ? canvas.width - 1 : right,
    top: top === canvas.height ? 0 : top,
    bottom: bottom < 0 ? canvas.height - 1 : bottom,
  };
  actorSpriteBoundsCache.set(path, resolved);
  return resolved;
}

function getBackgroundLayer(): HTMLCanvasElement {
  if (backgroundLayerCache) {
    return backgroundLayerCache;
  }
  const layer = document.createElement("canvas");
  layer.width = WIDTH;
  layer.height = HEIGHT;
  const layerCtx = layer.getContext("2d");
  if (!layerCtx) {
    return layer;
  }

  const drawLine = (x1: number, y1: number, x2: number, y2: number): void => {
    layerCtx.beginPath();
    layerCtx.moveTo(x1, y1);
    layerCtx.lineTo(x2, y2);
    layerCtx.stroke();
  };
  const drawRoundedRect = (
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
    fill: boolean,
  ): void => {
    const r = Math.min(radius, w / 2, h / 2);
    layerCtx.beginPath();
    layerCtx.moveTo(x + r, y);
    layerCtx.lineTo(x + w - r, y);
    layerCtx.quadraticCurveTo(x + w, y, x + w, y + r);
    layerCtx.lineTo(x + w, y + h - r);
    layerCtx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    layerCtx.lineTo(x + r, y + h);
    layerCtx.quadraticCurveTo(x, y + h, x, y + h - r);
    layerCtx.lineTo(x, y + r);
    layerCtx.quadraticCurveTo(x, y, x + r, y);
    if (fill) {
      layerCtx.fill();
    } else {
      layerCtx.stroke();
    }
  };
  const backgroundImage = spriteCache.get(backgroundSprite);
  if (backgroundImage?.complete && backgroundImage.naturalWidth > 0) {
    const scale = Math.max(
      WIDTH / backgroundImage.naturalWidth,
      HEIGHT / backgroundImage.naturalHeight,
    );
    const drawWidth = backgroundImage.naturalWidth * scale;
    const drawHeight = backgroundImage.naturalHeight * scale;
    layerCtx.drawImage(
      backgroundImage,
      (WIDTH - drawWidth) / 2,
      (HEIGHT - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );
    layerCtx.fillStyle = "rgba(4, 8, 9, 0.12)";
    layerCtx.fillRect(0, 0, WIDTH, HEIGHT);
    const vignette = layerCtx.createRadialGradient(
      WIDTH * 0.48,
      HEIGHT * 0.43,
      140,
      WIDTH * 0.48,
      HEIGHT * 0.43,
      760,
    );
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.54)");
    layerCtx.fillStyle = vignette;
    layerCtx.fillRect(0, 0, WIDTH, HEIGHT);
  } else {
    const floor = layerCtx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    floor.addColorStop(0, "#111819");
    floor.addColorStop(0.45, "#151611");
    floor.addColorStop(1, "#080d0e");
    layerCtx.fillStyle = floor;
    layerCtx.fillRect(0, 0, WIDTH, HEIGHT);

    layerCtx.strokeStyle = "rgba(87, 110, 108, 0.16)";
    layerCtx.lineWidth = 1;
    for (let y = 22; y < HEIGHT; y += 58) {
      drawLine(0, y, WIDTH, y + 20);
    }
    for (let x = -80; x < WIDTH; x += 92) {
      drawLine(x, 0, x + 250, HEIGHT);
    }

    layerCtx.fillStyle = "rgba(93, 79, 55, 0.16)";
    for (let index = 0; index < 16; index += 1) {
      const x = (index * 173) % WIDTH;
      const y = 78 + ((index * 97) % 590);
      drawRoundedRect(x, y, 34 + (index % 3) * 12, 3, 2, true);
    }

    const table = layerCtx.createLinearGradient(0, 52, 0, 698);
    table.addColorStop(0, "rgba(39, 31, 22, 0.34)");
    table.addColorStop(1, "rgba(20, 17, 13, 0.48)");
    layerCtx.fillStyle = table;
    drawRoundedRect(18, 52, WIDTH - 36, 646, 10, true);

    layerCtx.strokeStyle = "rgba(143, 111, 70, 0.18)";
    layerCtx.lineWidth = 2;
    for (let x = 28; x < WIDTH - 28; x += 88) {
      drawLine(x, 58, x + 132, 692);
    }
  }

  backgroundLayerCache = layer;
  return layer;
}

function getActorSpriteSurface(
  path: string,
  image: HTMLImageElement,
  w: number,
  h: number,
): HTMLCanvasElement | null {
  const key = `${path}|${w}|${h}`;
  const cached = actorSpriteSurfaceCache.get(key);
  if (cached) {
    return cached;
  }
  const padding = Math.max(10, Math.ceil(Math.max(w, h) * 0.12));
  const surface = document.createElement("canvas");
  surface.width = w + padding * 2;
  surface.height = h + padding * 2;
  const surfaceCtx = surface.getContext("2d");
  if (!surfaceCtx) {
    return null;
  }
  surfaceCtx.filter = ACTOR_FILTER;
  surfaceCtx.drawImage(image, padding, padding, w, h);
  actorSpriteSurfaceCache.set(key, surface);
  return surface;
}

function getActorStripFrameSurface(
  strip: SpriteStripDef,
  image: HTMLImageElement,
  frameIndex: number,
  w: number,
  h: number,
): HTMLCanvasElement | null {
  const key = `${strip.path}|${frameIndex}|${w}|${h}`;
  const cached = actorStripFrameSurfaceCache.get(key);
  if (cached) {
    return cached;
  }
  const padding = Math.max(10, Math.ceil(Math.max(w, h) * 0.12));
  const surface = document.createElement("canvas");
  surface.width = w + padding * 2;
  surface.height = h + padding * 2;
  const surfaceCtx = surface.getContext("2d");
  if (!surfaceCtx) {
    return null;
  }
  surfaceCtx.filter = ACTOR_FILTER;
  surfaceCtx.drawImage(
    image,
    frameIndex * strip.frameWidth,
    0,
    strip.frameWidth,
    strip.frameHeight,
    padding,
    padding,
    w,
    h,
  );
  actorStripFrameSurfaceCache.set(key, surface);
  return surface;
}

function invalidateDerivedSpriteCaches(path: string): void {
  if (path === backgroundSprite) {
    backgroundLayerCache = null;
  }
  stripBoundsCache.delete(path);
  actorSpriteBoundsCache.delete(path);
  for (const key of actorSpriteSurfaceCache.keys()) {
    if (key.startsWith(`${path}|`)) {
      actorSpriteSurfaceCache.delete(key);
    }
  }
  for (const key of actorStripFrameSurfaceCache.keys()) {
    if (key.startsWith(`${path}|`)) {
      actorStripFrameSurfaceCache.delete(key);
    }
  }
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

function fittedText(
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  color: string,
  align: CanvasTextAlign = "left",
  family = "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  outlineColor?: string,
): void {
  ctx.font = `${size}px ${family}`;
  if (ctx.measureText(value).width <= maxWidth) {
    text(value, x, y, size, color, align, family, outlineColor);
    return;
  }

  const suffix = "...";
  const chars = Array.from(value);
  let low = 0;
  let high = chars.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidate = `${chars.slice(0, mid).join("")}${suffix}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  text(`${chars.slice(0, low).join("")}${suffix}`, x, y, size, color, align, family, outlineColor);
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
  fittedText(label, x + w / 2, y + 7, w - 36, 13, "#d7c394", "center");
}

function drawPanelBackground(path: string, x: number, y: number, w: number, h: number): boolean {
  return drawNinePatch(path, x, y, w, h, 112, 34);
}

function drawCellEmptyState(x: number, y: number): void {
  ctx.save();
  ctx.globalAlpha = 0.16;
  drawSprite(uiSprites.inventorySlot, x + 2, y + 2, CELL - 8, CELL - 8, 0);
  ctx.restore();
}

function drawPlayerStatusPanel(x: number, y: number, w: number, h: number): void {
  const stats = snapshot.player.stats;
  const now = performance.now();
  drawPanelBackground(uiSprites.panelHeroStatus, x, y, w, h);
  const inset = 58;

  text(
    "英雄状态",
    x + inset,
    y + 50,
    18,
    "#e5f4c8",
    "left",
    '"Songti SC", Georgia, serif',
    "rgba(4, 12, 8, 0.9)",
  );
  text(
    `${Math.ceil(snapshot.player.hp)}/${Math.ceil(stats.maxHp)}`,
    x + w - inset,
    y + 52,
    14,
    "#d7f2b6",
    "right",
    undefined,
    "rgba(4, 12, 8, 0.9)",
  );
  drawHealthBar(
    x + inset - 16,
    y + 62,
    w - inset * 2 + 32,
    42,
    snapshot.player.hp / stats.maxHp,
    "player",
    now,
  );
  drawDivider(x + inset, y + 112, w - inset * 2);

  const rows = [
    ["攻击", fmt(stats.attack), "攻速", fmt(stats.attackSpeed)],
    ["护甲", fmt(stats.armor), "回复", fmt(stats.regen)],
    ["燃烧", fmt(stats.burn), "毒", fmt(stats.poison)],
    ["反伤", fmt(stats.thorns), "暴击", `${Math.round(stats.critChance * 100)}%`],
  ] as const;

  let cursorY = y + 124;
  for (const [leftLabel, leftValue, rightLabel, rightValue] of rows) {
    drawCompactStat(x + inset, cursorY, 90, leftLabel, leftValue);
    drawCompactStat(x + inset + 124, cursorY, 90, rightLabel, rightValue);
    cursorY += 21;
  }
}

function drawCompactStat(x: number, y: number, w: number, label: string, value: string): void {
  text(label, x, y + 2, 12, "#a9c09f", "left", undefined, "rgba(4, 12, 8, 0.9)");
  text(value, x + w, y + 2, 13, "#f1e6bd", "right", undefined, "rgba(4, 12, 8, 0.9)");
}

function drawStatChip(x: number, y: number, w: number, label: string, value: string): void {
  text(label, x, y + 4, 13, "#aeb8ad", "left", undefined, "rgba(12, 7, 4, 0.86)");
  text(value, x + w, y + 4, 13, "#ffe0a0", "right", undefined, "rgba(12, 7, 4, 0.86)");
}

function drawDivider(x: number, y: number, w: number): void {
  ctx.strokeStyle = "rgba(244, 211, 138, 0.26)";
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
    row.active ? "#8ff0b0" : "#9aa49c",
    "left",
    undefined,
    "rgba(12, 7, 4, 0.86)",
  );
  text(row.description, x + 80, y + 4, 13, "#ead7b1", "left", undefined, "rgba(12, 7, 4, 0.86)");
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
