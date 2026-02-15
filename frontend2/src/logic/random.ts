export const randomChoice = <T>(values: T[]): T => {
  return values[Math.floor(Math.random() * values.length)];
};

export const weightedChoice = <T>(values: T[], weights: number[]): T => {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < values.length; i += 1) {
    r -= weights[i];
    if (r <= 0) return values[i];
  }
  return values[values.length - 1];
};

export const randomNormal = (mean = 0, stdDev = 1): number => {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * stdDev;
};

export const randomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};
