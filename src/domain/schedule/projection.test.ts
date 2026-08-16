import { describe, expect, it } from 'vitest';
import { buildTestTeam } from '../../test/fixtures';
import type { Team } from '../../types/domain';
import type { FullGame } from '../../types/scheduleTypes';
import { buildSchedule, projectFullGamesToUserSchedule } from './projection';

const team = (id: number, conference: string) => buildTestTeam({
  id,
  name: `Team ${id}`,
  abbreviation: `T${id}`,
  conference,
  confName: conference,
  ranking: id,
});

const game = ({
  teamA,
  teamB,
  week,
  homeTeam,
  awayTeam,
  venue = null,
  name = null,
}: {
  teamA: Team;
  teamB: Team;
  week: number;
  homeTeam: Team | null;
  awayTeam: Team | null;
  venue?: string | null;
  name?: string | null;
}): FullGame => ({
  teamA,
  teamB,
  weekPlayed: week,
  homeTeam,
  awayTeam,
  venue,
  name,
  rivalryKey: name,
});

describe('full schedule projection', () => {
  it('projects home, away, and named neutral games', () => {
    const userTeam = team(1, 'East');
    const conferenceOpponent = team(2, 'East');
    const awayOpponent = team(3, 'West');
    const neutralOpponent = team(4, 'Other');
    const schedule = buildSchedule();

    projectFullGamesToUserSchedule(schedule, userTeam, [
      game({
        teamA: userTeam,
        teamB: conferenceOpponent,
        week: 1,
        homeTeam: userTeam,
        awayTeam: conferenceOpponent,
      }),
      game({
        teamA: userTeam,
        teamB: awayOpponent,
        week: 2,
        homeTeam: awayOpponent,
        awayTeam: userTeam,
      }),
      game({
        teamA: userTeam,
        teamB: neutralOpponent,
        week: 3,
        homeTeam: null,
        awayTeam: null,
        venue: 'Test Bowl',
        name: 'Neutral Rivalry',
      }),
    ]);

    expect(schedule[0]).toMatchObject({
      opponent: { name: conferenceOpponent.name },
      location: 'Home',
      label: 'C (East)',
      venue: null,
    });
    expect(schedule[1]).toMatchObject({
      opponent: { name: awayOpponent.name },
      location: 'Away',
      label: 'NC (West)',
      venue: null,
    });
    expect(schedule[2]).toMatchObject({
      opponent: { name: neutralOpponent.name },
      location: 'Neutral',
      label: 'Neutral Rivalry',
      venue: 'Test Bowl',
    });
  });

  it('preserves persisted IDs and labels while clearing stale projected fields', () => {
    const userTeam = team(1, 'East');
    const opponent = team(2, 'West');
    const schedule = buildSchedule();
    schedule[0].id = 'persisted-game';
    schedule[0].label = 'Persisted Label';
    schedule[3].id = 'stale-game';
    schedule[3].label = 'Stale Label';
    schedule[3].location = 'Neutral';
    schedule[3].venue = 'Stale Venue';
    schedule[3].opponent = {
      name: 'Stale Opponent',
      rating: 1,
      ranking: 1,
      record: '0-0',
    };

    projectFullGamesToUserSchedule(schedule, userTeam, [game({
      teamA: userTeam,
      teamB: opponent,
      week: 1,
      homeTeam: userTeam,
      awayTeam: opponent,
    })]);

    expect(schedule[0]).toMatchObject({
      id: 'persisted-game',
      label: 'Persisted Label',
    });
    expect(schedule[3]).toMatchObject({
      id: '',
      opponent: null,
      venue: null,
    });
    expect(schedule[3].label).toBeUndefined();
    expect(schedule[3].location).toBeUndefined();
  });
});
