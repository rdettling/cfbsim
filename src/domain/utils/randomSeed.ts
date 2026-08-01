export const generateRandomSeed = () => {
  if (!globalThis.crypto) {
    return Math.floor(Math.random() * 0x1_0000_0000);
  }
  const values = new Uint32Array(1);
  globalThis.crypto.getRandomValues(values);
  return values[0];
};
