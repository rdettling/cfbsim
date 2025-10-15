import { useParams } from 'react-router-dom';
import { apiService } from '../services/api';
import { GamePreviewData } from '../interfaces';
import { useDataFetching } from '../hooks/useDataFetching';
import GamePreview from '../components/GamePreview';
import GameResult from '../components/GameResult';
import { PageLayout } from '../components/PageLayout';

const Game = () => {
    const { id } = useParams<{ id: string }>();

    const { data, loading, error } = useDataFetching({
        fetchFunction: () => {
            if (!id) throw new Error('No game ID provided');
            return apiService.getGame<GamePreviewData>(id);
        },
        dependencies: [id],
        autoRefreshOnGameChange: true
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
            {data?.game.winner ? (
                <GameResult data={data} />
            ) : (
                data && <GamePreview game={data.game} />
            )}
        </PageLayout>
    );
};

export default Game;