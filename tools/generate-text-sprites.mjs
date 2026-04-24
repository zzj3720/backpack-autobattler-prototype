import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultContent } from "../packages/core/src/content.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const playwrightModule =
  process.env.PLAYWRIGHT_MODULE ??
  "/Users/zuozijian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const fixedAtlasPath = path.join(repoRoot, "public/assets/text/fixed-labels.png");
const damageAtlasPath = path.join(repoRoot, "public/assets/text/damage-digits.png");
const sourceManifestPath = path.join(
  repoRoot,
  "public/assets/text/source/text-sprites-source.json",
);
const generatedTsPath = path.join(repoRoot, "apps/web/src/generated/text-sprites.ts");

const rarityLabel = {
  common: "普通",
  uncommon: "优秀",
  rare: "稀有",
  epic: "史诗",
};

const statLabel = {
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

const tagLabel = {
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

const uiText = {
  "ui.title": "背包构筑自动战斗",
  "ui.bagClosed": "行囊已收起",
  "ui.rewardChoose": "选择一件战利品",
  "ui.battleStarted": "战鼓已响",
  "ui.mineDepth": "矿坑深处",
  "ui.records": "战绩",
  "ui.postBattleFusion": "战后合成",
  "ui.heroStatus": "英雄状态",
  "ui.currentContribution": "当前贡献",
  "ui.synergyStatus": "连携状态",
  "ui.noSynergy": "无连携效果",
  "ui.active": "已触发",
  "ui.inactive": "未触发",
  "ui.damage": "伤害",
  "ui.kills": "击杀",
  "ui.sigils": "纹章",
  "ui.noBaseStats": "无基础数值",
  "ui.victoryResult": "胜利结算",
  "ui.defeatResult": "失败结算",
  "ui.expeditionComplete": "远征完成",
  "ui.expeditionStopped": "远征中止",
  "ui.waveStart": "开战",
  "ui.waveClear": "清空",
  "ui.kill": "击破",
  "ui.fusionComplete": "合成完成",
  "ui.critical": "暴击",
  "ui.fusionMark": "合",
  "ui.phaseBattle": "队伍自动交锋",
  "ui.phasePaused": "沙漏凝住",
  "ui.phaseVictory": "胜利",
  "ui.phaseDefeat": "失败",
  "ui.phaseDraft": "择宝与整备",
  "button.startBattle": "敲响战鼓",
  "button.restart": "重启远征",
  "button.pause": "凝住沙漏",
  "button.resume": "转动沙漏",
};

const labels = [];
const lookups = {};

function addLookup(group, text, key) {
  lookups[group] ??= {};
  lookups[group][text] = key;
}

function addLabel(key, text, style, lookupGroup) {
  labels.push({ key, text, style });
  if (lookupGroup) {
    addLookup(lookupGroup, text, key);
  }
}

for (const [key, text] of Object.entries(uiText)) {
  let style = "body";
  if (key === "ui.title") {
    style = "title";
  } else if (key.startsWith("button.")) {
    style = "button";
  } else if (
    [
      "ui.waveStart",
      "ui.waveClear",
      "ui.kill",
      "ui.fusionComplete",
      "ui.victoryResult",
      "ui.defeatResult",
    ].includes(key)
  ) {
    style = "event";
  } else if (key === "ui.rewardChoose" || key === "ui.heroStatus") {
    style = "section";
  } else if (key === "ui.critical") {
    style = "critical";
  }
  addLabel(key, text, style, "ui");
}

for (const item of defaultContent.items) {
  addLabel(`item.${item.id}.name`, item.name, "itemName", "item");
}

for (const enemy of defaultContent.enemies) {
  addLabel(`enemy.${enemy.id}.name`, enemy.name, "enemyName", "enemy");
}

for (const wave of defaultContent.waves) {
  addLabel(`wave.${wave.id}.name`, wave.name, "waveName", "wave");
}

for (const [rarity, text] of Object.entries(rarityLabel)) {
  addLabel(`rarity.${rarity}`, text, `rarity-${rarity}`, "rarity");
}

for (const [stat, text] of Object.entries(statLabel)) {
  addLabel(`stat.${stat}`, text, "stat", "stat");
}

for (const [tag, text] of Object.entries(tagLabel)) {
  addLabel(`tag.${tag}`, text, "tag", "tag");
}

const damageKinds = {
  attack: {
    top: "#fff3b0",
    bottom: "#e49b3a",
    stroke: "#46210b",
    outer: "rgba(11, 5, 2, 0.92)",
    glow: "rgba(255, 208, 97, 0.38)",
    size: 44,
    advance: 31,
  },
  critical: {
    top: "#ffffff",
    bottom: "#ff3c2d",
    stroke: "#5a0803",
    outer: "rgba(12, 3, 1, 0.95)",
    glow: "rgba(255, 210, 64, 0.62)",
    size: 52,
    advance: 37,
  },
  poison: {
    top: "#d9ff9b",
    bottom: "#4fe56d",
    stroke: "#113a13",
    outer: "rgba(2, 15, 5, 0.95)",
    glow: "rgba(105, 255, 130, 0.36)",
    size: 43,
    advance: 30,
  },
  burn: {
    top: "#fff0a6",
    bottom: "#ff6c1f",
    stroke: "#5e1705",
    outer: "rgba(19, 5, 1, 0.94)",
    glow: "rgba(255, 119, 38, 0.48)",
    size: 44,
    advance: 31,
  },
  thorns: {
    top: "#e0fff2",
    bottom: "#78d6c2",
    stroke: "#143f39",
    outer: "rgba(3, 15, 14, 0.93)",
    glow: "rgba(122, 231, 208, 0.34)",
    size: 42,
    advance: 30,
  },
  enemy: {
    top: "#ffd1c0",
    bottom: "#ff574b",
    stroke: "#4c100a",
    outer: "rgba(18, 3, 2, 0.94)",
    glow: "rgba(255, 92, 72, 0.34)",
    size: 42,
    advance: 30,
  },
};

const damageChars = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "-"];

const { chromium } = await import(playwrightModule);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2400, height: 2400 } });

