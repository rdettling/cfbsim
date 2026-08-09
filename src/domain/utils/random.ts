export interface RandomSource {
  next(): number;
  int(min: number, max: number): number;
  normal(mean: number, stdDev: number): number;
  weightedChoice<T>(items: Array<{ item: T; weight: number }>): T | null;
  fork(key: string | number): RandomSource;
}

const hash = (seed: number, key: string | number) => {
  let value = (seed ^ 0x811c9dc5) >>> 0;
  const text = String(key);
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
};

const createSource = (
  next: () => number,
  fork: (key: string | number) => RandomSource,
): RandomSource => ({
  next,
  int(min, max) {
    return min + Math.floor(next() * (max - min + 1));
  },
  normal(mean, stdDev) {
    let u = 0;
    let v = 0;
    while (u === 0) u = next();
    while (v === 0) v = next();
    return (
      Math.sqrt(-2 * Math.log(u)) *
        Math.cos(2 * Math.PI * v) *
        stdDev +
      mean
    );
  },
  weightedChoice(items) {
    if (!items.length) return null;
    const total = items.reduce(
      (sum, entry) => sum + Math.max(0, entry.weight),
      0,
    );
    if (total <= 0) return items[Math.floor(next() * items.length)]?.item ?? null;
    let threshold = next() * total;
    for (const entry of items) {
      threshold -= Math.max(0, entry.weight);
      if (threshold <= 0) return entry.item;
    }
    return items[items.length - 1]?.item ?? null;
  },
  fork,
});

export const createSeededRandom = (seed: number): RandomSource => {
  const normalized = seed >>> 0;
  let state = normalized;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  return createSource(next, key => createSeededRandom(hash(normalized, key)));
};

export const mathRandomSource = (): RandomSource =>
  createSource(Math.random, () => mathRandomSource());
