import type { RngState } from "./types.ts";

export function hashString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createRng(seed: string): RngState {
  return { value: hashString(seed) || 0x9e3779b9 };
}

export function nextFloat(rng: RngState): number {
  let x = rng.value || 0x9e3779b9;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  rng.value = x >>> 0;
  return rng.value / 0x100000000;
}

export function nextInt(rng: RngState, min: number, maxInclusive: number): number {
  return Math.floor(nextFloat(rng) * (maxInclusive - min + 1)) + min;
}

export function pickWeighted<T>(
  rng: RngState,
  entries: Array<{ value: T; weight: number }>
): T {
  const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (total <= 0) {
    return entries[0]!.value;
  }

  let cursor = nextFloat(rng) * total;
  for (const entry of entries) {
    cursor -= Math.max(0, entry.weight);
    if (cursor <= 0) {
      return entry.value;
    }
  }

  return entries[entries.length - 1]!.value;
}
