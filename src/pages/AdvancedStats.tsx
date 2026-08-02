import { PageLayout } from '../components/layout/PageLayout';
import RoadmapPageState from '../components/layout/RoadmapPageState';
import { useDomainData } from '../domain/hooks';
import { loadAdvancedStats } from '../domain/league';
import type { AdvancedStatsPageData } from '../types/pages';

const AdvancedStats = () => {
  const { data, loading, error } = useDomainData<AdvancedStatsPageData>({
    fetcher: loadAdvancedStats,
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
          title="Advanced Statistics"
          seasonLabel={`${data.info.currentYear} season`}
          description="Efficiency, explosiveness, and situational analysis will live here. These advanced metrics are not calculated yet."
        />
      )}
    </PageLayout>
  );
};

export default AdvancedStats;
