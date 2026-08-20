import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const sourceRoot = resolve(repositoryRoot, 'src');
const pagesRoot = resolve(sourceRoot, 'pages');
const componentsRoot = resolve(sourceRoot, 'components');
const databaseRoot = resolve(sourceRoot, 'db');
const leagueRoot = resolve(sourceRoot, 'domain/league');
const commandsRoot = resolve(leagueRoot, 'commands');
const loadersRoot = resolve(leagueRoot, 'loaders');
const leagueUtilsRoot = resolve(leagueRoot, 'utils');

const listTypeScriptFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap(name => {
    const path = resolve(directory, name);
    if (statSync(path).isDirectory()) return listTypeScriptFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });

const importSpecifiers = (source: string) => {
  const specifiers: string[] = [];
  const staticImport =
    /(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\sfrom\s*)?['"]([^'"]+)['"]/g;
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
    : [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        resolve(base, 'index.ts'),
        resolve(base, 'index.tsx'),
      ];
  return candidates.find(existsSync) ?? base;
};

const isInside = (parent: string, candidate: string) => {
  const path = relative(parent, candidate);
  return path === '' || (!path.startsWith('..') && !isAbsolute(path));
};

const frontendViolation = (sourceFile: string, specifier: string) => {
  const target = resolvedModulePath(sourceFile, specifier);
  if (!target) return null;
  if (isInside(databaseRoot, target)) return 'direct database import';
  if (
    isInside(leagueRoot, target) &&
    ![commandsRoot, loadersRoot, leagueUtilsRoot].some(root =>
      isInside(root, target),
    )
  ) {
    return 'league import outside commands, loaders, or utils';
  }
  return null;
};

const loaderViolation = (sourceFile: string, specifier: string) => {
  const target = resolvedModulePath(sourceFile, specifier);
  return target && isInside(commandsRoot, target)
    ? 'loader import into commands'
    : null;
};

describe('league UI command boundary', () => {
  it('classifies forbidden and allowed dependency targets', () => {
    const page = resolve(pagesRoot, 'example.tsx');
    const loader = resolve(loadersRoot, 'example.ts');

    expect(frontendViolation(page, '../db/db')).toBe(
      'direct database import',
    );
    expect(frontendViolation(page, '../domain/league/seasonReset')).toBe(
      'league import outside commands, loaders, or utils',
    );
    expect(
      frontendViolation(page, '../domain/league/commands/season'),
    ).toBeNull();
    expect(
      frontendViolation(page, '../domain/league/loaders/season/loadHomeData'),
    ).toBeNull();
    expect(loaderViolation(loader, '../commands/recruiting')).toBe(
      'loader import into commands',
    );
  });

  it('keeps frontend league access on the public UI boundary', () => {
    const violations = [pagesRoot, componentsRoot]
      .flatMap(listTypeScriptFiles)
      .flatMap(sourceFile =>
        importSpecifiers(readFileSync(sourceFile, 'utf8')).flatMap(
          specifier => {
            const violation = frontendViolation(sourceFile, specifier);
            return violation
              ? [
                  `${relative(repositoryRoot, sourceFile)} -> ${specifier} (${violation})`,
                ]
              : [];
          },
        ),
      );

    expect(violations).toEqual([]);
  });

  it('keeps read-only loaders independent of commands', () => {
    const violations = listTypeScriptFiles(loadersRoot).flatMap(sourceFile =>
      importSpecifiers(readFileSync(sourceFile, 'utf8')).flatMap(specifier => {
        const violation = loaderViolation(sourceFile, specifier);
        return violation
          ? [
              `${relative(repositoryRoot, sourceFile)} -> ${specifier} (${violation})`,
            ]
          : [];
      }),
    );

    expect(violations).toEqual([]);
  });
});
