export const stableNumber = (...values: number[]) => {
  let hash = 2166136261;
  values.forEach(value => {
    hash ^= value;
    hash = Math.imul(hash, 16777619);
  });
  return hash >>> 0;
};
