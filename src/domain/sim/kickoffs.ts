const randomInt = (min: number, max: number) => {
  const range = Math.max(0, max - min);
  return min + Math.floor(Math.random() * (range + 1));
};

export const kickoffStartFieldPosition = () => {
  const touchback = Math.random() < 0.65;
  if (touchback) return 25;
  return randomInt(15, 35);
};
