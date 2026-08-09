import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runNewsAudit } from './eval_news';

const directories: string[] = [];

afterEach(() => {
  directories.splice(0).forEach(directory => rmSync(directory, { recursive: true, force: true }));
  process.exitCode = undefined;
});

describe('news audit command', () => {
  it('writes only the three documented artifacts and passes a structurally sound corpus', () => {
    const directory = mkdtempSync(join(tmpdir(), 'cfbsim-news-audit-'));
    directories.push(directory);
    const { summary } = runNewsAudit([
      '--seed', '20260809',
      '--seeds', '1',
      '--seasons', '1',
      '--replay-seeds', '0',
      '--output', directory,
    ]);
    expect(readdirSync(directory).sort()).toEqual([
      'review.md',
      'stories.jsonl',
      'summary.json',
    ]);
    expect(JSON.parse(readFileSync(join(directory, 'summary.json'), 'utf8')).checksum)
      .toBe(summary.checksum);
    expect(summary.newsItemChecksum).toMatch(/^[0-9a-f]{8}$/);
    expect(summary.newsContentChecksum).toMatch(/^[0-9a-f]{8}$/);
    expect(summary.editorialOutcomeChecksum).toMatch(/^[0-9a-f]{8}$/);
    expect(readFileSync(join(directory, 'review.md'), 'utf8'))
      .toContain(`NewsItem checksum: \`${summary.newsItemChecksum}\``);
    expect(readFileSync(join(directory, 'review.md'), 'utf8'))
      .toContain(`News content checksum: \`${summary.newsContentChecksum}\``);
    expect(readFileSync(join(directory, 'review.md'), 'utf8'))
      .toContain(`Editorial outcome checksum: \`${summary.editorialOutcomeChecksum}\``);
    expect(summary.violations).toEqual([]);
    expect(process.exitCode ?? 0).toBe(0);
  }, 15_000);
});
