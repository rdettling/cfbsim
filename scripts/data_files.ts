/// <reference types="node" />
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

export const DATA_ROOT = join(SCRIPT_DIR, '..', 'public', 'data');

export const readJson = async <T>(path: string): Promise<T> =>
  JSON.parse(await readFile(path, 'utf8')) as T;

export const prettyJson = (value: unknown) =>
  `${JSON.stringify(value, null, 2)}\n`;

export const compactJson = (value: unknown) => `${JSON.stringify(value)}\n`;
