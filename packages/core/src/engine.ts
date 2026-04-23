import { defaultContent } from "./content.ts";
import { createRng, hashString, nextFloat, nextInt, pickWeighted } from "./rng.ts";
import {
  GRID_CELLS,
  GRID_HEIGHT,
  GRID_WIDTH,
  type BuildSnapshot,
  type DamageTotals,
  type EffectDef,
  type EnemyDef,
  type EnemyInstance,
  type GameCommand,
  type GameContent,
  type GameSnapshot,
  type GameState,
  type ItemBuildBreakdown,
  type ItemDef,
  type ItemInstance,
  type Rarity,
  type StatKey,
  type Stats,
} from "./types.ts";

const BASE_STATS: Stats = {
  maxHp: 80,
  attack: 4,
  attackSpeed: 1,
  armor: 0,
  regen: 0,
  burn: 0,
  poison: 0,
  thorns: 0,
  critChance: 0.05,
};

const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 8,
  uncommon: 5,
  rare: 2,
  epic: 0.65,
};

const STARTER_ITEMS = [
  { itemId: "wooden_shield", x: 0, y: 1 },
  { itemId: "rusty_blade", x: 1, y: 1 },
  { itemId: "poison_vial", x: 2, y: 1 },
];

export function gridIndex(x: number, y: number): number {
  return y * GRID_WIDTH + x;
}

export function isInsideGrid(x: number, y: number): boolean {
  return x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT;
}

export function createGame(seed = "daily-seed", content = defaultContent): GameState {
  const state: GameState = {
    seed,
    rng: createRng(seed),
    phase: "draft",
    tick: 0,
    timeMs: 0,
    waveIndex: 0,
    waveTimeMs: 0,
    grid: Array.from({ length: GRID_CELLS }, () => null),
    items: {},
    rewards: [],
    nextItemId: 1,
    nextEnemyId: 1,
    player: { hp: BASE_STATS.maxHp, maxHp: BASE_STATS.maxHp },
    enemies: [],
    combat: { playerAttackTimerMs: 0, dotTimerMs: 0 },
    totals: createDamageTotals(),
    log: [],
    endReason: null,
  };

  for (const starter of STARTER_ITEMS) {
    addItemAt(state, starter.itemId, starter.x, starter.y, content);
  }
  syncPlayerStats(state, content, true);
  generateRewards(state, content);
  pushLog(state, `Seed ${seed}: 先选一个奖励，再开战。`);
  return state;
}

export function dispatchCommand(
  state: GameState,
  command: GameCommand,
  content = defaultContent,
): GameState {
  switch (command.type) {
    case "restart":
      return createGame(command.seed ?? state.seed, content);

    case "chooseReward": {
      if (state.phase !== "draft") {
        pushLog(state, "战斗中不能领奖励。");
        return state;
      }
      if (!state.rewards.includes(command.itemId)) {
        pushLog(state, "这个奖励不在当前选项里。");
        return state;
      }
      const placed = addItemFirstOpen(state, command.itemId, content);
      if (!placed) {
        pushLog(state, "背包满了，先挪出空间。");
        return state;
      }
      state.rewards = [];
      syncPlayerStats(state, content, true);
      pushLog(state, `拿到 ${getItemDef(content, command.itemId).name}。`);
      return state;
    }

    case "moveItem": {
      if (state.phase !== "draft") {
        pushLog(state, "只有选奖励阶段可以摆背包。");
        return state;
      }
      moveItem(state, command.instanceId, command.x, command.y, content);
      syncPlayerStats(state, content, false);
      return state;
    }

    case "startBattle": {
      if (state.phase !== "draft") {
        return state;
      }
      syncPlayerStats(state, content, false);
      spawnWave(state, content);
      state.phase = "battle";
      state.waveTimeMs = 0;
      state.combat.playerAttackTimerMs = 180;
      state.combat.dotTimerMs = 500;
      pushLog(state, `${currentWave(content, state).name} 开始。`);
      return state;
    }

    case "debugAddItem": {
      const placed = addItemFirstOpen(state, command.itemId, content);
      if (placed) {
        syncPlayerStats(state, content, true);
        pushLog(state, `Debug: 加入 ${getItemDef(content, command.itemId).name}。`);
      }
      return state;
    }

    case "debugHeal": {
      syncPlayerStats(state, content, false);
      state.player.hp = state.player.maxHp;
      pushLog(state, "Debug: 生命回满。");
      return state;
    }
  }
}

