import { useParams } from 'react-router-dom';
import { useDomainData } from '../domain/hooks';
import { loadGame } from '../domain/league';
import GamePreview from '../components/game/GamePreview';
import GameResult from '../components/game/GameResult';
import { PageLayout } from '../components/layout/PageLayout';

interface GamePageData {
  info: any;
  team: any;
  conferences: any[];
  game: any;
  drives?: any[];
}

const Game = () => {
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

    return (
        <PageLayout 
            loading={loading} 
            error={error}
            navbarData={data ? {
                team: data.team,
                currentStage: data.info.stage,
                info: data.info,
                conferences: data.conferences
            } : undefined}
            containerMaxWidth="xl"
        >
            {data?.game?.winnerId ? (
                <GameResult data={data} />
            ) : (
                data && <GamePreview game={data.game} />
            )}
        </PageLayout>
    );
};

export default Game;
