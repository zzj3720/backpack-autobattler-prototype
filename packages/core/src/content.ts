import type { GameContent, Rarity, StatKey } from "./types.ts";

const rarityValues: Rarity[] = ["common", "uncommon", "rare", "epic"];
const statKeys: StatKey[] = [
  "maxHp",
  "attack",
  "attackSpeed",
  "armor",
  "regen",
  "burn",
  "poison",
  "thorns",
  "critChance"
];

export function validateContent(content: GameContent): GameContent {
  const parsed = content;
  if (!Array.isArray(parsed.items) || !Array.isArray(parsed.enemies) || !Array.isArray(parsed.waves)) {
    throw new Error("Content must contain item, enemy, and wave arrays.");
  }

  for (const item of parsed.items) {
    assertNonEmptyString(item.id, "item.id");
    assertNonEmptyString(item.name, `item ${item.id}.name`);
    if (!rarityValues.includes(item.rarity)) {
      throw new Error(`Item ${item.id} has invalid rarity ${item.rarity}.`);
    }
    for (const key of Object.keys(item.stats) as StatKey[]) {
      if (!statKeys.includes(key) || typeof item.stats[key] !== "number") {
        throw new Error(`Item ${item.id} has invalid stat ${key}.`);
      }
    }
    for (const effect of item.effects) {
      if (!statKeys.includes(effect.stat)) {
        throw new Error(`Item ${item.id} has invalid effect stat ${effect.stat}.`);
      }
      if (typeof effect.amount !== "number" || effect.label.length === 0) {
        throw new Error(`Item ${item.id} has invalid effect payload.`);
      }
    }
  }

  for (const enemy of parsed.enemies) {
    assertNonEmptyString(enemy.id, "enemy.id");
    if (enemy.maxHp <= 0 || enemy.attack < 0 || enemy.attackSpeed <= 0 || enemy.armor < 0) {
      throw new Error(`Enemy ${enemy.id} has invalid combat numbers.`);
    }
  }

  const itemIds = new Set(parsed.items.map((item) => item.id));
  const enemyIds = new Set(parsed.enemies.map((enemy) => enemy.id));

  if (itemIds.size !== parsed.items.length) {
    throw new Error("Duplicate item id in content.");
  }
  if (enemyIds.size !== parsed.enemies.length) {
    throw new Error("Duplicate enemy id in content.");
  }

  for (const wave of parsed.waves) {
    for (const entry of wave.enemies) {
      if (!enemyIds.has(entry.enemyId)) {
        throw new Error(`Wave ${wave.id} references missing enemy ${entry.enemyId}.`);
      }
    }
  }

  return parsed;
}

function assertNonEmptyString(value: string, label: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
}

