import { defaultContent } from "./content.ts";
import { createRng, hashString, nextFloat, nextInt, pickWeighted } from "./rng.ts";
import {
  GRID_CELLS,
  GRID_HEIGHT,
  GRID_WIDTH,
  type BuildSnapshot,
  type CombatEvent,
  type DamageKind,
  type DamageTotals,
  type EffectDef,
  type EnemyDef,
  type EnemyInstance,
  type GameCommand,
  type GameContent,
  type GameSnapshot,
  type GameState,
  type FusionPreview,
  type ItemBuildBreakdown,
  type ItemDef,
  type ItemInstance,
  type PendingFusion,
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
const MAX_COMBAT_EVENTS = 80;

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
    pendingFusions: [],
    combat: { playerAttackTimerMs: 0, dotTimerMs: 0 },
    combatEvents: [],
    nextCombatEventId: 1,
    totals: createDamageTotals(),
    log: [],
    endReason: null,
  };

  for (const starter of STARTER_ITEMS) {
    addItemAt(state, starter.itemId, starter.x, starter.y, content);
  }
  syncPlayerStats(state, content, true);
  generateRewards(state, content);
  pushLog(state, `远征 ${seed}: 先选一个战利品。`);
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
      pushLog(state, `拿到 ${getItemDef(content, command.itemId).name}。`);
      syncPlayerStats(state, content, true);
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
      state.pendingFusions = createPendingFusions(state, content);
      spawnWave(state, content);
      state.phase = "battle";
      state.waveTimeMs = 0;
      state.combat.playerAttackTimerMs = 180;
      state.combat.dotTimerMs = 500;
      pushLog(state, `${currentWave(content, state).name} 开始。`);
      pushCombatEvent(state, {
        type: "waveStart",
        waveIndex: state.waveIndex,
        waveName: currentWave(content, state).name,
      });
      if (state.pendingFusions.length > 0) {
        pushLog(state, `战后合成预备：${formatPendingFusionSummary(state, content)}。`);
      }
      return state;
    }

    case "debugAddItem": {
      const placed = addItemFirstOpen(state, command.itemId, content);
      if (placed) {
        pushLog(state, `营地补给：加入 ${getItemDef(content, command.itemId).name}。`);
        syncPlayerStats(state, content, true);
      }
      return state;
    }

    case "debugHeal": {
      syncPlayerStats(state, content, false);
      state.player.hp = state.player.maxHp;
      pushLog(state, "营地补给：生命回满。");
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
    fusionPreviews: createFusionPreviews(state, content),
    combatEvents: state.combatEvents.slice(),
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

function addItemFirstOpen(
  state: GameState,
  itemId: string,
  content: GameContent,
): ItemInstance | null {
  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      if (cellAt(state, x, y) === null) {
        return addItemAt(state, itemId, x, y, content);
      }
    }
  }
  return null;
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

interface FusionMatch {
  recipe: GameContent["fusions"][number];
  instances: ItemInstance[];
}

function createPendingFusions(state: GameState, content: GameContent): PendingFusion[] {
  return findAdjacentFusionMatches(state, content).map((match) => ({
    recipeId: match.recipe.id,
    instanceIds: match.instances.map((instance) => instance.id),
  }));
}

function createFusionPreviews(state: GameState, content: GameContent): FusionPreview[] {
  const matches =
    state.phase === "battle"
      ? state.pendingFusions
          .map((pending) => pendingFusionToMatch(state, content, pending))
          .filter((match): match is FusionMatch => match !== null)
      : state.phase === "draft"
        ? findAdjacentFusionMatches(state, content)
        : [];

  return matches.map((match) => ({
    recipeId: match.recipe.id,
    result: getItemDef(content, match.recipe.resultItemId),
    ingredients: match.instances.map((instance) => ({
      instanceId: instance.id,
      def: getItemDef(content, instance.defId),
      x: instance.x,
      y: instance.y,
    })),
    queued: state.phase === "battle",
  }));
}

function applyPendingFusions(state: GameState, content: GameContent): void {
  const pendingFusions = state.pendingFusions.slice();
  state.pendingFusions = [];
  for (const pending of pendingFusions) {
    const match = pendingFusionToMatch(state, content, pending);
    if (!match) {
      continue;
    }
    applyFusionMatch(state, content, match);
  }
}

