import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeBuild, createGame, dispatchCommand, querySnapshot, tickGame } from "./index.ts";

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
  });
});
