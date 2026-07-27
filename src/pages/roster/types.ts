import type { PlayerRecord } from '../../types/db';

export type RosterPositionGroup = {
  position: string;
  players: PlayerRecord[];
};

export type RosterViewProps = {
  groups: RosterPositionGroup[];
};
