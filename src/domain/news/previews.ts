import type { GameRecord } from '../../types/db';
import type { Team } from '../../types/domain';
import type { PreviewNewsItem, PreviewStoryAngle } from '../../types/news';
import {
  scorePreviewNewsworthiness,
  type NewsworthinessBreakdown,
} from './newsworthiness';
import {
  DEFENSE_DECKS,
  DEFENSE_HEADLINES,
  MATCHUP_DECKS,
  MATCHUP_HEADLINES,
  OUTLOOK_DECKS,
  OUTLOOK_HEADLINES,
  POLL_DECKS,
  POLL_HEADLINES,
  RIVALRY_DECKS,
  renderPreviewTemplate,
  selectPreviewTemplate,
} from './previewTemplates';

export interface PreviewStoryTrace {
  angle: PreviewStoryAngle;
  headlineTemplateId: string;
  deckTemplateId: string;
  featuredTeamIds: number[];
  featuredGameId: number | null;
  defendingChampionId: number | null;
  newsworthiness: NewsworthinessBreakdown;
}

const joinNames = (names: string[]) => names.length <= 1
  ? names[0] ?? ''
  : names.length === 2
    ? `${names[0]} and ${names[1]}`
    : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;

const rankedName = (team: Team) =>
  team.ranking >= 1 && team.ranking <= 25 ? `No. ${team.ranking} ${team.name}` : team.name;

const buildItem = ({
  year,
  angle,
  teamIds,
  gameId,
  headline,
  deck,
  importance,
}: {
  year: number;
  angle: PreviewStoryAngle;
  teamIds: number[];
  gameId: number | null;
  headline: string;
  deck: string;
  importance: number;
}): PreviewNewsItem => ({
  id: `preview:${year}:${angle}`,
  type: 'preview',
  year,
  week: 0,
  featuredTeamIds: teamIds,
  featuredGameId: gameId,
  headline,
  deck,
  primaryAngle: angle,
  storylines: [angle],
  importance,
});

