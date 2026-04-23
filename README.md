# Backpack Autobattler Prototype

一个数据驱动的背包构筑自动战斗原型。

## Local Run

```bash
node server.mjs
```

Open `http://127.0.0.1:5173`.

## Test And Sim

```bash
node --test packages/core/src/engine.test.ts
node apps/sim/src/main.ts smoke-seed
```

## Static Build

```bash
node tools/build-web.mjs
```

The deployable static site is written to `dist/`.

## Feedback

Use GitHub Issues for playtest feedback. Good reports include:

- browser/device
- seed or build share code
- what happened
- what you expected
- screenshot or short clip if useful
