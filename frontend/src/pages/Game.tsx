import { useParams } from 'react-router-dom';
import { apiService } from '../services/api';
import { GamePreviewData } from '../interfaces';
import { DataPage } from '../components/DataPage';
import GamePreview from '../components/GamePreview';
import GameResult from '../components/GameResult';

const Game = () => {
    const { id } = useParams<{ id: string }>();

    return (
        <DataPage
            fetchFunction={() => {
                if (!id) throw new Error('No game ID provided');
                return apiService.getGame<GamePreviewData>(id);
            }}
            dependencies={[id]}
        >
            {(data) => {
                return (
                    <>
                        {data.game.winner ? (
                            <GameResult data={data} />
                        ) : (
                            <GamePreview game={data.game} top_players={data.top_players} />
                        )}
                    </>
                );
            }}
        </DataPage>
    );
};

export default Game;