export function tickGame(state: GameState, deltaMs: number, content = defaultContent): GameState {
  if (state.phase !== "battle") {
    return state;
  }

  state.tick += 1;
  state.timeMs += deltaMs;
  state.waveTimeMs += deltaMs;

  const build = computeBuild(state, content);
  state.player.hp = clamp(
    state.player.hp + build.stats.regen * (deltaMs / 1000),
    0,
    build.stats.maxHp,
  );

  state.combat.playerAttackTimerMs -= deltaMs;
  while (state.combat.playerAttackTimerMs <= 0 && state.enemies.length > 0) {
    playerAttack(state, build, content);
    state.combat.playerAttackTimerMs += 1000 / build.stats.attackSpeed;
    removeDeadEnemies(state);
  }

  state.combat.dotTimerMs -= deltaMs;
  while (state.combat.dotTimerMs <= 0 && state.enemies.length > 0) {
    applyDots(state, build, content);
    state.combat.dotTimerMs += 500;
    removeDeadEnemies(state);
  }

  const activeEnemies = state.enemies.slice();
  for (const enemy of activeEnemies) {
    if (enemy.hp <= 0) {
      continue;
    }
    const enemyDef = getEnemyDef(content, enemy.defId);
    enemy.attackTimerMs -= deltaMs;
    while (enemy.attackTimerMs <= 0 && enemy.hp > 0 && state.phase === "battle") {
      enemyAttack(state, enemy, enemyDef, build, content);
      enemy.attackTimerMs += 1000 / enemyDef.attackSpeed;
      removeDeadEnemies(state);
    }
  }

  if (state.player.hp <= 0 && state.phase === "battle") {
    state.phase = "defeat";
    state.endReason = `倒在 ${currentWave(content, state).name}`;
    state.player.hp = 0;
    pushLog(state, state.endReason);
    return state;
  }

  if (state.enemies.length === 0 && state.phase === "battle") {
    completeWave(state, content);
  }

  return state;
}

export function computeBuild(state: GameState, content = defaultContent): BuildSnapshot {
  const stats = cloneStats(BASE_STATS);
  const items = Object.values(state.items).sort(sortItems);
  const breakdown = items.map((instance) => {
    const def = getItemDef(content, instance.defId);
    const itemStats = zeroStats();
    addStats(itemStats, def.stats);
    addStats(stats, def.stats);
    return {
      instanceId: instance.id,
      def,
      x: instance.x,
      y: instance.y,
      stats: itemStats,
      labels: [] as string[],
    };
  });

  for (const item of breakdown) {
    for (const effect of item.def.effects) {
      const amount = effectAmount(effect, item, state, content);
      if (amount === 0) {
        continue;
      }
      item.stats[effect.stat] += amount;
      stats[effect.stat] += amount;
      item.labels.push(formatEffectLabel(effect, amount));
    }
  }

  return {
    stats: clampStats(stats),
    items: breakdown.map((item) => ({ ...item, stats: clampStats(item.stats, true) })),
  };
}

export function querySnapshot(state: GameState, content = defaultContent): GameSnapshot {
  const build = computeBuild(state, content);
  const wave = currentWave(content, state);
  const itemStats = new Map(build.items.map((item) => [item.instanceId, item]));

  return {
    seed: state.seed,
    phase: state.phase,
    tick: state.tick,
    timeMs: state.timeMs,
    waveIndex: state.waveIndex,
    waveName: wave.name,
    waveTimeMs: state.waveTimeMs,
    gridWidth: GRID_WIDTH,
    gridHeight: GRID_HEIGHT,
    player: {
      hp: state.player.hp,
      maxHp: build.stats.maxHp,
      stats: build.stats,
    },
    items: Object.values(state.items)
      .sort(sortItems)
      .map((instance) => {
        const item = itemStats.get(instance.id);
        if (!item) {
          throw new Error(`Missing build item ${instance.id}.`);
        }
        return {
          instance,
          def: item.def,
          stats: item.stats,
          labels: item.labels,
        };
      }),
    rewards: state.rewards.map((itemId) => getItemDef(content, itemId)),
    enemies: state.enemies.map((enemy) => ({
      instance: enemy,
      def: getEnemyDef(content, enemy.defId),
    })),
    totals: cloneTotals(state.totals),
    log: state.log.slice(-8),
    shareCode: createShareCode(state),
    endReason: state.endReason,
  };
}