export const generatePreseasonNews = ({
  year,
  teams,
  games,
  defendingChampionId,
}: {
  year: number;
  teams: Team[];
  games: GameRecord[];
  defendingChampionId: number | null;
}) => {
  const ranked = [...teams].sort((left, right) => left.ranking - right.ranking);
  const topFive = ranked.slice(0, 5);
  const topFour = ranked.slice(0, 4);
  const topTeam = topFive[0];
  if (!topTeam) throw new Error('Preseason news requires ranked teams.');
  const teamsById = new Map(teams.map(team => [team.id, team]));
  const champion = defendingChampionId === null ? null : teamsById.get(defendingChampionId) ?? null;
  const unplayedGames = games.filter(game => game.year === year && game.winnerId === null);
  const openingWeek = unplayedGames.length
    ? Math.min(...unplayedGames.map(game => game.weekPlayed))
    : null;
  const opener = unplayedGames
    .filter(game => game.weekPlayed === openingWeek)
    .sort((left, right) =>
      (right.watchability ?? 0) - (left.watchability ?? 0) || left.id - right.id)[0];
  if (!opener) throw new Error('Preseason news requires an opening matchup.');
  const teamA = teamsById.get(opener.teamAId);
  const teamB = teamsById.get(opener.teamBId);
  if (!teamA || !teamB) throw new Error('The marquee opener references an unknown team.');

  const commonTokens = {
    topTeam: topTeam.name,
    topGroup: joinNames(topFive.map(rankedName)),
    contenders: joinNames(topFour.map(rankedName)),
    nextTeams: joinNames(topFive.slice(1, 4).map(rankedName)),
    champion: champion?.name ?? topTeam.name,
  };
  const pollHeadline = selectPreviewTemplate(year, 'preseason_poll', 'headline', POLL_HEADLINES);
  const pollDeck = selectPreviewTemplate(year, 'preseason_poll', 'deck', POLL_DECKS);
  const pollScore = scorePreviewNewsworthiness({
    angle: 'preseason_poll',
    featuredRanks: topFive.map(team => team.ranking),
  });

  const outlookHeadlines = champion ? DEFENSE_HEADLINES : OUTLOOK_HEADLINES;
  const outlookDecks = champion ? DEFENSE_DECKS : OUTLOOK_DECKS;
  const outlookHeadline = selectPreviewTemplate(year, 'national_outlook', 'headline', outlookHeadlines);
  const outlookDeck = selectPreviewTemplate(year, 'national_outlook', 'deck', outlookDecks);
  const outlookTeamIds = [...new Set([
    ...(champion ? [champion.id] : []),
    ...topFour.map(team => team.id),
  ])];
  const outlookScore = scorePreviewNewsworthiness({
    angle: 'national_outlook',
    featuredRanks: outlookTeamIds.map(id => teamsById.get(id)?.ranking ?? 999),
  });

  const favorite = opener.winProbA >= opener.winProbB ? teamA : teamB;
  const favoriteProbability = opener.winProbA >= opener.winProbB
    ? opener.winProbA
    : opener.winProbB;
  const matchupTokens = {
    ...commonTokens,
    teamA: rankedName(teamA),
    teamB: rankedName(teamB),
    favorite: rankedName(favorite),
    winProbability: Math.round(favoriteProbability * 100),
    openingWeek: opener.weekPlayed,
  };
  const matchupHeadline = selectPreviewTemplate(year, 'marquee_opener', 'headline', MATCHUP_HEADLINES);
  const matchupDeck = selectPreviewTemplate(
    year,
    'marquee_opener',
    'deck',
    opener.rivalryKey ? RIVALRY_DECKS : MATCHUP_DECKS,
  );
  const editorialRanks = [opener.rankATOG, opener.rankBTOG]
    .filter(rank => rank >= 1 && rank <= 25);
  const matchupScore = scorePreviewNewsworthiness({
    angle: 'marquee_opener',
    featuredRanks: editorialRanks,
    bothRanked: editorialRanks.length === 2,
    rivalry: opener.rivalryKey !== null,
  });

  const generated = [
    {
      item: buildItem({
        year,
        angle: 'preseason_poll',
        teamIds: topFive.map(team => team.id),
        gameId: null,
        headline: renderPreviewTemplate(pollHeadline, commonTokens),
        deck: renderPreviewTemplate(pollDeck, commonTokens),
        importance: pollScore.total,
      }),
      trace: {
        angle: 'preseason_poll',
        headlineTemplateId: pollHeadline.id,
        deckTemplateId: pollDeck.id,
        featuredTeamIds: topFive.map(team => team.id),
        featuredGameId: null,
        defendingChampionId,
        newsworthiness: pollScore,
      } satisfies PreviewStoryTrace,
    },
    {
      item: buildItem({
        year,
        angle: 'national_outlook',
        teamIds: outlookTeamIds,
        gameId: null,
        headline: renderPreviewTemplate(outlookHeadline, commonTokens),
        deck: renderPreviewTemplate(outlookDeck, commonTokens),
        importance: outlookScore.total,
      }),
      trace: {
        angle: 'national_outlook',
        headlineTemplateId: outlookHeadline.id,
        deckTemplateId: outlookDeck.id,
        featuredTeamIds: outlookTeamIds,
        featuredGameId: null,
        defendingChampionId,
        newsworthiness: outlookScore,
      } satisfies PreviewStoryTrace,
    },
    {
      item: buildItem({
        year,
        angle: 'marquee_opener',
        teamIds: [teamA.id, teamB.id],
        gameId: opener.id,
        headline: renderPreviewTemplate(matchupHeadline, matchupTokens),
        deck: renderPreviewTemplate(matchupDeck, matchupTokens),
        importance: matchupScore.total,
      }),
      trace: {
        angle: 'marquee_opener',
        headlineTemplateId: matchupHeadline.id,
        deckTemplateId: matchupDeck.id,
        featuredTeamIds: [teamA.id, teamB.id],
        featuredGameId: opener.id,
        defendingChampionId,
        newsworthiness: matchupScore,
      } satisfies PreviewStoryTrace,
    },
  ];
  return generated;
};
