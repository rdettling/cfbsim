import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const sourceRoot = resolve(repositoryRoot, 'src');
const scriptsRoot = resolve(repositoryRoot, 'scripts');

const listTypeScriptFiles = (directory: string): string[] => readdirSync(directory)
  .flatMap(name => {
    const path = resolve(directory, name);
    if (statSync(path).isDirectory()) return listTypeScriptFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });

const importSpecifiers = (source: string) => {
  const specifiers: string[] = [];
  const staticImport = /(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\sfrom\s*)?['"]([^'"]+)['"]/g;
  const dynamicImport = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const pattern of [staticImport, dynamicImport]) {
    for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  }
  return specifiers;
};

const resolvedModulePath = (sourceFile: string, specifier: string) => {
  if (!specifier.startsWith('.')) return null;
  const base = resolve(dirname(sourceFile), specifier);
  const candidates = extname(base)
    ? [base]
    : [base, `${base}.ts`, `${base}.tsx`, resolve(base, 'index.ts'), resolve(base, 'index.tsx')];
  return candidates.find(existsSync) ?? base;
};

const isInside = (parent: string, candidate: string) => {
  const path = relative(parent, candidate);
  return path === '' || (!path.startsWith('..') && !isAbsolute(path));
};

describe('evaluation import boundary', () => {
  it('recognizes a reverse dependency into scripts', () => {
    const sourceFile = resolve(sourceRoot, 'domain/example.ts');
    const target = resolvedModulePath(sourceFile, '../../scripts/evaluation/example');
    expect(target && isInside(scriptsRoot, target)).toBe(true);
  });

  it('keeps every source import independent of scripts', () => {
    const violations = listTypeScriptFiles(sourceRoot).flatMap(sourceFile =>
      importSpecifiers(readFileSync(sourceFile, 'utf8')).flatMap(specifier => {
        const target = resolvedModulePath(sourceFile, specifier);
        return target && isInside(scriptsRoot, target)
          ? [`${relative(repositoryRoot, sourceFile)} -> ${specifier}`]
          : [];
      }),
    );
    expect(violations).toEqual([]);
  });
});
