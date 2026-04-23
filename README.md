# Backpack Autobattler Prototype

一个数据驱动的背包构筑自动战斗原型。

## Local Run

```bash
vp install
vp dev
```

Open `http://127.0.0.1:5173`.

## Test And Sim

```bash
node --test packages/core/src/engine.test.ts
node apps/sim/src/main.ts smoke-seed
```

## Static Build

```bash
vp build
```

The deployable static site is written to `dist/`.

## Asset Generation

Use the `imagegen` skill for generated bitmap assets. Item rarity should be
visible in the generated item artwork itself, not only in UI border colors. See
`docs/asset-generation.md` for the sprite-sheet layout and prompt template.

## Feedback

Use GitHub Issues for playtest feedback. Good reports include:

- browser/device
- seed or build share code
- what happened
- what you expected
- screenshot or short clip if useful

Every issue should receive a response. Accepted issues are implemented through a normal GitHub pull request linked with `Closes #issue`; rejected or deferred issues should still receive a short rationale.
