import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ResumeSnapshotTeam } from '../../types/league';
import { ResumeComparisonView } from './ResumeComparisonView';

const team: ResumeSnapshotTeam = {
  teamId: 1,
  name: 'Test State',
  ranking: 1,
  conference: 'Test Conference',
  record: '12-0 (8-0)',
  resumeScoreRank: 2,
  performanceIndexRank: 4,
  top25Record: '3-0',
  bestWin: { opponentId: 2, opponent: 'Iowa', opponentRanking: 11 },
  worstLoss: { opponentId: 3, opponent: 'Auburn', opponentRanking: 20 },
  seed: 1,
  isAutobid: true,
  hasBye: true,
  isChampion: true,
};

describe('resume comparison rank presentation', () => {
  it('shows Resume Score and Performance Index as ranks across desktop and mobile', () => {
    const markup = renderToStaticMarkup(
      <ResumeComparisonView
        teams={[team]}
        totalTeamCount={138}
        showAllTeams={false}
        format={12}
        isProjection
        onTeamClick={() => {}}
        onToggleShowAll={() => {}}
      />,
    );

    expect(markup.match(/Resume Score/g)).toHaveLength(2);
    expect(markup.match(/Performance Index/g)).toHaveLength(2);
    expect(markup).toContain('#2');
    expect(markup).toContain('#4');
    expect(markup).not.toContain('Weekly Score');
    expect(markup).not.toContain('WOE');
    expect(markup).not.toContain('SOS');
    expect(markup.match(/aria-sort="ascending"/g)).toHaveLength(2);
    expect(markup).toContain('Iowa logo');
    expect(markup).toContain('Auburn logo');
    expect(markup).toContain('Projected No. 1 seed');
    expect(markup).toContain('Bye · Autobid · Projected champ');
    expect(markup.match(/Show All 138/g)).toHaveLength(2);
  });

  it('limits the mobile table to team identity and the three comparison ranks', () => {
    const markup = renderToStaticMarkup(
      <ResumeComparisonView
        teams={[team]}
        totalTeamCount={138}
        showAllTeams={false}
        format={12}
        isProjection
        onTeamClick={() => {}}
        onToggleShowAll={() => {}}
      />,
    );
    const mobileTable = markup.match(
      /<table[^>]*aria-label="Mobile resume comparison"[\s\S]*?<\/table>/,
    )?.[0];

    expect(mobileTable).toBeDefined();
    expect(mobileTable).toContain('Sort by Poll Score rank');
    expect(mobileTable).toContain('Sort by Performance Index rank');
    expect(mobileTable).toContain('Sort by Resume Score rank');
    expect(mobileTable).toContain('Test State');
    expect(mobileTable).not.toContain('12-0');
    expect(mobileTable).not.toContain('Top 25');
    expect(mobileTable).not.toContain('Iowa');
    expect(mobileTable).not.toContain('Auburn');
    expect(mobileTable).not.toContain('Postseason');
    expect(mobileTable).toContain('Show All 138');
  });
});
