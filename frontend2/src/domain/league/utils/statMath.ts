export const average = (total: number, attempts: number, decimals = 1) => {
  if (!attempts) return 0;
  const factor = 10 ** decimals;
  return Math.round((total / attempts) * factor) / factor;
};

export const percentage = (completions: number, attempts: number) => {
  if (!attempts) return 0;
  return Math.round((completions / attempts) * 1000) / 10;
};