export function createShareCode(state: GameState): string {
  const itemPayload = Object.values(state.items)
    .sort(sortItems)
    .map((item) => `${item.defId}@${item.x},${item.y}`)
    .join("/");
  const payload = `${state.seed}|${state.waveIndex}|${state.phase}|${itemPayload}`;
  const hash = hashString(payload).toString(36).toUpperCase().padStart(6, "0").slice(0, 6);
  return `BP-${hash}`;
}

function createDamageTotals(): DamageTotals {
  return {
    damageDone: 0,
    damageTaken: 0,
    kills: 0,
    damageByItem: {},
  };
}

function cloneTotals(totals: DamageTotals): DamageTotals {
  return {
    damageDone: totals.damageDone,
    damageTaken: totals.damageTaken,
    kills: totals.kills,
    damageByItem: { ...totals.damageByItem },
  };
}

function currentWave(content: GameContent, state: GameState) {
  return content.waves[Math.min(state.waveIndex, content.waves.length - 1)]!;
}

function getItemDef(content: GameContent, itemId: string): ItemDef {
  const item = content.items.find((candidate) => candidate.id === itemId);
  if (!item) {
    throw new Error(`Unknown item ${itemId}.`);
  }
  return item;
}

function getEnemyDef(content: GameContent, enemyId: string): EnemyDef {
  const enemy = content.enemies.find((candidate) => candidate.id === enemyId);
  if (!enemy) {
    throw new Error(`Unknown enemy ${enemyId}.`);
  }
  return enemy;
}

function addItemFirstOpen(state: GameState, itemId: string, content: GameContent): boolean {
  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      if (cellAt(state, x, y) === null) {
        addItemAt(state, itemId, x, y, content);
        return true;
      }
    }
  }
  return false;
}

function addItemAt(
  state: GameState,
  itemId: string,
  x: number,
  y: number,
  content: GameContent,
): ItemInstance {
  getItemDef(content, itemId);
  if (!isInsideGrid(x, y)) {
    throw new Error(`Grid position out of bounds: ${x}, ${y}.`);
  }
  if (cellAt(state, x, y) !== null) {
    throw new Error(`Grid position occupied: ${x}, ${y}.`);
  }

  const instance: ItemInstance = {
    id: `item_${state.nextItemId}`,
    defId: itemId,
    x,
    y,
  };
  state.nextItemId += 1;
  state.items[instance.id] = instance;
  setCell(state, x, y, instance.id);
  return instance;
}

function moveItem(
  state: GameState,
  instanceId: string,
  x: number,
  y: number,
  content: GameContent,
): void {
  const instance = state.items[instanceId];
  if (!instance || !isInsideGrid(x, y)) {
    return;
  }
  getItemDef(content, instance.defId);
  const target = cellAt(state, x, y);
  if (target !== null && target !== instanceId) {
    pushLog(state, "目标格已经有装备。");
    return;
  }
  setCell(state, instance.x, instance.y, null);
  instance.x = x;
  instance.y = y;
  setCell(state, x, y, instanceId);
}

function spawnWave(state: GameState, content: GameContent): void {
  const wave = currentWave(content, state);
  state.enemies = [];
  for (const entry of wave.enemies) {
    const def = getEnemyDef(content, entry.enemyId);
    for (let index = 0; index < entry.count; index += 1) {
      state.enemies.push({
        id: `enemy_${state.nextEnemyId}`,
        defId: def.id,
        hp: def.maxHp,
        attackTimerMs: nextInt(state.rng, 250, 1100),
        lane: nextInt(state.rng, 0, 2),
      });
      state.nextEnemyId += 1;
    }
  }
}

function generateRewards(state: GameState, content: GameContent): void {
  const wave = currentWave(content, state);
  const choices = new Set<string>();
  while (choices.size < Math.min(3, content.items.length)) {
    const selected = pickWeighted(
      state.rng,
      content.items.map((item) => ({
        value: item,
        weight: rewardWeight(item.rarity, wave.rewardBias),
      })),
    );
    choices.add(selected.id);
  }
  state.rewards = [...choices];
}

function rewardWeight(rarity: Rarity, bias: number): number {
  const rarityBoost: Record<Rarity, number> = {
    common: Math.max(0.15, 1 - bias * 0.35),
    uncommon: 1 + bias * 0.2,
    rare: 1 + bias * 0.65,
    epic: 1 + bias * 1.25,
  };
  return RARITY_WEIGHT[rarity] * rarityBoost[rarity];
}

