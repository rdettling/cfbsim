import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ResumeTeam } from './types';
import { ResumeComparisonView } from './ResumeComparisonView';

const team: ResumeTeam = {
  name: 'Test State',
  ranking: 1,
  conference: 'Test Conference',
  record: '12-0 (8-0)',
  poll_score: 98.5,
  sor_rank: 1,
  sos_rank: 5,
  top_25_record: '3-0',
  best_win: null,
  worst_loss: null,
  seed: 1,
  is_autobid: false,
  has_bye: false,
  is_champ: false,
};

describe('resume comparison score presentation', () => {
  it('labels the weekly model score consistently across desktop and mobile', () => {
    const markup = renderToStaticMarkup(
      <ResumeComparisonView
        teams={[team]}
        format={12}
        isProjection={false}
        onTeamClick={() => {}}
      />,
    );

    expect(markup.match(/Weekly Score/g)).toHaveLength(2);
    expect(markup).not.toContain('Poll score');
    expect(markup).not.toContain('>Poll<');
  });
});
