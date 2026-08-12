import type { PlayerRecord } from '../types/db';
import type { Team } from '../types/domain';
import type { NamesData } from '../types/baseData';
import { RosterFinalizationRuleError } from '../types/roster';
import {
  generateName,
  generatePlayerRatings,
} from './recruiting/generation';
import { createSeededRandom } from './utils/random';
import { buildWalkOnOrigins } from './playerOrigins';
import {
  FINAL_ROSTER_SIZE,
  MAX_ROSTER_SIZE,
  POSITION_ORDER,
  ROSTER,
} from './rosterConfig';

export interface GenerateWalkOnsInput {
  teams: Team[];
  players: PlayerRecord[];
  names: NamesData;
  year: number;
  seed: number;
  nextPlayerId: number;
}

const assertWalkOnNames = (names: NamesData) => {
  for (const category of ['black', 'white'] as const) {
    const source = names[category];
    const validEntries = (entries: typeof source.first | undefined) =>
      Array.isArray(entries) &&
      entries.length > 0 &&
      entries.every(
        entry =>
          typeof entry.name === 'string' &&
          entry.name.length > 0 &&
          Number.isFinite(entry.weight) &&
          entry.weight > 0,
      );
    if (
      !source ||
      !validEntries(source.first) ||
      !validEntries(source.last)
    ) {
      throw new RosterFinalizationRuleError(
        'INVALID_WALK_ON_DATA',
        `Walk-on name category ${category} is malformed.`,
      );
    }
  }
};

const positionCounts = (players: PlayerRecord[]) =>
  Object.fromEntries(
    POSITION_ORDER.map(position => [
      position,
      players.filter(player => player.pos === position).length,
    ]),
  ) as Record<string, number>;

const assertActivePositions = (players: PlayerRecord[], teamId: number) => {
  const invalid = players.find(player => !(player.pos in ROSTER));
  if (invalid) {
    throw new RosterFinalizationRuleError(
      'INVALID_POSITION',
      `Active player ${invalid.id} has unsupported position ${invalid.pos}.`,
      invalid.id,
      teamId,
    );
  }
};

const choosePosition = (
  counts: Record<string, number>,
  seed: number,
  year: number,
  teamId: number,
  slot: number,
) => {
  const root = createSeededRandom(seed).fork(
    `walk-on-position:${year}:${teamId}:${slot}`,
  );
  const shortages = POSITION_ORDER.map(position => ({
    position,
    need: Math.max(0, ROSTER[position].starters - counts[position]),
  })).filter(entry => entry.need > 0);
  const pool = shortages.length
    ? shortages
    : POSITION_ORDER.map(position => ({
        position,
        need: Math.max(0, ROSTER[position].total - counts[position]),
      })).filter(entry => entry.need > 0);

  if (!pool.length) {
    throw new RosterFinalizationRuleError(
      'INVALID_ROSTER_SIZE',
      `Team ${teamId} cannot receive a walk-on without exceeding every soft positional target.`,
      undefined,
      teamId,
    );
  }

  return [...pool].sort(
    (left, right) =>
      right.need - left.need ||
      root.fork(left.position).next() - root.fork(right.position).next() ||
      left.position.localeCompare(right.position),
  )[0].position;
};

export const generateWalkOns = ({
  teams,
  players,
  names,
  year,
  seed,
  nextPlayerId,
}: GenerateWalkOnsInput) => {
  assertWalkOnNames(names);
  const ids = new Set<number>();
  for (const player of players) {
    if (ids.has(player.id)) {
      throw new RosterFinalizationRuleError(
        'UNKNOWN_PLAYER',
        `Player ID ${player.id} is duplicated.`,
        player.id,
      );
    }
    ids.add(player.id);
  }
  const highestId = players.reduce(
    (highest, player) => Math.max(highest, player.id),
    0,
  );
  if (
    !Number.isInteger(nextPlayerId) ||
    nextPlayerId <= highestId ||
    ids.has(nextPlayerId)
  ) {
    throw new RosterFinalizationRuleError(
      'INVALID_PLAYER_COUNTER',
      `Player counter ${nextPlayerId} is not ahead of the persisted player IDs.`,
    );
  }

  const additions: PlayerRecord[] = [];
  let cursor = nextPlayerId;
  for (const team of [...teams].sort((left, right) => left.id - right.id)) {
    const active = players
      .filter(player => player.teamId === team.id)
      .map(player => ({ ...player }));
    assertActivePositions(active, team.id);
    if (active.length > MAX_ROSTER_SIZE) {
      throw new RosterFinalizationRuleError(
        'INVALID_ROSTER_SIZE',
        `Team ${team.id} has ${active.length} active players before finalization.`,
        undefined,
        team.id,
      );
    }
    const counts = positionCounts(active);
    if (active.length >= FINAL_ROSTER_SIZE) {
      const shortage = POSITION_ORDER.find(
        position => counts[position] < ROSTER[position].starters,
      );
      if (shortage) {
        throw new RosterFinalizationRuleError(
          'STARTER_MINIMUM',
          `Team ${team.id} lacks the ${shortage} starter minimum and has no walk-on roster room.`,
          undefined,
          team.id,
        );
      }
      continue;
    }

    const needed = FINAL_ROSTER_SIZE - active.length;
    for (let slot = 0; slot < needed; slot += 1) {
      const position = choosePosition(counts, seed, year, team.id, slot);
      const random = createSeededRandom(seed).fork(
        `walk-on:${year}:${team.id}:${slot}`,
      );
      const name = generateName(position, names, random.fork('name'));
      const ratings = generatePlayerRatings(1, random.fork('ratings'));
      additions.push({
        id: cursor,
        teamId: team.id,
        ...name,
        year: 'fr',
        pos: position,
        rating: ratings.fr,
        rating_fr: ratings.fr,
        rating_so: ratings.so,
        rating_jr: ratings.jr,
        rating_sr: ratings.sr,
        stars: 1,
        development_trait: ratings.developmentTrait,
        starter: false,
      });
      cursor += 1;
      counts[position] += 1;
    }
  }

  return {
    players: additions,
    origins: buildWalkOnOrigins(additions, year),
    nextPlayerId: cursor,
  };
};