function playerAttack(state: GameState, build: BuildSnapshot, content: GameContent): void {
  const target = state.enemies[0];
  if (!target) {
    return;
  }
  const crit = nextFloat(state.rng) < build.stats.critChance ? 1.8 : 1;
  const rawDamage = build.stats.attack * crit;
  dealEnemyDamage(
    state,
    target,
    rawDamage,
    splitDamageByStat(build, "attack", rawDamage),
    content,
    false,
  );
}

function applyDots(state: GameState, build: BuildSnapshot, content: GameContent): void {
  if (build.stats.burn > 0) {
    for (const enemy of state.enemies) {
      dealEnemyDamage(
        state,
        enemy,
        build.stats.burn * 0.55,
        splitDamageByStat(build, "burn", build.stats.burn * 0.55),
        content,
        true,
      );
    }
  }

  if (build.stats.poison > 0) {
    const target = state.enemies[0];
    if (target) {
      dealEnemyDamage(
        state,
        target,
        build.stats.poison * 0.9,
        splitDamageByStat(build, "poison", build.stats.poison * 0.9),
        content,
        true,
      );
    }
  }
}

function enemyAttack(
  state: GameState,
  enemy: EnemyInstance,
  enemyDef: EnemyDef,
  build: BuildSnapshot,
  content: GameContent,
): void {
  const damage = Math.max(1, enemyDef.attack - build.stats.armor * 0.7);
  state.player.hp -= damage;
  state.totals.damageTaken += damage;

  if (build.stats.thorns > 0) {
    dealEnemyDamage(
      state,
      enemy,
      build.stats.thorns,
      splitDamageByStat(build, "thorns", build.stats.thorns),
      content,
      true,
    );
  }
}

function dealEnemyDamage(
  state: GameState,
  enemy: EnemyInstance,
  rawDamage: number,
  sources: Array<{ sourceId: string; amount: number }>,
  content: GameContent,
  ignoreArmor: boolean,
): void {
  if (enemy.hp <= 0 || rawDamage <= 0) {
    return;
  }
  const enemyDef = getEnemyDef(content, enemy.defId);
  const damage = ignoreArmor ? rawDamage : Math.max(1, rawDamage - enemyDef.armor * 0.65);
  const actual = Math.min(enemy.hp, damage);
  enemy.hp -= actual;
  state.totals.damageDone += actual;

  const sourceTotal = sources.reduce((sum, source) => sum + source.amount, 0);
  if (sourceTotal <= 0) {
    addDamageSource(state, "base", actual);
    return;
  }
  for (const source of sources) {
    addDamageSource(state, source.sourceId, actual * (source.amount / sourceTotal));
  }
}

function splitDamageByStat(
  build: BuildSnapshot,
  stat: StatKey,
  amount: number,
): Array<{ sourceId: string; amount: number }> {
  const sources = build.items
    .map((item) => ({
      sourceId: item.instanceId,
      amount: Math.max(0, item.stats[stat]),
    }))
    .filter((source) => source.amount > 0);

  if (sources.length === 0) {
    return [{ sourceId: "base", amount }];
  }
  return sources;
}

function addDamageSource(state: GameState, sourceId: string, amount: number): void {
  state.totals.damageByItem[sourceId] = (state.totals.damageByItem[sourceId] ?? 0) + amount;
}

function removeDeadEnemies(state: GameState): void {
  const before = state.enemies.length;
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
  const removed = before - state.enemies.length;
  if (removed > 0) {
    state.totals.kills += removed;
  }
}

function completeWave(state: GameState, content: GameContent): void {
  const waveName = currentWave(content, state).name;
  pushLog(state, `${waveName} 清空。`);

  if (state.waveIndex >= content.waves.length - 1) {
    state.phase = "victory";
    state.endReason = "击败矿心 Boss";
    pushLog(state, `胜利！分享码 ${createShareCode(state)}`);
    return;
  }

  state.waveIndex += 1;
  state.phase = "draft";
  state.waveTimeMs = 0;
  syncPlayerStats(state, content, false);
  state.player.hp = clamp(state.player.hp + state.player.maxHp * 0.22, 0, state.player.maxHp);
  generateRewards(state, content);
}

function syncPlayerStats(state: GameState, content: GameContent, healGainedMaxHp: boolean): void {
  const previousMaxHp = state.player.maxHp;
  const build = computeBuild(state, content);
  state.player.maxHp = build.stats.maxHp;
  if (healGainedMaxHp && build.stats.maxHp > previousMaxHp) {
    state.player.hp += build.stats.maxHp - previousMaxHp;
  }
  state.player.hp = clamp(state.player.hp, 0, state.player.maxHp);
}

