import { PageLayout } from '../components/layout/PageLayout';
import RoadmapPageState from '../components/layout/RoadmapPageState';
import { useDomainData } from '../domain/hooks';
import { loadPostseasonProjections } from '../domain/league/loaders/roadmap';
import type { PostseasonProjectionsPageData } from '../types/pages';

const PostseasonProjections = () => {
  const { data, loading, error } = useDomainData<PostseasonProjectionsPageData>({
    fetcher: loadPostseasonProjections,
  });

  return (
    <PageLayout
      loading={loading}
      error={error}
      containerMaxWidth="xl"
      navbarData={data ? {
        team: data.team,
        currentStage: data.info.stage,
        info: data.info,
        conferences: data.conferences,
      } : undefined}
    >
      {data && (
        <RoadmapPageState
          title="Postseason Projections"
          seasonLabel={`${data.info.currentYear} season · Week ${data.info.currentWeek}`}
          description="Playoff odds, seed forecasts, and championship probabilities will live here. These forecast models are not available yet; the current projected field remains on Playoff Picture."
        />
      )}
    </PageLayout>
  );
};

export default PostseasonProjections;
