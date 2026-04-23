import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeBuild,
  createGame,
  defaultContent,
  dispatchCommand,
  querySnapshot,
  tickGame,
} from "./index.ts";

function runScript(seed: string) {
  let state = createGame(seed);
  state = dispatchCommand(state, { type: "chooseReward", itemId: state.rewards[0]! });
  state = dispatchCommand(state, { type: "startBattle" });
  for (let index = 0; index < 1200 && state.phase === "battle"; index += 1) {
    tickGame(state, 50);
  }
  return querySnapshot(state);
}

describe("backpack core", () => {
  it("runs deterministically from seed and commands", () => {
    const first = runScript("same-seed");
    const second = runScript("same-seed");

    assert.equal(second.phase, first.phase);
    assert.ok(Math.abs(second.player.hp - first.player.hp) < 0.000001);
    assert.ok(Math.abs(second.totals.damageDone - first.totals.damageDone) < 0.000001);
    assert.deepEqual(second.totals.damageByItem, first.totals.damageByItem);
    assert.equal(second.shareCode, first.shareCode);
  });

  it("applies adjacency bonuses through data effects", () => {
    const state = createGame("adjacency");
    const before = computeBuild(state);
    const sword = querySnapshot(state).items.find((item) => item.def.id === "rusty_blade")!;

    dispatchCommand(state, { type: "moveItem", instanceId: sword.instance.id, x: 4, y: 3 });
    const after = computeBuild(state);

    assert.ok(before.stats.attack > after.stats.attack);
    assert.ok(before.stats.poison >= 3);
  });

  it("can finish the first wave in headless mode", () => {
    const state = createGame("wave-smoke");
    dispatchCommand(state, { type: "debugAddItem", itemId: "iron_dagger" });
    dispatchCommand(state, { type: "debugAddItem", itemId: "spark_stone" });
    dispatchCommand(state, { type: "startBattle" });

    for (let index = 0; index < 900 && state.phase === "battle"; index += 1) {
      tickGame(state, 50);
    }

    assert.equal(state.phase, "draft");
    assert.equal(state.waveIndex, 1);
    assert.ok(state.totals.kills > 0);

    const events = querySnapshot(state).combatEvents;
    assert.ok(events.some((event) => event.type === "waveStart"));
    assert.ok(events.some((event) => event.type === "damage"));
    assert.ok(events.some((event) => event.type === "kill"));
    assert.ok(events.some((event) => event.type === "waveClear"));
  });

  it("previews adjacent fusions and resolves them after a battle", () => {
    const fusionContent = {
      ...defaultContent,
      waves: [
        { id: "empty_1", name: "空矿道", enemies: [], rewardBias: 0 },
        { id: "empty_2", name: "回营", enemies: [], rewardBias: 0 },
      ],
    };
    const state = createGame("fusion-smoke", fusionContent);
    dispatchCommand(state, { type: "debugAddItem", itemId: "rusty_blade" }, fusionContent);
    let snapshot = querySnapshot(state, fusionContent);
    const addedBlade = snapshot.items.find(
      (item) => item.def.id === "rusty_blade" && item.instance.x === 0 && item.instance.y === 0,
    )!;

    assert.equal(snapshot.items.filter((item) => item.def.id === "rusty_blade").length, 2);
    assert.equal(snapshot.items.filter((item) => item.def.id === "iron_dagger").length, 0);
    assert.equal(snapshot.fusionPreviews.length, 0);

    dispatchCommand(
      state,
      { type: "moveItem", instanceId: addedBlade.instance.id, x: 1, y: 0 },
      fusionContent,
    );
    snapshot = querySnapshot(state, fusionContent);

    assert.equal(snapshot.fusionPreviews.length, 1);
    assert.equal(snapshot.fusionPreviews[0]!.result.id, "iron_dagger");
    assert.equal(snapshot.fusionPreviews[0]!.queued, false);

    dispatchCommand(state, { type: "startBattle" }, fusionContent);
    snapshot = querySnapshot(state, fusionContent);

    assert.equal(snapshot.phase, "battle");
    assert.equal(snapshot.items.filter((item) => item.def.id === "rusty_blade").length, 2);
    assert.equal(snapshot.fusionPreviews[0]!.queued, true);

    tickGame(state, 50, fusionContent);
    snapshot = querySnapshot(state, fusionContent);

    assert.equal(snapshot.phase, "draft");
    assert.equal(snapshot.items.filter((item) => item.def.id === "rusty_blade").length, 0);
    assert.equal(snapshot.items.filter((item) => item.def.id === "iron_dagger").length, 1);
    assert.ok(snapshot.log.some((line) => line.includes("战后合成")));
  });

  it("defines a three-act campaign with boss checkpoints every five waves", () => {
    assert.equal(defaultContent.waves.length, 15);
    assert.deepEqual(
      defaultContent.waves
        .map((wave, index) => ({ wave, index }))
        .filter(({ wave }) => wave.enemies.some((entry) => entry.enemyId.includes("boss")))
        .map(({ index }) => index + 1),
      [5, 10, 15],
    );

    for (let index = 1; index < defaultContent.waves.length; index += 1) {
      assert.ok(
        defaultContent.waves[index]!.rewardBias >= defaultContent.waves[index - 1]!.rewardBias,
      );
    }

    const firstBoss = defaultContent.enemies.find((enemy) => enemy.id === "boss")!;
    const finalBoss = defaultContent.enemies.find((enemy) => enemy.id === "boss_core")!;
    assert.ok(finalBoss.maxHp > firstBoss.maxHp);
    assert.ok(finalBoss.attack > firstBoss.attack);
  });

  it("caps every wave at three enemies for stable battle staging", () => {
    for (const wave of defaultContent.waves) {
      const totalEnemies = wave.enemies.reduce((sum, entry) => sum + entry.count, 0);
      assert.ok(totalEnemies <= 3, `${wave.id} should not exceed three enemies`);
    }
  });

  it("spreads three-enemy waves across fixed lanes", () => {
    const state = createGame("lane-layout");
    dispatchCommand(state, { type: "startBattle" });

    const lanes = state.enemies.map((enemy) => enemy.lane).sort((left, right) => left - right);
    assert.deepEqual(lanes, [0, 1, 2]);
  });
});
