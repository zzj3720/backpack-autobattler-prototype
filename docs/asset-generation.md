# Asset Generation Guide

Use the `imagegen` skill for bitmap assets. Keep generated source sheets in
`public/assets/sprites/generated-sheet.png`, then run `node tools/cut-sprites.mjs`
to slice the sheet into game-ready sprites.

## Item Icon Direction

Generate item icons as a dark fantasy sprite sheet with consistent camera angle,
lighting direction, object scale, and transparent-safe cell composition. Do not
use text labels.

Rarity must be visible in the item artwork itself, not only in the in-game
border color. The border can confirm rarity, but the object should already read
as low-tier or high-tier before any UI frame is drawn.

- `common`: worn, practical, simple silhouette, rough iron/wood/glass/stone,
  matte surfaces, few ornaments, little or no magical spill.
- `uncommon`: better-crafted silhouette, mixed materials, small runes, minor
  filigree, subtle glow, one restrained particle or smoke accent.
- `rare`: relic-like construction, sharper or stranger silhouette, exotic
  material such as cursed bone, blood-stained parchment, cracked crystal, or
  ritual metal, clear inner light or aura, denser particles.
- `epic`: impossible or legendary material, dramatic silhouette, floating
  fragments, internal light source, high contrast, strong elemental or cosmic
  effect, unmistakable presence even without a frame.

Avoid making rarity depend on colored frames, corner badges, labels, or UI
decorations. If the sheet has cell separators, keep them neutral and easy to
slice.

## Current Sheet Layout

The cutting script expects a `4 x 6` sheet. Each cell is exported as `128 x 128`.

| Row | Column 1                        | Column 2                         | Column 3                         | Column 4                       |
| --- | ------------------------------- | -------------------------------- | -------------------------------- | ------------------------------ |
| 1   | `items/rusty_blade.png` common  | `items/wooden_shield.png` common | `items/poison_vial.png` common   | `items/spark_stone.png` common |
| 2   | `items/lucky_coin.png` common   | `items/iron_dagger.png` uncommon | `items/gear_spring.png` uncommon | `items/oil_lamp.png` uncommon  |
| 3   | `items/thorn_bark.png` uncommon | `items/jade_leaf.png` uncommon   | `items/war_drum.png` rare        | `items/mirror_shard.png` rare  |
| 4   | `items/blood_contract.png` rare | `items/bone_ring.png` rare       | `items/phoenix_ember.png` epic   | `items/black_star.png` epic    |
| 5   | `actors/hero.png`               | `actors/slime.png`               | `actors/rat.png`                 | `actors/imp.png`               |
| 6   | `actors/brute.png`              | `actors/boss.png`                | `ui/empty_slot.png`              | `ui/reward_chest.png`          |

## Prompt Template

```text
Create a 4 by 6 dark fantasy game sprite sheet, each cell a centered 128x128
game icon candidate, consistent camera angle and lighting, high readability at
small size, no text, no labels.

Rows 1-4 are backpack item icons in this exact order:
rusty blade common, wooden shield common, poison vial common, spark stone common;
lucky coin common, iron dagger uncommon, gear spring uncommon, oil lamp uncommon;
thorn bark uncommon, jade leaf uncommon, war drum rare, mirror shard rare;
blood contract rare, bone ring rare, phoenix ember epic, black star epic.

Rarity must be communicated by the object itself:
common items are worn and practical with simple silhouettes and muted materials;
uncommon items are better crafted with mixed materials, small runes, subtle glow,
and limited effects; rare items are relic-like with exotic materials, sharper
silhouettes, inner light, aura, and denser particles; epic items are legendary
artifacts with impossible materials, floating fragments, strong internal light,
and dramatic elemental or cosmic effects.

Rows 5-6 are actor and UI sprites in this exact order:
hooded hero, slime, rat, fire imp; armored brute, boss demon, empty backpack slot,
reward chest.

Keep cell separators neutral for cutting. Do not use colored rarity frames,
badges, letters, numbers, or UI labels as the main rarity cue.
```
