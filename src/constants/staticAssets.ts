export const STATIC_DATA_VERSION = 19;

export const getVersionedStaticAssetUrl = (path: string) =>
  `${path}?v=${STATIC_DATA_VERSION}`;
