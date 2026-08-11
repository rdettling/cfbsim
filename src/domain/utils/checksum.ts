export const checksumValues = (values: unknown[]) => {
  let hash = 2166136261;
  const text = values
    .map(value => JSON.stringify(value))
    .sort()
    .join('\n');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

export const checksumPartitions = (values: unknown[]) =>
  checksumValues(values.map(value => checksumValues([value])));