function applyFusionMatch(state: GameState, content: GameContent, match: FusionMatch): void {
  const anchor = match.instances[0]!;
  const x = anchor.x;
  const y = anchor.y;
  const ingredientNames = match.instances.map(
    (instance) => getItemDef(content, instance.defId).name,
  );
  for (const instance of match.instances) {
    setCell(state, instance.x, instance.y, null);
    delete state.items[instance.id];
  }

  const result = addItemAt(state, match.recipe.resultItemId, x, y, content);
  const resultName = getItemDef(content, result.defId).name;
  pushLog(state, `战后合成 ${ingredientNames.join(" + ")} -> ${resultName}。`);
  pushCombatEvent(state, {
    type: "fusionComplete",
    resultItemId: result.defId,
    resultInstanceId: result.id,
    x: result.x,
    y: result.y,
  });
}

function formatPendingFusionSummary(state: GameState, content: GameContent): string {
  const labels = state.pendingFusions
    .map((pending) => {
      const match = pendingFusionToMatch(state, content, pending);
      return match ? fusionLabel(match, content) : null;
    })
    .filter((label): label is string => label !== null);
  if (labels.length <= 2) {
    return labels.join("；");
  }
  return `${labels.slice(0, 2).join("；")} 等 ${labels.length} 组`;
}

function fusionLabel(match: FusionMatch, content: GameContent): string {
  const ingredientNames = match.instances.map(
    (instance) => getItemDef(content, instance.defId).name,
  );
  const resultName = getItemDef(content, match.recipe.resultItemId).name;
  return `${ingredientNames.join(" + ")} -> ${resultName}`;
}

function pendingFusionToMatch(
  state: GameState,
  content: GameContent,
  pending: PendingFusion,
): FusionMatch | null {
  const recipe = content.fusions.find((candidate) => candidate.id === pending.recipeId);
  if (!recipe) {
    return null;
  }
  const instances = pending.instanceIds.map((id) => state.items[id]);
  if (instances.some((instance) => instance === undefined)) {
    return null;
  }
  const match = { recipe, instances: instances as ItemInstance[] };
  if (!matchesRecipeIngredients(match) || !instancesAreConnected(match.instances)) {
    return null;
  }
  return match;
}

function findAdjacentFusionMatches(state: GameState, content: GameContent): FusionMatch[] {
  const used = new Set<string>();
  const matches: FusionMatch[] = [];
  for (const recipe of content.fusions) {
    for (const instances of findRecipeCandidates(state, recipe)) {
      if (instances.some((instance) => used.has(instance.id))) {
        continue;
      }
      matches.push({ recipe, instances });
      for (const instance of instances) {
        used.add(instance.id);
      }
    }
  }
  return matches;
}

function findRecipeCandidates(
  state: GameState,
  recipe: GameContent["fusions"][number],
): ItemInstance[][] {
  const items = Object.values(state.items).sort(sortItems);
  const candidates: ItemInstance[][] = [];
  const seen = new Set<string>();

  function choose(index: number, selected: ItemInstance[], used: Set<string>): void {
    if (index === recipe.ingredients.length) {
      if (!instancesAreConnected(selected)) {
        return;
      }
      const key = selected
        .map((instance) => instance.id)
        .sort()
        .join("|");
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      candidates.push(selected.slice());
      return;
    }

    const ingredientId = recipe.ingredients[index]!;
    for (const item of items) {
      if (item.defId !== ingredientId || used.has(item.id)) {
        continue;
      }
      used.add(item.id);
      selected.push(item);
      choose(index + 1, selected, used);
      selected.pop();
      used.delete(item.id);
    }
  }

  choose(0, [], new Set<string>());
  return candidates.sort(compareFusionCandidates);
}

function compareFusionCandidates(left: ItemInstance[], right: ItemInstance[]): number {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftItem = left[index];
    const rightItem = right[index];
    if (!leftItem || !rightItem) {
      return left.length - right.length;
    }
    const itemOrder = sortItems(leftItem, rightItem);
    if (itemOrder !== 0) {
      return itemOrder;
    }
  }
  return 0;
}

function matchesRecipeIngredients(match: FusionMatch): boolean {
  return sameCounts(
    match.recipe.ingredients,
    match.instances.map((instance) => instance.defId),
  );
}