const atlasResult = await page.evaluate(
  async ({ labels }) => {
    await document.fonts.ready;

    const family =
      '"Songti SC", "STSong", "PingFang SC", "Hiragino Sans GB", "Noto Serif CJK SC", serif';
    const styles = {
      title: {
        size: 34,
        weight: 800,
        top: "#fff1b8",
        bottom: "#d79635",
        stroke: "#43220b",
        outer: "rgba(8, 4, 1, 0.96)",
        glow: "rgba(255, 201, 73, 0.38)",
        padX: 20,
        padY: 12,
      },
      section: {
        size: 23,
        weight: 800,
        top: "#fff0ba",
        bottom: "#d99942",
        stroke: "#3b210c",
        outer: "rgba(8, 4, 1, 0.94)",
        glow: "rgba(255, 208, 91, 0.24)",
        padX: 16,
        padY: 9,
      },
      event: {
        size: 27,
        weight: 900,
        top: "#ffffdc",
        bottom: "#f0b855",
        stroke: "#4b250a",
        outer: "rgba(10, 4, 1, 0.96)",
        glow: "rgba(255, 222, 108, 0.42)",
        padX: 18,
        padY: 10,
      },
      critical: {
        size: 22,
        weight: 900,
        top: "#ffffff",
        bottom: "#ff5133",
        stroke: "#5d0b03",
        outer: "rgba(12, 2, 1, 0.96)",
        glow: "rgba(255, 208, 70, 0.54)",
        padX: 15,
        padY: 8,
      },
      button: {
        size: 18,
        weight: 800,
        top: "#fff2bd",
        bottom: "#d19a45",
        stroke: "#3f230f",
        outer: "rgba(8, 4, 2, 0.94)",
        glow: "rgba(255, 218, 117, 0.2)",
        padX: 14,
        padY: 8,
      },
      itemName: {
        size: 20,
        weight: 800,
        top: "#fff0c0",
        bottom: "#d9b071",
        stroke: "#251509",
        outer: "rgba(6, 4, 2, 0.94)",
        glow: "rgba(255, 224, 154, 0.2)",
        padX: 12,
        padY: 7,
      },
      enemyName: {
        size: 16,
        weight: 800,
        top: "#ffe1bd",
        bottom: "#d16c42",
        stroke: "#35110a",
        outer: "rgba(8, 2, 1, 0.94)",
        glow: "rgba(255, 96, 52, 0.24)",
        padX: 11,
        padY: 6,
      },
      waveName: {
        size: 16,
        weight: 800,
        top: "#e7f1d0",
        bottom: "#99b98a",
        stroke: "#172517",
        outer: "rgba(3, 8, 4, 0.94)",
        glow: "rgba(168, 255, 182, 0.16)",
        padX: 10,
        padY: 6,
      },
      tag: {
        size: 14,
        weight: 800,
        top: "#d8e3cc",
        bottom: "#91a992",
        stroke: "#111b13",
        outer: "rgba(3, 7, 4, 0.92)",
        glow: "rgba(182, 255, 190, 0.1)",
        padX: 8,
        padY: 5,
      },
      stat: {
        size: 14,
        weight: 800,
        top: "#d9eec4",
        bottom: "#9fbc91",
        stroke: "#0f1d10",
        outer: "rgba(2, 7, 3, 0.92)",
        glow: "rgba(172, 255, 171, 0.1)",
        padX: 8,
        padY: 5,
      },
      body: {
        size: 15,
        weight: 800,
        top: "#f0d9a7",
        bottom: "#bf9562",
        stroke: "#2b1809",
        outer: "rgba(6, 3, 1, 0.93)",
        glow: "rgba(255, 211, 138, 0.14)",
        padX: 9,
        padY: 5,
      },
      "rarity-common": {
        size: 13,
        weight: 800,
        top: "#d9decd",
        bottom: "#9ea991",
        stroke: "#151a13",
        outer: "rgba(4, 5, 3, 0.92)",
        glow: "rgba(224, 230, 211, 0.12)",
        padX: 8,
        padY: 5,
      },
      "rarity-uncommon": {
        size: 13,
        weight: 800,
        top: "#d8ffc4",
        bottom: "#70d268",
        stroke: "#17350f",
        outer: "rgba(2, 9, 3, 0.94)",
        glow: "rgba(116, 255, 110, 0.2)",
        padX: 8,
        padY: 5,
      },
      "rarity-rare": {
        size: 13,
        weight: 800,
        top: "#c9f4ff",
        bottom: "#70b9ff",
        stroke: "#0c2743",
        outer: "rgba(1, 5, 10, 0.94)",
        glow: "rgba(107, 197, 255, 0.22)",
        padX: 8,
        padY: 5,
      },
      "rarity-epic": {
        size: 13,
        weight: 900,
        top: "#fff0c5",
        bottom: "#d78aff",
        stroke: "#35114a",
        outer: "rgba(7, 1, 10, 0.95)",
        glow: "rgba(214, 118, 255, 0.28)",
        padX: 9,
        padY: 5,
      },
    };
    const mutedStyleOverrides = {
      title: {
        top: "#d9c28f",
        bottom: "#947341",
        stroke: "#1b1208",
        outer: "rgba(0, 0, 0, 0.62)",
        glow: "rgba(194, 139, 59, 0.1)",
      },
      section: {
        top: "#dac69a",
        bottom: "#a17943",
        stroke: "#1a1108",
        outer: "rgba(0, 0, 0, 0.58)",
        glow: "rgba(187, 132, 56, 0.08)",
      },
      event: {
        top: "#e8d4a3",
        bottom: "#a97439",
        stroke: "#1b0f06",
        outer: "rgba(0, 0, 0, 0.64)",
        glow: "rgba(177, 106, 40, 0.12)",
      },
      critical: {
        top: "#f0d0a2",
        bottom: "#c14c35",
        stroke: "#2d0c05",
        outer: "rgba(0, 0, 0, 0.66)",
        glow: "rgba(203, 76, 45, 0.16)",
      },
      button: {
        top: "#d8c59c",
        bottom: "#9d7846",
        stroke: "#1b1208",
        outer: "rgba(0, 0, 0, 0.58)",
        glow: "rgba(188, 135, 66, 0.06)",
      },
      itemName: {
        top: "#e1cfaa",
        bottom: "#b49263",
        stroke: "#17100a",
        outer: "rgba(0, 0, 0, 0.56)",
        glow: "rgba(205, 169, 107, 0.06)",
      },
      enemyName: {
        top: "#d5a78a",
        bottom: "#9b5135",
        stroke: "#180908",
        outer: "rgba(0, 0, 0, 0.6)",
        glow: "rgba(157, 67, 43, 0.08)",
      },
      waveName: {
        top: "#c1d0ae",
        bottom: "#7e9972",
        stroke: "#0b130a",
        outer: "rgba(0, 0, 0, 0.56)",
        glow: "rgba(121, 157, 108, 0.06)",
      },
      tag: {
        top: "#c3cdbd",
        bottom: "#82917f",
        stroke: "#0b100b",
        outer: "rgba(0, 0, 0, 0.5)",
        glow: "rgba(150, 172, 145, 0.04)",
      },
      stat: {
        top: "#c7d4b5",
        bottom: "#849a76",
        stroke: "#0b1209",
        outer: "rgba(0, 0, 0, 0.5)",
        glow: "rgba(151, 178, 132, 0.04)",
      },
      body: {
        top: "#d2bd91",
        bottom: "#9c7648",
        stroke: "#160e07",
        outer: "rgba(0, 0, 0, 0.52)",
        glow: "rgba(166, 119, 63, 0.04)",
      },
    };
    for (const [styleName, overrides] of Object.entries(mutedStyleOverrides)) {
      Object.assign(styles[styleName], overrides);
    }

    function font(style) {
      return `${style.weight} ${style.size}px ${family}`;
    }

    function lineHeight(style) {
      return Math.ceil(style.size * 1.18);
    }

    const measureCanvas = document.createElement("canvas");
    const measureCtx = measureCanvas.getContext("2d");
    const measured = labels.map((entry) => {
      const style = styles[entry.style] ?? styles.body;
      measureCtx.font = font(style);
      const metrics = measureCtx.measureText(entry.text);
      return {
        ...entry,
        styleName: entry.style,
        style,
        w: Math.ceil(metrics.width + style.padX * 2),
        h: Math.ceil(lineHeight(style) + style.padY * 2),
      };
    });

    const atlasW = 2048;
    let cursorX = 0;
    let cursorY = 0;
    let shelfH = 0;
    const gap = 4;
    for (const item of measured) {
      if (cursorX + item.w > atlasW) {
        cursorX = 0;
        cursorY += shelfH + gap;
        shelfH = 0;
      }
      item.x = cursorX;
      item.y = cursorY;
      cursorX += item.w + gap;
      shelfH = Math.max(shelfH, item.h);
    }
    const atlasH = Math.max(64, Math.ceil((cursorY + shelfH + gap) / 4) * 4);

    const canvas = document.createElement("canvas");
    canvas.width = atlasW;
    canvas.height = atlasH;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.lineJoin = "round";

    for (const item of measured) {
      const style = item.style;
      const tx = item.x + style.padX;
      const ty = item.y + style.padY;
      ctx.font = font(style);
      ctx.save();
      ctx.shadowColor = style.glow;
      ctx.shadowBlur = Math.ceil(style.size * 0.18);
      ctx.lineWidth = Math.max(2, Math.round(style.size * 0.16));
      ctx.strokeStyle = style.outer;
      ctx.strokeText(item.text, tx, ty);
      ctx.shadowBlur = 0;
      ctx.lineWidth = Math.max(1, Math.round(style.size * 0.08));
      ctx.strokeStyle = style.stroke;
      ctx.strokeText(item.text, tx, ty);
      const gradient = ctx.createLinearGradient(0, ty, 0, ty + style.size * 1.08);
      gradient.addColorStop(0, style.top);
      gradient.addColorStop(1, style.bottom);
      ctx.fillStyle = gradient;
      ctx.fillText(item.text, tx, ty);
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.fillText(item.text, tx, ty - Math.max(1, Math.round(style.size * 0.06)));
      ctx.restore();
    }

    const sprites = {};
    for (const item of measured) {
      sprites[item.key] = {
        atlas: "fixed",
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        style: item.styleName,
        text: item.text,
      };
    }

    return { image: canvas.toDataURL("image/png"), sprites, width: atlasW, height: atlasH };
  },
  { labels },
);

