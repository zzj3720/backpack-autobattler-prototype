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
  "critChance",
];

export function validateContent(content: GameContent): GameContent {
  const parsed = content;
  if (
    !Array.isArray(parsed.items) ||
    !Array.isArray(parsed.fusions) ||
    !Array.isArray(parsed.enemies) ||
    !Array.isArray(parsed.waves)
  ) {
    throw new Error("Content must contain item, fusion, enemy, and wave arrays.");
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
    if (enemy.spriteId !== undefined) {
      assertNonEmptyString(enemy.spriteId, `enemy ${enemy.id}.spriteId`);
    }
    if (enemy.maxHp <= 0 || enemy.attack < 0 || enemy.attackSpeed <= 0 || enemy.armor < 0) {
      throw new Error(`Enemy ${enemy.id} has invalid combat numbers.`);
    }
  }

  const itemIds = new Set(parsed.items.map((item) => item.id));
  const enemyIds = new Set(parsed.enemies.map((enemy) => enemy.id));
  const fusionIds = new Set(parsed.fusions.map((fusion) => fusion.id));

  if (itemIds.size !== parsed.items.length) {
    throw new Error("Duplicate item id in content.");
  }
  if (enemyIds.size !== parsed.enemies.length) {
    throw new Error("Duplicate enemy id in content.");
  }
  if (fusionIds.size !== parsed.fusions.length) {
    throw new Error("Duplicate fusion id in content.");
  }

  for (const fusion of parsed.fusions) {
    assertNonEmptyString(fusion.id, "fusion.id");
    if (!Array.isArray(fusion.ingredients) || fusion.ingredients.length < 2) {
      throw new Error(`Fusion ${fusion.id} must have at least two ingredients.`);
    }
    if (!itemIds.has(fusion.resultItemId)) {
      throw new Error(`Fusion ${fusion.id} references missing result ${fusion.resultItemId}.`);
    }
    if (fusion.ingredients.includes(fusion.resultItemId)) {
      throw new Error(`Fusion ${fusion.id} cannot produce one of its ingredients.`);
    }
    for (const itemId of fusion.ingredients) {
      if (!itemIds.has(itemId)) {
        throw new Error(`Fusion ${fusion.id} references missing ingredient ${itemId}.`);
      }
    }
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
          label: "贴毒瓶 +2 攻击",
        },
      ],
      description: "稳定的起手武器，靠近毒系物品会更凶。",
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
          label: "角落 +2 护甲",
        },
      ],
      description: "放在角落时会卡得更稳。",
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
          label: "贴武器 +1 毒",
        },
      ],
      description: "每次毒素结算会持续削血。",
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
          label: "贴金属 +1 燃烧",
        },
      ],
      description: "给全场怪物挂燃烧。",
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
          label: "空邻格 +2% 暴击",
        },
      ],
      description: "越孤独越幸运。",
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
          label: "贴毒系 +3 攻击",
        },
      ],
      description: "需要毒瓶配合的高速武器。",
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
          label: "贴武器 +0.1 攻速",
        },
      ],
      description: "把慢武器推到离谱频率。",
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
          label: "同行火系 +1 燃烧",
        },
      ],
      description: "火系成排时会越烧越旺。",
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
          label: "贴盾 +2 反伤",
        },
      ],
      description: "挨打也能输出。",
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
          label: "空邻格 +0.15 回复",
        },
      ],
      description: "小而干净的续航件。",
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
          label: "同行武器 +0.12 攻速",
        },
      ],
      description: "武器排成一列时爆发明显。",
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
          label: "角落 +7% 暴击",
        },
      ],
      description: "角落位的暴击核心。",
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
          label: "低血 +10 攻击",
        },
      ],
      description: "强，但会把局面推向危险边缘。",
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
          label: "同行诅咒 +3 攻击",
        },
      ],
      description: "诅咒越扎堆，收益越高。",
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
          label: "贴火系 +2 燃烧",
        },
      ],
      description: "火系流派的终点。",
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
          label: "贴诅咒 +5 攻击",
        },
      ],
      description: "脆，但结算数字很好看。",
    },
    {
      id: "venom_gland",
      name: "蛇毒腺",
      symbol: "VG",
      rarity: "uncommon",
      tags: ["poison", "nature"],
      stats: { poison: 3, attackSpeed: 0.1 },
      effects: [
        {
          type: "adjacentTag",
          tag: "weapon",
          stat: "poison",
          amount: 2,
          label: "贴武器 +2 毒",
        },
      ],
      description: "毒炼流派的中段核心，贴着武器时叠毒更快。",
    },
    {
      id: "serpent_censer",
      name: "蛇烟炉",
      symbol: "SC",
      rarity: "rare",
      tags: ["poison", "alchemy"],
      stats: { poison: 5, regen: 0.25 },
      effects: [
        {
          type: "sameRowTag",
          tag: "poison",
          stat: "poison",
          amount: 2,
          label: "同行毒系 +2 毒",
        },
      ],
      description: "让毒系物品排成一线，慢慢把怪物拖垮。",
    },
    {
      id: "plague_idol",
      name: "疫病神像",
      symbol: "PI",
      rarity: "epic",
      tags: ["poison", "curse", "trinket"],
      stats: { poison: 8, maxHp: -8 },
      effects: [
        {
          type: "adjacentTag",
          tag: "poison",
          stat: "poison",
          amount: 3,
          label: "贴毒系 +3 毒",
        },
      ],
      description: "毒炼顶级件，牺牲生命换极高持续伤害。",
    },
    {
      id: "ember_saber",
      name: "余烬弯刀",
      symbol: "ES",
      rarity: "rare",
      tags: ["weapon", "fire", "metal"],
      stats: { attack: 9, burn: 3 },
      effects: [
        {
          type: "adjacentTag",
          tag: "fire",
          stat: "attack",
          amount: 4,
          label: "贴火系 +4 攻击",
        },
      ],
      description: "火铸武器，既砍人也点燃战场。",
    },
    {
      id: "forge_heart",
      name: "熔炉心",
      symbol: "FH",
      rarity: "epic",
      tags: ["fire", "metal", "machine"],
      stats: { burn: 7, armor: 2 },
      effects: [
        {
          type: "sameRowTag",
          tag: "metal",
          stat: "burn",
          amount: 2,
          label: "同行金属 +2 燃烧",
        },
      ],
      description: "火铸终点，把整排金属都烧成战斗引擎。",
    },
    {
      id: "clockwork_halberd",
      name: "钟械戟",
      symbol: "CH",
      rarity: "rare",
      tags: ["weapon", "metal", "machine"],
      stats: { attack: 10, attackSpeed: 0.35 },
      effects: [
        {
          type: "adjacentTag",
          tag: "machine",
          stat: "attack",
          amount: 4,
          label: "贴机械 +4 攻击",
        },
      ],
      description: "机械武器流的主手，吃攻速也吃机械联动。",
    },
    {
      id: "siege_chime",
      name: "攻城鸣钟",
      symbol: "SZ",
      rarity: "epic",
      tags: ["machine", "sound", "trinket"],
      stats: { attackSpeed: 0.55, attack: 4 },
      effects: [
        {
          type: "sameRowTag",
          tag: "weapon",
          stat: "attackSpeed",
          amount: 0.18,
          label: "同行武器 +0.18 攻速",
        },
      ],
      description: "机械武器终点，越多武器排队越响。",
    },
    {
      id: "guardian_root",
      name: "守卫根",
      symbol: "GR",
      rarity: "rare",
      tags: ["shield", "wood", "nature"],
      stats: { maxHp: 28, armor: 3, thorns: 3 },
      effects: [
        {
          type: "adjacentTag",
          tag: "nature",
          stat: "armor",
          amount: 2,
          label: "贴自然 +2 护甲",
        },
      ],
      description: "棘盾自然流的厚墙，越扎根越难死。",
    },
    {
      id: "elder_moss",
      name: "古苔",
      symbol: "EM",
      rarity: "epic",
      tags: ["nature", "trinket"],
      stats: { maxHp: 22, regen: 2 },
      effects: [
        {
          type: "emptyNeighbor",
          stat: "regen",
          amount: 0.25,
          label: "空邻格 +0.25 回复",
        },
      ],
      description: "自然流顶级续航，喜欢留出呼吸空间。",
    },
    {
      id: "moon_eye",
      name: "月眼",
      symbol: "ME",
      rarity: "uncommon",
      tags: ["trinket", "glass"],
      stats: { critChance: 0.06, regen: 0.2 },
      effects: [
        {
          type: "corner",
          stat: "critChance",
          amount: 0.04,
          label: "角落 +4% 暴击",
        },
      ],
      description: "星象暴击流的低阶视野件。",
    },
    {
      id: "astral_core",
      name: "星核",
      symbol: "AC",
      rarity: "epic",
      tags: ["trinket", "glass"],
      stats: { attackSpeed: 0.4, critChance: 0.1 },
      effects: [
        {
          type: "corner",
          stat: "attackSpeed",
          amount: 0.2,
          label: "角落 +0.2 攻速",
        },
      ],
      description: "星象流顶级件，只在角落真正醒来。",
    },
    {
      id: "lich_crown",
      name: "巫妖冠",
      symbol: "LC",
      rarity: "epic",
      tags: ["curse", "trinket"],
      stats: { attack: 18, maxHp: -18, critChance: 0.08 },
      effects: [
        {
          type: "sameRowTag",
          tag: "curse",
          stat: "attack",
          amount: 5,
          label: "同行诅咒 +5 攻击",
        },
      ],
      description: "诅咒流顶级件，没有低阶形态，拿到就要承担代价。",
    },
  ],
  fusions: [
    {
      id: "blade_to_dagger",
      ingredients: ["rusty_blade", "rusty_blade"],
      resultItemId: "iron_dagger",
    },
    {
      id: "poison_to_gland",
      ingredients: ["poison_vial", "poison_vial"],
      resultItemId: "venom_gland",
    },
    {
      id: "gland_to_censer",
      ingredients: ["venom_gland", "poison_vial"],
      resultItemId: "serpent_censer",
    },
    {
      id: "plague_idol",
      ingredients: ["serpent_censer", "blood_contract"],
      resultItemId: "plague_idol",
    },
    {
      id: "ember_saber",
      ingredients: ["rusty_blade", "spark_stone"],
      resultItemId: "ember_saber",
    },
    {
      id: "forge_heart",
      ingredients: ["ember_saber", "oil_lamp"],
      resultItemId: "forge_heart",
    },
    {
      id: "clockwork_halberd",
      ingredients: ["iron_dagger", "gear_spring"],
      resultItemId: "clockwork_halberd",
    },
    {
      id: "siege_chime",
      ingredients: ["clockwork_halberd", "war_drum"],
      resultItemId: "siege_chime",
    },
    {
      id: "guardian_root",
      ingredients: ["wooden_shield", "thorn_bark"],
      resultItemId: "guardian_root",
    },
    {
      id: "elder_moss",
      ingredients: ["guardian_root", "jade_leaf"],
      resultItemId: "elder_moss",
    },
    {
      id: "moon_eye",
      ingredients: ["lucky_coin", "lucky_coin"],
      resultItemId: "moon_eye",
    },
    {
      id: "astral_core",
      ingredients: ["moon_eye", "mirror_shard"],
      resultItemId: "astral_core",
    },
    {
      id: "lich_crown",
      ingredients: ["blood_contract", "bone_ring"],
      resultItemId: "lich_crown",
    },
  ],
  enemies: [
    {
      id: "slime",
      name: "泥怪",
      symbol: "SL",
      maxHp: 24,
      attack: 4,
      attackSpeed: 0.55,
      armor: 0,
    },
    {
      id: "rat",
      name: "裂齿鼠",
      symbol: "RT",
      maxHp: 18,
      attack: 3,
      attackSpeed: 0.9,
      armor: 0,
    },
    {
      id: "imp",
      name: "火噬小鬼",
      symbol: "IM",
      maxHp: 34,
      attack: 6,
      attackSpeed: 0.7,
      armor: 1,
    },
    {
      id: "brute",
      name: "铁皮蛮兵",
      symbol: "BR",
      maxHp: 58,
      attack: 9,
      attackSpeed: 0.45,
      armor: 2,
    },
    {
      id: "boss",
      name: "矿心首领",
      symbol: "BO",
      maxHp: 145,
      attack: 10,
      attackSpeed: 0.55,
      armor: 2,
    },
    {
      id: "slime_veteran",
      name: "盐蚀泥怪",
      symbol: "SV",
      spriteId: "slime",
      maxHp: 30,
      attack: 5,
      attackSpeed: 0.62,
      armor: 1,
    },
    {
      id: "rat_veteran",
      name: "黑牙裂齿鼠",
      symbol: "RV",
      spriteId: "rat",
      maxHp: 24,
      attack: 4,
      attackSpeed: 1,
      armor: 0,
    },
    {
      id: "imp_veteran",
      name: "焦焰小鬼",
      symbol: "IV",
      spriteId: "imp",
      maxHp: 42,
      attack: 7,
      attackSpeed: 0.78,
      armor: 2,
    },
    {
      id: "brute_veteran",
      name: "铆甲蛮兵",
      symbol: "BV",
      spriteId: "brute",
      maxHp: 68,
      attack: 10,
      attackSpeed: 0.5,
      armor: 4,
    },
    {
      id: "boss_forge",
      name: "熔炉督军",
      symbol: "BF",
      spriteId: "boss",
      maxHp: 220,
      attack: 14,
      attackSpeed: 0.58,
      armor: 5,
    },
    {
      id: "slime_elder",
      name: "矿毒泥怪",
      symbol: "SE",
      spriteId: "slime",
      maxHp: 42,
      attack: 7,
      attackSpeed: 0.7,
      armor: 2,
    },
    {
      id: "rat_elder",
      name: "晶齿鼠王",
      symbol: "RE",
      spriteId: "rat",
      maxHp: 34,
      attack: 6,
      attackSpeed: 1.12,
      armor: 1,
    },
    {
      id: "imp_elder",
      name: "余烬执火者",
      symbol: "IE",
      spriteId: "imp",
      maxHp: 58,
      attack: 9,
      attackSpeed: 0.86,
      armor: 3,
    },
    {
      id: "brute_elder",
      name: "黑铁蛮将",
      symbol: "BE",
      spriteId: "brute",
      maxHp: 94,
      attack: 13,
      attackSpeed: 0.56,
      armor: 6,
    },
    {
      id: "boss_core",
      name: "矿心灾厄",
      symbol: "BC",
      spriteId: "boss",
      maxHp: 320,
      attack: 18,
      attackSpeed: 0.65,
      armor: 8,
    },
  ],
  waves: [
    {
      id: "w1",
      name: "潮湿入口",
      enemies: [{ enemyId: "slime", count: 3 }],
      rewardBias: 0,
    },
    {
      id: "w2",
      name: "裂齿巷道",
      enemies: [
        { enemyId: "rat", count: 4 },
        { enemyId: "slime", count: 1 },
      ],
      rewardBias: 0.3,
    },
    {
      id: "w3",
      name: "焦油火线",
      enemies: [
        { enemyId: "imp", count: 3 },
        { enemyId: "rat", count: 2 },
      ],
      rewardBias: 0.7,
    },
    {
      id: "w4",
      name: "铁皮门厅",
      enemies: [
        { enemyId: "brute", count: 2 },
        { enemyId: "imp", count: 2 },
      ],
      rewardBias: 1,
    },
    {
      id: "w5",
      name: "矿心 Boss",
      enemies: [
        { enemyId: "boss", count: 1 },
        { enemyId: "imp", count: 1 },
      ],
      rewardBias: 1.2,
    },
    {
      id: "w6",
      name: "盐蚀矿渠",
      enemies: [
        { enemyId: "slime_veteran", count: 3 },
        { enemyId: "rat_veteran", count: 3 },
      ],
      rewardBias: 1.35,
    },
    {
      id: "w7",
      name: "黑牙伏击",
      enemies: [
        { enemyId: "imp_veteran", count: 2 },
        { enemyId: "rat_veteran", count: 3 },
        { enemyId: "slime_veteran", count: 1 },
      ],
      rewardBias: 1.5,
    },
    {
      id: "w8",
      name: "铆甲升降井",
      enemies: [
        { enemyId: "brute_veteran", count: 2 },
        { enemyId: "imp_veteran", count: 2 },
        { enemyId: "slime_veteran", count: 2 },
      ],
      rewardBias: 1.7,
    },
    {
      id: "w9",
      name: "熔炉前厅",
      enemies: [
        { enemyId: "brute_veteran", count: 3 },
        { enemyId: "imp_veteran", count: 3 },
      ],
      rewardBias: 1.9,
    },
    {
      id: "w10",
      name: "熔炉 Boss",
      enemies: [
        { enemyId: "boss_forge", count: 1 },
        { enemyId: "brute_veteran", count: 2 },
        { enemyId: "imp_veteran", count: 2 },
      ],
      rewardBias: 2.15,
    },
    {
      id: "w11",
      name: "晶齿回廊",
      enemies: [
        { enemyId: "rat_elder", count: 4 },
        { enemyId: "slime_elder", count: 2 },
      ],
      rewardBias: 2.3,
    },
    {
      id: "w12",
      name: "余烬裂缝",
      enemies: [
        { enemyId: "imp_elder", count: 3 },
        { enemyId: "rat_elder", count: 3 },
      ],
      rewardBias: 2.45,
    },
    {
      id: "w13",
      name: "黑铁压阵",
      enemies: [
        { enemyId: "brute_elder", count: 2 },
        { enemyId: "imp_elder", count: 3 },
        { enemyId: "slime_elder", count: 2 },
      ],
      rewardBias: 2.65,
    },
    {
      id: "w14",
      name: "灾厄门前",
      enemies: [
        { enemyId: "brute_elder", count: 3 },
        { enemyId: "imp_elder", count: 3 },
        { enemyId: "rat_elder", count: 2 },
      ],
      rewardBias: 2.85,
    },
    {
      id: "w15",
      name: "矿心灾厄",
      enemies: [
        { enemyId: "boss_core", count: 1 },
        { enemyId: "brute_elder", count: 2 },
        { enemyId: "imp_elder", count: 2 },
      ],
      rewardBias: 3.1,
    },
  ],
});
