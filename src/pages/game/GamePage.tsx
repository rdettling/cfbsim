import { useParams } from 'react-router-dom';
import { useDomainData } from '../../domain/hooks';
import { loadGame } from '../../domain/league';
import GamePreviewPage from './GamePreviewPage';
import GameResultPage from './GameResultPage';
import { PageLayout } from '../../components/layout/PageLayout';
import type { GamePageData } from '../../types/pages';

const GamePage = () => {
  const { id } = useParams<{ id: string }>();

  const { data, loading, error } = useDomainData<GamePageData>({
    fetcher: () => {
      if (!id) throw new Error('No game ID provided');
      const gameId = Number(id);
      if (Number.isNaN(gameId)) throw new Error('Invalid game ID');
      return loadGame(gameId);
    },
    deps: [id],
  });

  const isComplete = data ? data.game.winnerId !== null : false;

  return (
    <PageLayout
      loading={loading}
      error={error}
      navbarData={
        data
          ? {
              team: data.team,
              currentStage: data.info.stage,
              info: data.info,
              conferences: data.conferences,
            }
          : undefined
      }
      containerMaxWidth="xl"
      desktopViewportConstrained={Boolean(data)}
    >
      {data && isComplete ? (
        <GameResultPage data={data} />
      ) : (
        data && <GamePreviewPage data={data} />
      )}
    </PageLayout>
  );
};

export default GamePage;
