export const GRID_WIDTH = 5;
export const GRID_HEIGHT = 4;
export const GRID_CELLS = GRID_WIDTH * GRID_HEIGHT;

export type Phase = "draft" | "battle" | "victory" | "defeat";
export type Rarity = "common" | "uncommon" | "rare" | "epic";

export interface RngState {
  value: number;
}

export interface Stats {
  maxHp: number;
  attack: number;
  attackSpeed: number;
  armor: number;
  regen: number;
  burn: number;
  poison: number;
  thorns: number;
  critChance: number;
}

export type StatKey = keyof Stats;

export interface StatBlock extends Partial<Stats> {}

export type EffectDef =
  | {
      type: "adjacentTag";
      tag: string;
      stat: StatKey;
      amount: number;
      label: string;
    }
  | {
      type: "corner";
      stat: StatKey;
      amount: number;
      label: string;
    }
  | {
      type: "sameRowTag";
      tag: string;
      stat: StatKey;
      amount: number;
      label: string;
    }
  | {
      type: "emptyNeighbor";
      stat: StatKey;
      amount: number;
      label: string;
    }
  | {
      type: "lowHp";
      stat: StatKey;
      amount: number;
      threshold: number;
      label: string;
    };

export interface ItemDef {
  id: string;
  name: string;
  symbol: string;
  rarity: Rarity;
  tags: string[];
  stats: StatBlock;
  effects: EffectDef[];
  description: string;
}

export interface EnemyDef {
  id: string;
  name: string;
  symbol: string;
  maxHp: number;
  attack: number;
  attackSpeed: number;
  armor: number;
}

export interface WaveEnemyDef {
  enemyId: string;
  count: number;
}

export interface WaveDef {
  id: string;
  name: string;
  enemies: WaveEnemyDef[];
  rewardBias: number;
}

export interface GameContent {
  items: ItemDef[];
  enemies: EnemyDef[];
  waves: WaveDef[];
}

export interface ItemInstance {
  id: string;
  defId: string;
  x: number;
  y: number;
}

export interface EnemyInstance {
  id: string;
  defId: string;
  hp: number;
  attackTimerMs: number;
  lane: number;
}

export interface DamageTotals {
  damageDone: number;
  damageTaken: number;
  kills: number;
  damageByItem: Record<string, number>;
}

export interface CombatClock {
  playerAttackTimerMs: number;
  dotTimerMs: number;
}

export interface PlayerState {
  hp: number;
  maxHp: number;
}

export interface GameState {
  seed: string;
  rng: RngState;
  phase: Phase;
  tick: number;
  timeMs: number;
  waveIndex: number;
  waveTimeMs: number;
  grid: Array<string | null>;
  items: Record<string, ItemInstance>;
  rewards: string[];
  nextItemId: number;
  nextEnemyId: number;
  player: PlayerState;
  enemies: EnemyInstance[];
  combat: CombatClock;
  totals: DamageTotals;
  log: string[];
  endReason: string | null;
}

export type GameCommand =
  | { type: "chooseReward"; itemId: string }
  | { type: "moveItem"; instanceId: string; x: number; y: number }
  | { type: "startBattle" }
  | { type: "restart"; seed?: string }
  | { type: "debugAddItem"; itemId: string }
  | { type: "debugHeal" };

export interface ItemBuildBreakdown {
  instanceId: string;
  def: ItemDef;
  x: number;
  y: number;
  stats: Stats;
  labels: string[];
}

export interface BuildSnapshot {
  stats: Stats;
  items: ItemBuildBreakdown[];
}

export interface ItemSnapshot {
  instance: ItemInstance;
  def: ItemDef;
  stats: Stats;
  labels: string[];
}

export interface EnemySnapshot {
  instance: EnemyInstance;
  def: EnemyDef;
}

export interface GameSnapshot {
  seed: string;
  phase: Phase;
  tick: number;
  timeMs: number;
  waveIndex: number;
  waveName: string;
  waveTimeMs: number;
  gridWidth: number;
  gridHeight: number;
  player: PlayerState & { stats: Stats };
  items: ItemSnapshot[];
  rewards: ItemDef[];
  enemies: EnemySnapshot[];
  totals: DamageTotals;
  log: string[];
  shareCode: string;
  endReason: string | null;
}
