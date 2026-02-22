import { useParams } from 'react-router-dom';
import { useDomainData } from '../../domain/hooks';
import { loadGame } from '../../domain/league';
import GamePreviewPage from './GamePreviewPage';
import GameResultPage from './GameResultPage';
import { PageLayout } from '../../components/layout/PageLayout';

const GamePage = () => {
    const { id } = useParams<{ id: string }>();

    const { data, loading, error } = useDomainData({
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
                <GameResultPage data={data} />
            ) : (
                data && <GamePreviewPage data={data} />
            )}
        </PageLayout>
    );
};

export default GamePage;
