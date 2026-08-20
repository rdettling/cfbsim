export type GameDataIntegrityCode =
  | 'INVALID_GAME_RECORD'
  | 'INVALID_GAME_DETAIL_RECORD';

export class GameDataIntegrityError extends Error {
  constructor(
    readonly code: GameDataIntegrityCode,
    message: string,
  ) {
    super(message);
    this.name = 'GameDataIntegrityError';
  }
}
