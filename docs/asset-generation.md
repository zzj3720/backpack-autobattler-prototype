# Asset Generation Guide

Use the `imagegen` skill for bitmap assets. Keep generated source sheets in
`public/assets/sprites/generated-sheet.png`, then run `node tools/cut-sprites.mjs`
to slice the sheet into game-ready sprites.

## Combat Effect Sheets

Do not generate combat effect strips as freeform long images. Generate them as
strict grid sheets on a flat chroma background, then slice them with
`node tools/cut-effect-sheet.mjs`.

Preferred layout:

- one effect per sheet
- `8 x 1` equal cells by default
- one animation frame per cell
- effect centered in each cell with a safe margin
- same-size cells and stable anchoring across frames
- flat solid background chosen to avoid the effect hue itself
- use background-colored gutters to make the grid obvious without adding new colors

Cutout policy:

- any keyed sprite must use edge feathering
- do not use hard binary cut edges as the default
- keep tolerance and feather explicit when exporting
- actor animation sheets must preserve the source grid exactly with `--no-crop`
- do not use `--trim-edge` on actor sheets unless the source has generous head,
  weapon, and footing margins in every frame

Suggested background colors:

- magenta `#ff00ff` for most fire, gold, steel, and neutral effects
- green `#00ff00` for red/orange or dark effects
- cyan `#00ffff` if the effect itself is strongly magenta or green

Example export:

```bash
node tools/cut-effect-sheet.mjs \
  --source public/assets/effects/fusion-glow-sheet.png \
  --output public/assets/effects/fusion-glow-strip-8x256.png \
  --columns 8 --rows 1 --output-cell-size 256 \
  --key ff00ff --tolerance 60 --feather 24 --crop-padding 6 --trim-edge 24
```

Actor export:

```bash
node tools/cut-effect-sheet.mjs \
  --source public/assets/actors/source/hero-attack-sheet-6x4-green-v1.png \
  --output public/assets/actors/hero-attack-strip-24x256.png \
  --columns 6 --rows 4 --output-cell-size 256 \
  --key 00ff00 --tolerance 92 --feather 40 --trim-edge 0 --no-crop
```

Enemy actor sheets use the same export pipeline. Generate every enemy as a
right-facing source sheet, then mirror it in the runtime when enemies stand on
the right side of the arena. This keeps the prompt simple and avoids the model
mixing left/right attack direction between frames.

Preferred enemy layout:

- `4 x 4` equal cells
- row 1: idle, starting from a natural standing/resting pose
- row 2: attack, frame 1 must still read as a natural transition out of idle
- row 3: hit reaction, frame 1 should begin from the normal silhouette before
  recoiling away from the incoming attack
- row 4: death, no generic explosion; use a monster-specific collapse, dissolve,
  crumble, melt, or fall
- object stays centered with stable foot/ground contact across all rows
- square cells, generous head/weapon margin, flat chroma-key background, and
  featherable edges

Split the cut `16` frame strip into row strips before interpolation:

```bash
node tools/split-strip-rows.mjs \
  --input public/assets/actors/actions/base/slime-actions-strip-16x256.png \
  --output-dir public/assets/actors/actions/base \
  --prefix slime \
  --names idle,attack,hit,death \
  --columns 4 --rows 4 --frame-width 256 --frame-height 256
```

Current enemy action strips are interpolated to `13` frames per action. Runtime
draw code stabilizes enemy animation horizontally from each frame's lower-body
alpha anchor and vertically from the visible bottom edge, so source sheets should
still keep foot/ground contact consistent and avoid large body jumps inside the
cell.

Enemy attack presentation is serialized in the web client: battle simulation
pauses while a hero or enemy attack animation is active. Melee enemies can lunge
to the hero and return; ranged enemies use projectile sprites. Current ranged
projectile source:

- source sheet: `public/assets/effects/source/projectiles-3x1-blue-v1.png`
- cut output: `public/assets/effects/projectiles-strip-3x256.png`
- cells: slime toxic glob, imp firebolt, boss molten ore shard
- key: pure blue `#0000ff`

Frame interpolation:

```bash
node tools/interpolate-strip-rife.mjs \
  --input public/assets/actors/hero-attack-strip-24x256.png \
  --output public/assets/actors/hero-attack-strip-47x256.png \
  --frames 24 --frame-width 256 --frame-height 256 \
  --rife .tools/rife/rife-ncnn-vulkan-20221029-macos/rife-ncnn-vulkan \
  --model .tools/rife/rife-ncnn-vulkan-20221029-macos/rife-v4.6
```

RIFE is run on RGB frames and alpha masks separately, then recombined into a
transparent PNG strip. This avoids losing alpha in the interpolation step.

Example prompt shape:

```text
Create an 8 by 1 combat VFX sprite sheet for a game. Each cell is an equal
square frame with the effect centered and aligned consistently from frame to
frame. Use a flat pure magenta background for chroma key extraction, with the
same magenta used as the gutter between cells so the grid is obvious. No text,
no labels, no decorative background, no extra props. Keep a clean safe margin
around the effect in every cell.
```

## Text Sprite Atlases

Fixed game text should be rendered as transparent PNG atlases, not freehand
model text. This keeps Chinese glyphs exact while still giving labels, buttons,
enemy names, wave names, equipment tags, rarity names, stat labels, and combat
numbers a theme-matched bitmap style.

Regenerate the current atlases after content text changes:

```bash
node tools/generate-text-sprites.mjs
```

Outputs:

- `public/assets/text/fixed-labels.png`
- `public/assets/text/damage-digits.png`
- `apps/web/src/generated/text-sprites.ts`
- `public/assets/text/source/text-sprites-source.json`

Damage numbers use a digit atlas by damage type instead of one image per final
number. This supports new values without regenerating every possible amount:
normal attack, critical, poison, burn, thorns, and enemy damage each get their
own `0-9`, `+`, and `-` glyph set.

For high-emphasis fixed labels, use the `imagegen` skill to generate a stricter
handcrafted source sheet, then cut it with `tools/cut-ui-sheet.mjs`. Keep the
source sheet and region map under `public/assets/text/source/`. These generated
labels are allowed to override the deterministic atlas only after visual review
confirms the Chinese text is correct enough to ship. Long or frequently changing
text should stay in the deterministic atlas.

For fixed button labels, prefer generating the complete button with the text
already integrated into the material. Avoid composing a generated button base and
a separate generated text sprite unless the button text is dynamic. Keep these
source sheets under `public/assets/ui/source/` and the cut sprites under
`public/assets/ui/labeled/`.

## Scene UI Art Pass

The game layout is organized as layered art, not one flat painted screenshot.
The current background is an environment-only arena:
`public/assets/backgrounds/dungeon-arena-clean-v1.png`. Do not bake numbers,
item names, current wave text, health fill, rewards, backpack sprites, item
slots, empty enemy sockets, buttons, plaques, or dynamic labels into the
background.

Use three layers for UI that needs to feel embedded:

- **background/base:** permanent scene and natural floor/platform context only
- **dynamic content:** health fill, item icons, active rewards, button states,
  text, numbers, debuff icons, and battle effects
- **foreground/mask:** metal lips, leather straps, rim highlights, frame caps,
  and cutout edges that cover dynamic content edges

Health bars should be authored as a base trough plus a foreground frame with an
alpha hole. The code draws dynamic fill between those two layers so the visible
fill can be clipped by the foreground frame instead of reading as a plain web
rectangle. Buttons, reward docks, and major plaques should follow the same
foreground-over-dynamic-content pattern when they need depth.

The current health-bar component source is:

- source sheet: `public/assets/ui/source/layered-health-bars-2x2-magenta-v1.png`
- cut outputs:
  - `public/assets/ui/layered/bar-player-back.png`
  - `public/assets/ui/layered/bar-player-front.png`
  - `public/assets/ui/layered/bar-enemy-back.png`
  - `public/assets/ui/layered/bar-enemy-front.png`

Prompt these sheets as reusable component parts, not as screenshots of the old
UI. Keep the back piece as an empty trough/base. Keep the front piece as a rim
with a pure chroma-key hole where the dynamic fill will appear. Avoid visible
fill, numbers, labels, baked shadows over the hole, and side decorations that
make the inner safe area ambiguous.