function effectAmount(
  effect: EffectDef,
  item: ItemBuildBreakdown,
  state: GameState,
  content: GameContent,
): number {
  switch (effect.type) {
    case "adjacentTag": {
      return countAdjacentWithTag(state, item, effect.tag, content) * effect.amount;
    }
    case "corner": {
      const isCorner =
        (item.x === 0 || item.x === GRID_WIDTH - 1) && (item.y === 0 || item.y === GRID_HEIGHT - 1);
      return isCorner ? effect.amount : 0;
    }
    case "sameRowTag": {
      return countSameRowWithTag(state, item, effect.tag, content) * effect.amount;
    }
    case "emptyNeighbor": {
      return countEmptyNeighbors(state, item.x, item.y) * effect.amount;
    }
    case "lowHp": {
      const ratio = state.player.maxHp <= 0 ? 1 : state.player.hp / state.player.maxHp;
      return ratio <= effect.threshold ? effect.amount : 0;
    }
  }
}

function formatEffectLabel(effect: EffectDef, amount: number): string {
  const sign = amount > 0 ? "+" : "";
  return `${effect.label} (${sign}${round(amount)})`;
}

function countAdjacentWithTag(
  state: GameState,
  item: ItemBuildBreakdown,
  tag: string,
  content: GameContent,
): number {
  return neighbors(item.x, item.y).filter((position) => {
    const instanceId = cellAt(state, position.x, position.y);
    if (instanceId === null) {
      return false;
    }
    return getItemDef(content, state.items[instanceId]!.defId).tags.includes(tag);
  }).length;
}

function countSameRowWithTag(
  state: GameState,
  item: ItemBuildBreakdown,
  tag: string,
  content: GameContent,
): number {
  let count = 0;
  for (let x = 0; x < GRID_WIDTH; x += 1) {
    const instanceId = cellAt(state, x, item.y);
    if (instanceId === null || instanceId === item.instanceId) {
      continue;
    }
    if (getItemDef(content, state.items[instanceId]!.defId).tags.includes(tag)) {
      count += 1;
    }
  }
  return count;
}

function countEmptyNeighbors(state: GameState, x: number, y: number): number {
  return neighbors(x, y).filter((position) => cellAt(state, position.x, position.y) === null)
    .length;
}

function neighbors(x: number, y: number): Array<{ x: number; y: number }> {
  return [
    { x: x - 1, y },
    { x: x + 1, y },
    { x, y: y - 1 },
    { x, y: y + 1 },
  ].filter((position) => isInsideGrid(position.x, position.y));
}

function cellAt(state: GameState, x: number, y: number): string | null {
  return state.grid[gridIndex(x, y)] ?? null;
}

function setCell(state: GameState, x: number, y: number, value: string | null): void {
  state.grid[gridIndex(x, y)] = value;
}

function cloneStats(stats: Stats): Stats {
  return { ...stats };
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

function addStats(target: Stats, source: Partial<Stats>): void {
  for (const key of Object.keys(source) as StatKey[]) {
    target[key] += source[key] ?? 0;
  }
}

function clampStats(stats: Stats, allowZeroMaxHp = false): Stats {
  return {
    maxHp: allowZeroMaxHp ? stats.maxHp : Math.max(1, stats.maxHp),
    attack: allowZeroMaxHp ? stats.attack : Math.max(1, stats.attack),
    attackSpeed: clamp(stats.attackSpeed, allowZeroMaxHp ? 0 : 0.2, 6),
    armor: allowZeroMaxHp ? stats.armor : Math.max(0, stats.armor),
    regen: stats.regen,
    burn: allowZeroMaxHp ? stats.burn : Math.max(0, stats.burn),
    poison: allowZeroMaxHp ? stats.poison : Math.max(0, stats.poison),
    thorns: allowZeroMaxHp ? stats.thorns : Math.max(0, stats.thorns),
    critChance: clamp(stats.critChance, 0, 0.75),
  };
}

function sortItems(left: ItemInstance, right: ItemInstance): number {
  return left.y === right.y ? left.x - right.x : left.y - right.y;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function pushLog(state: GameState, line: string): void {
  state.log.push(line);
  if (state.log.length > 40) {
    state.log.shift();
  }
}