export const defaultContent = validateContent({
  items: [
    {
      id: "rusty_blade",
      name: "粗铁短剑",
      symbol: "SW",
      rarity: "common",
      tags: ["weapon", "metal"],
      stats: { attack: 6 },
      effects: [
        {
          type: "adjacentTag",
          tag: "poison",
          stat: "attack",
          amount: 2,
          label: "贴毒瓶 +2 攻击"
        }
      ],
      description: "稳定的起手武器，靠近毒系物品会更凶。"
    },
    {
      id: "wooden_shield",
      name: "旧木盾",
      symbol: "SH",
      rarity: "common",
      tags: ["shield", "wood"],
      stats: { maxHp: 18, armor: 2 },
      effects: [
        {
          type: "corner",
          stat: "armor",
          amount: 2,
          label: "角落 +2 护甲"
        }
      ],
      description: "放在角落时会卡得更稳。"
    },
    {
      id: "poison_vial",
      name: "毒雾瓶",
      symbol: "PX",
      rarity: "common",
      tags: ["poison", "alchemy"],
      stats: { poison: 2 },
      effects: [
        {
          type: "adjacentTag",
          tag: "weapon",
          stat: "poison",
          amount: 1,
          label: "贴武器 +1 毒"
        }
      ],
      description: "每次毒素结算会持续削血。"
    },
    {
      id: "spark_stone",
      name: "火花石",
      symbol: "FR",
      rarity: "common",
      tags: ["fire", "stone"],
      stats: { burn: 2 },
      effects: [
        {
          type: "adjacentTag",
          tag: "metal",
          stat: "burn",
          amount: 1,
          label: "贴金属 +1 燃烧"
        }
      ],
      description: "给全场怪物挂燃烧。"
    },
    {
      id: "lucky_coin",
      name: "裂纹金币",
      symbol: "$",
      rarity: "common",
      tags: ["trinket"],
      stats: { critChance: 0.05 },
      effects: [
        {
          type: "emptyNeighbor",
          stat: "critChance",
          amount: 0.02,
          label: "空邻格 +2% 暴击"
        }
      ],
      description: "越孤独越幸运。"
    },
    {
      id: "iron_dagger",
      name: "铁脊匕首",
      symbol: "DG",
      rarity: "uncommon",
      tags: ["weapon", "metal"],
      stats: { attack: 4, attackSpeed: 0.25 },
      effects: [
        {
          type: "adjacentTag",
          tag: "poison",
          stat: "attack",
          amount: 3,
          label: "贴毒系 +3 攻击"
        }
      ],
      description: "需要毒瓶配合的高速武器。"
    },
    {
      id: "gear_spring",
      name: "齿轮发条",
      symbol: "GE",
      rarity: "uncommon",
      tags: ["metal", "machine"],
      stats: { attackSpeed: 0.35 },
      effects: [
        {
          type: "adjacentTag",
          tag: "weapon",
          stat: "attackSpeed",
          amount: 0.1,
          label: "贴武器 +0.1 攻速"
        }
      ],
      description: "把慢武器推到离谱频率。"
    },
    {
      id: "oil_lamp",
      name: "焦油灯",
      symbol: "OL",
      rarity: "uncommon",
      tags: ["fire", "alchemy"],
      stats: { burn: 3 },
      effects: [
        {
          type: "sameRowTag",
          tag: "fire",
          stat: "burn",
          amount: 1,
          label: "同行火系 +1 燃烧"
        }
      ],
      description: "火系成排时会越烧越旺。"
    },
    {
      id: "thorn_bark",
      name: "荆棘树皮",
      symbol: "TH",
      rarity: "uncommon",
      tags: ["wood", "shield"],
      stats: { maxHp: 12, thorns: 4 },
      effects: [
        {
          type: "adjacentTag",
          tag: "shield",
          stat: "thorns",
          amount: 2,
          label: "贴盾 +2 反伤"
        }
      ],
      description: "挨打也能输出。"
    },
    {
      id: "jade_leaf",
      name: "碧玉叶",
      symbol: "JL",
      rarity: "uncommon",
      tags: ["nature", "trinket"],
      stats: { maxHp: 8, regen: 1 },
      effects: [
        {
          type: "emptyNeighbor",
          stat: "regen",
          amount: 0.15,
          label: "空邻格 +0.15 回复"
        }
      ],
      description: "小而干净的续航件。"
    },
    {
      id: "war_drum",
      name: "裂鼓",
      symbol: "DR",
      rarity: "rare",
      tags: ["trinket", "sound"],
      stats: { attackSpeed: 0.25 },
      effects: [
        {
          type: "sameRowTag",
          tag: "weapon",
          stat: "attackSpeed",
          amount: 0.12,
          label: "同行武器 +0.12 攻速"
        }
      ],
      description: "武器排成一列时爆发明显。"
    },
    {
      id: "mirror_shard",
      name: "镜裂片",
      symbol: "MR",
      rarity: "rare",
      tags: ["trinket", "glass"],
      stats: { critChance: 0.08 },
      effects: [
        {
          type: "corner",
          stat: "critChance",
          amount: 0.07,
          label: "角落 +7% 暴击"
        }
      ],
      description: "角落位的暴击核心。"
    },
    {
      id: "blood_contract",
      name: "血契",
      symbol: "BC",
      rarity: "rare",
      tags: ["curse"],
      stats: { attack: 12, regen: -0.35 },
      effects: [
        {
          type: "lowHp",
          stat: "attack",
          amount: 10,
          threshold: 0.45,
          label: "低血 +10 攻击"
        }
      ],
      description: "强，但会把局面推向危险边缘。"
    },
    {
      id: "bone_ring",
      name: "骨戒",
      symbol: "BR",
      rarity: "rare",
      tags: ["curse", "trinket"],
      stats: { critChance: 0.07 },
      effects: [
        {
          type: "sameRowTag",
          tag: "curse",
          stat: "attack",
          amount: 3,
          label: "同行诅咒 +3 攻击"
        }
      ],
      description: "诅咒越扎堆，收益越高。"
    },
    {
      id: "phoenix_ember",
      name: "凤烬",
      symbol: "PE",
      rarity: "epic",
      tags: ["fire", "trinket"],
      stats: { burn: 5, regen: 0.5 },
      effects: [
        {
          type: "adjacentTag",
          tag: "fire",
          stat: "burn",
          amount: 2,
          label: "贴火系 +2 燃烧"
        }
      ],
      description: "火系流派的终点。"
    },
    {
      id: "black_star",
      name: "黑星",
      symbol: "BS",
      rarity: "epic",
      tags: ["curse", "trinket"],
      stats: { attack: 8, critChance: 0.12, maxHp: -10 },
      effects: [
        {
          type: "adjacentTag",
          tag: "curse",
          stat: "attack",
          amount: 5,
          label: "贴诅咒 +5 攻击"
        }
      ],
      description: "脆，但结算数字很好看。"
    }
  ],
  enemies: [
    {
      id: "slime",
      name: "泥怪",
      symbol: "SL",
      maxHp: 24,
      attack: 4,
      attackSpeed: 0.55,
      armor: 0
    },
    {
      id: "rat",
      name: "裂齿鼠",
      symbol: "RT",
      maxHp: 18,
      attack: 3,
      attackSpeed: 0.9,
      armor: 0
    },
    {
      id: "imp",
      name: "火噬小鬼",
      symbol: "IM",
      maxHp: 34,
      attack: 6,
      attackSpeed: 0.7,
      armor: 1
    },
    {
      id: "brute",
      name: "铁皮蛮兵",
      symbol: "BR",
      maxHp: 58,
      attack: 9,
      attackSpeed: 0.45,
      armor: 2
    },
    {
      id: "boss",
      name: "矿心首领",
      symbol: "BO",
      maxHp: 180,
      attack: 13,
      attackSpeed: 0.55,
      armor: 3
    }
  ],
  waves: [
    {
      id: "w1",
      name: "潮湿入口",
      enemies: [{ enemyId: "slime", count: 3 }],
      rewardBias: 0
    },
    {
      id: "w2",
      name: "裂齿巷道",
      enemies: [
        { enemyId: "rat", count: 4 },
        { enemyId: "slime", count: 1 }
      ],
      rewardBias: 0.3
    },
    {
      id: "w3",
      name: "焦油火线",
      enemies: [
        { enemyId: "imp", count: 3 },
        { enemyId: "rat", count: 2 }
      ],
      rewardBias: 0.7
    },
    {
      id: "w4",
      name: "铁皮门厅",
      enemies: [
        { enemyId: "brute", count: 2 },
        { enemyId: "imp", count: 2 }
      ],
      rewardBias: 1
    },
    {
      id: "w5",
      name: "矿心 Boss",
      enemies: [
        { enemyId: "boss", count: 1 },
        { enemyId: "imp", count: 2 }
      ],
      rewardBias: 1.2
    }
  ]
});