const damageResult = await page.evaluate(
  async ({ damageKinds, damageChars }) => {
    await document.fonts.ready;
    const family = '"Georgia", "Times New Roman", "Songti SC", serif';
    const cellW = 64;
    const cellH = 82;
    const kindNames = Object.keys(damageKinds);
    const canvas = document.createElement("canvas");
    canvas.width = cellW * damageChars.length;
    canvas.height = cellH * kindNames.length;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";

    const glyphs = {};
    for (let row = 0; row < kindNames.length; row += 1) {
      const kind = kindNames[row];
      const style = damageKinds[kind];
      glyphs[kind] = {};
      for (let column = 0; column < damageChars.length; column += 1) {
        const char = damageChars[column];
        const x = column * cellW;
        const y = row * cellH;
        const cx = x + cellW / 2;
        const cy = y + cellH / 2 + 1;
        ctx.font = `900 ${style.size}px ${family}`;
        ctx.save();
        ctx.shadowColor = style.glow;
        ctx.shadowBlur = 7;
        ctx.lineWidth = Math.max(3, Math.round(style.size * 0.12));
        ctx.strokeStyle = style.outer;
        ctx.strokeText(char, cx, cy);
        ctx.shadowBlur = 0;
        ctx.lineWidth = Math.max(1, Math.round(style.size * 0.06));
        ctx.strokeStyle = style.stroke;
        ctx.strokeText(char, cx, cy);
        const gradient = ctx.createLinearGradient(0, y + 8, 0, y + cellH - 8);
        gradient.addColorStop(0, style.top);
        gradient.addColorStop(1, style.bottom);
        ctx.fillStyle = gradient;
        ctx.fillText(char, cx, cy);
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.fillText(char, cx, cy - Math.max(1, Math.round(style.size * 0.08)));
        ctx.restore();
        glyphs[kind][char] = {
          atlas: "damage",
          x,
          y,
          w: cellW,
          h: cellH,
          advance: style.advance,
        };
      }
    }
    return {
      image: canvas.toDataURL("image/png"),
      glyphs,
      width: canvas.width,
      height: canvas.height,
      cellW,
      cellH,
    };
  },
  { damageKinds, damageChars },
);