The current top-HUD component source is:

- source sheet: `public/assets/ui/source/top-hud-hanging-signs-v3.png`
- cut outputs:
  - `public/assets/ui/hud/stage-sign-v3.png`
  - `public/assets/ui/hud/emblem-sign-v3.png`

These signs intentionally contain no baked text. They should read as minor
background props hanging from chains near the ceiling, not as primary panels.
The stage sign reserves a dark center for a small wave number and wave-name
sprite. The emblem sign is smaller and uses a compact two-line layout for the
fixed `种子` label and dynamic share code. Avoid ornate plaques, bright trim, or
large sizes here; these two facts are low-priority context. Do not reuse
`small-seal` for top-level stage or share-code display; it is too thin for the
current background and causes unreadable compressed text.

Top-HUD lettering is model-generated rather than deterministic canvas text:

- source sheet: `public/assets/text/source/hud-sign-lettering-v1.png`
- special correction sheet: `public/assets/text/source/hud-wave12-chars-v1.png`
- cut outputs: `public/assets/text/hud/*.png`

The lettering sheet contains the fixed stage names, `第`, `关`, `种子`, digits
`0-9`, letters `A-Z`, and `-`. If the model produces a wrong Chinese glyph,
regenerate that specific word or character as another model asset; do not patch
the top HUD with a normal system font.

When cutting chroma-key text or UI details, use spill cleanup and a one-pixel
edge contract so antialiased pixels do not carry the green or magenta background
into the game:

```bash
node tools/cut-ui-sheet.mjs \
  --source public/assets/text/source/hud-sign-lettering-v1.png \
  --regions "<x,y,w,h;...>" \
  --outputs "<output1.png,output2.png,...>" \
  --key 00ff00 --tolerance 80 --feather 38 \
  --spill-cleanup --edge-contract 1
```

Generate near 16:9 and keep the scene clear enough for these runtime anchors:

- hero near logical `(218, 356)`
- up to three enemies near logical x `1040`, logical y lanes `310`, `400`, and
  `490`
- open backpack centered around logical x `640`; the background should not
  include the backpack, inventory grid, or backpack controls
- reward cards appear in the upper center during draft; do not draw baked empty
  reward slots during battle
- top-center wave seal and top-right share-code seal are separate dynamic UI
  sprites, not part of the static background

Prompt starting point:

```text
Use case: stylized-concept
Asset type: clean 2D game arena background for a dark fantasy backpack
autobattler.
Primary request: create a fresh arena-only background that does not reuse the
old UI-heavy layout.
Scene/backdrop: underground alchemist mine workshop, worn stone floor, brass
machinery and chains along the far edges, warm lantern light on the left,
subtle cool green mine glow on the right, open combat space in the center.
Composition/framing: wide gameplay background. Leave a clean lower-center area
for the backpack sprite and a clean upper-center area for reward cards. The left
and right combat lanes must be readable, with no baked health bars or plaques.
Style/medium: polished 2D game environment art, dark fantasy RPG, hand-painted,
worn brass, aged leather, blackened iron, cracked stone.
Lighting/mood: high contrast but readable, warm gold highlights balanced with
green-blue shadows.
Text: no text, no numbers, no labels, no watermark.
Constraints: no UI panels, no buttons, no health bars, no enemy slots, no reward
card slots, no backpack, no inventory grid, no parchment panels, no character
sprites, no monsters, no item icons.
Avoid: old/new mixed UI, floating rectangular web panels, empty sockets that
look like UI controls.
```

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

After cutting transparent item icons or reward cards, run edge cleanup on the
final PNGs if any chroma background color is visible at the contour:

```bash
node tools/cleanup-alpha-fringe.mjs \
  --radius 2 --threshold 14 --edge-alpha-drop 0.62 \
  public/assets/ui/reward-card-*.png public/assets/sprites/items/*.png
```

This only edits pixels near the alpha boundary. It is meant to remove green,
red, blue, cyan, or magenta matte spill without repainting the item itself.

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