function sameCounts(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const counts = new Map<string, number>();
  for (const value of left) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  for (const value of right) {
    const count = counts.get(value) ?? 0;
    if (count === 0) {
      return false;
    }
    if (count === 1) {
      counts.delete(value);
    } else {
      counts.set(value, count - 1);
    }
  }
  return counts.size === 0;
}

function instancesAreConnected(instances: ItemInstance[]): boolean {
  if (instances.length < 2) {
    return false;
  }
  const remaining = new Set(instances.map((instance) => instance.id));
  const stack = [instances[0]!];
  remaining.delete(instances[0]!.id);
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const instance of instances) {
      if (
        remaining.has(instance.id) &&
        Math.abs(instance.x - current.x) + Math.abs(instance.y - current.y) === 1
      ) {
        remaining.delete(instance.id);
        stack.push(instance);
      }
    }
  }
  return remaining.size === 0;
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
    "attack",
    crit > 1,
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
        "burn",
        false,
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
        "poison",
        false,
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
  const enemyTarget = enemyCombatTarget(state, enemy);
  pushCombatEvent(state, {
    type: "enemyAttack",
    enemyId: enemy.id,
    enemyDefId: enemy.defId,
    enemyLane: enemyTarget.lane,
    enemySlot: enemyTarget.slot,
    amount: damage,
  });

  if (build.stats.thorns > 0) {
    dealEnemyDamage(
      state,
      enemy,
      build.stats.thorns,
      splitDamageByStat(build, "thorns", build.stats.thorns),
      content,
      true,
      "thorns",
      false,
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
  kind: DamageKind,
  critical: boolean,
): void {
  if (enemy.hp <= 0 || rawDamage <= 0) {
    return;
  }
  const enemyDef = getEnemyDef(content, enemy.defId);
  const target = enemyCombatTarget(state, enemy);
  const damage = ignoreArmor ? rawDamage : Math.max(1, rawDamage - enemyDef.armor * 0.65);
  const actual = Math.min(enemy.hp, damage);
  enemy.hp -= actual;
  state.totals.damageDone += actual;

  const sourceTotal = sources.reduce((sum, source) => sum + source.amount, 0);
  const sourceIds: string[] = [];
  if (sourceTotal <= 0) {
    addDamageSource(state, "base", actual);
  } else {
    for (const source of sources) {
      const sourceDamage = actual * (source.amount / sourceTotal);
      addDamageSource(state, source.sourceId, sourceDamage);
      if (source.sourceId !== "base" && sourceDamage > 0.05) {
        sourceIds.push(source.sourceId);
      }
    }
  }

  pushCombatEvent(state, {
    type: "damage",
    targetId: enemy.id,
    targetDefId: enemy.defId,
    targetLane: target.lane,
    targetSlot: target.slot,
    amount: actual,
    kind,
    critical,
    sourceIds,
  });

  if (enemy.hp <= 0) {
    pushCombatEvent(state, {
      type: "kill",
      targetId: enemy.id,
      targetDefId: enemy.defId,
      targetLane: target.lane,
      targetSlot: target.slot,
    });
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

function enemyCombatTarget(state: GameState, enemy: EnemyInstance): { lane: number; slot: number } {
  let slot = 0;
  for (const candidate of state.enemies) {
    if (candidate.id === enemy.id) {
      break;
    }
    if (candidate.lane === enemy.lane) {
      slot += 1;
    }
  }
  return { lane: enemy.lane, slot };
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
  pushCombatEvent(state, {
    type: "waveClear",
    waveIndex: state.waveIndex,
    waveName,
  });
  applyPendingFusions(state, content);

  if (state.waveIndex >= content.waves.length - 1) {
    state.phase = "victory";
    state.endReason = `击败 ${waveName}`;
    pushLog(state, `胜利！纹章 ${createShareCode(state)}`);
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

function pushCombatEvent(state: GameState, event: Omit<CombatEvent, "id" | "timeMs">): void {
  state.combatEvents.push({
    ...event,
    id: state.nextCombatEventId,
    timeMs: state.timeMs,
  } as CombatEvent);
  state.nextCombatEventId += 1;
  if (state.combatEvents.length > MAX_COMBAT_EVENTS) {
    state.combatEvents.splice(0, state.combatEvents.length - MAX_COMBAT_EVENTS);
  }
}