await browser.close();

await mkdir(path.dirname(fixedAtlasPath), { recursive: true });
await mkdir(path.dirname(sourceManifestPath), { recursive: true });
await mkdir(path.dirname(generatedTsPath), { recursive: true });

await writeFile(fixedAtlasPath, dataUrlToBuffer(atlasResult.image));
await writeFile(damageAtlasPath, dataUrlToBuffer(damageResult.image));
await writeFile(
  sourceManifestPath,
  `${JSON.stringify(
    {
      labels,
      lookups,
      fixedAtlas: { width: atlasResult.width, height: atlasResult.height },
      damageAtlas: {
        width: damageResult.width,
        height: damageResult.height,
        chars: damageChars,
        kinds: damageKinds,
      },
    },
    null,
    2,
  )}\n`,
);

const generated = `// Generated by tools/generate-text-sprites.mjs. Do not edit by hand.

export const textSpriteAtlas = ${JSON.stringify(
  {
    images: {
      fixed: "/assets/text/fixed-labels.png",
      damage: "/assets/text/damage-digits.png",
    },
    sprites: atlasResult.sprites,
    lookups,
    damage: {
      glyphs: damageResult.glyphs,
      chars: damageChars,
      kinds: Object.keys(damageKinds),
    },
  },
  null,
  2,
)} as const;

export type TextSpriteKey = keyof typeof textSpriteAtlas.sprites;
export type TextSpriteGroup = keyof typeof textSpriteAtlas.lookups;
export type DamageSpriteKind = keyof typeof textSpriteAtlas.damage.glyphs;
`;

await writeFile(generatedTsPath, generated);

console.log(
  JSON.stringify({
    fixedAtlas: path.relative(repoRoot, fixedAtlasPath),
    damageAtlas: path.relative(repoRoot, damageAtlasPath),
    manifest: path.relative(repoRoot, generatedTsPath),
    labels: labels.length,
  }),
);

function dataUrlToBuffer(dataUrl) {
  return Buffer.from(dataUrl.split(",", 2)[1], "base64");
}
