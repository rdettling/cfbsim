import { Navigate } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { getStageRoute } from '../constants/stages';
import { useDomainData } from '../domain/hooks';
import { loadAuthoritativeStage } from '../domain/league/loaders/loadAuthoritativeStage';
import type { AuthoritativeStagePageData } from '../types/pages';

const AuthoritativeStageRedirect = () => {
  const { data, loading, error } =
    useDomainData<AuthoritativeStagePageData>({
      fetcher: loadAuthoritativeStage,
    });

  return (
    <PageLayout loading={loading} error={error}>
      {data ? (
        <Navigate to={getStageRoute(data.info.stage)} replace />
      ) : null}
    </PageLayout>
  );
};

export default AuthoritativeStageRedirect;
