import {
  createGame,
  defaultContent,
  dispatchCommand,
  querySnapshot,
  tickGame,
  type GameState,
  type Rarity
} from "../../../packages/core/src/index.ts";

const rarityScore: Record<Rarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4
};

const seed = process.argv[2] ?? `sim-${new Date().toISOString().slice(0, 10)}`;
let state: GameState = createGame(seed);

for (let safety = 0; safety < 10000 && state.phase !== "victory" && state.phase !== "defeat"; safety += 1) {
  if (state.phase === "draft") {
    const snapshot = querySnapshot(state);
    const reward = [...snapshot.rewards].sort(
      (left, right) => rarityScore[right.rarity] - rarityScore[left.rarity]
    )[0];
    if (reward) {
      state = dispatchCommand(state, { type: "chooseReward", itemId: reward.id });
    }
    state = dispatchCommand(state, { type: "startBattle" });
  }

  tickGame(state, 50);
}

const result = querySnapshot(state);
const sourceNames = new Map(result.items.map((item) => [item.instance.id, item.def.name]));
const damageRows = Object.entries(result.totals.damageByItem)
  .sort((left, right) => right[1] - left[1])
  .slice(0, 8)
  .map(([sourceId, damage]) => ({
    source: sourceNames.get(sourceId) ?? sourceId,
    damage: Math.round(damage)
  }));

console.log(`Seed: ${result.seed}`);
console.log(`Result: ${result.phase} / ${result.endReason ?? "running"}`);
console.log(`Share: ${result.shareCode}`);
console.log(
  `Wave: ${result.waveIndex + 1}/${defaultContent.waves.length}, HP: ${Math.ceil(result.player.hp)}/${Math.ceil(result.player.maxHp)}`
);
console.log(
  `Kills: ${result.totals.kills}, Damage: ${Math.round(result.totals.damageDone)}, Taken: ${Math.round(result.totals.damageTaken)}`
);
console.table(damageRows);
