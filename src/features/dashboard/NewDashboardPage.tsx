import { EmptyState } from '../../ui/EmptyState';
import { Page } from '../../ui/Page';
import { Section } from '../../ui/Section';
import { StatCard } from '../../ui/StatCard';
import { DataTable } from '../../ui/DataTable';
import { TeamMark } from '../../ui/TeamMark';
import styles from './NewDashboardPage.module.css';

const topTeams = [
  ['1', <TeamMark name="Oregon" meta="11-1 overall" accent="#1d6b4f" />, '34.8 PPG', '10.4 PAPG'],
  ['2', <TeamMark name="Texas" meta="10-2 overall" accent="#c7632b" />, '31.1 PPG', '15.7 PAPG'],
  ['3', <TeamMark name="Ohio State" meta="10-2 overall" accent="#b71c1c" />, '30.2 PPG', '16.2 PAPG'],
];

export const NewDashboardPage = () => {
  return (
    <Page
      eyebrow="Reference Screen"
      title="The new dashboard should feel like a hub, not a stack of unrelated cards."
      description="This page is still static, but it defines the shell direction: stronger hierarchy, tighter navigation, simpler surfaces, and mobile-safe data presentation patterns."
    >
      <div className="ui-stat-grid">
        <StatCard label="Current week" value="Week 8" meta="Season hub context belongs near the top." />
        <StatCard label="Team status" value="9-1" meta="Primary program context should read instantly on any screen size." />
        <StatCard label="Next opponent" value="at USC" meta="Key game context should sit alongside season state instead of below multiple layers." />
      </div>

      <div className={styles.grid}>
        <Section
          title="Season Snapshot"
          description="The eventual dashboard can combine team context, schedule state, and next actions without recreating the old four-column desktop-only composition."
        >
          <div className={styles.snapshot}>
            <div className={styles.snapshotCard}>
              <span className={styles.label}>Program</span>
              <TeamMark name="Notre Dame" meta="Independent" accent="#0f4c81" />
            </div>
            <div className={styles.snapshotCard}>
              <span className={styles.label}>Ranking</span>
              <strong className={styles.metric}>#6 AP</strong>
            </div>
            <div className={styles.snapshotCard}>
              <span className={styles.label}>Trajectory</span>
              <strong className={styles.metric}>Playoff hunt</strong>
            </div>
          </div>
        </Section>

        <Section
          title="Top Teams"
          description="Tables still matter in a sports sim, but they should read cleanly and degrade well instead of assuming a giant fixed desktop canvas."
        >
          <DataTable
            headers={['Rank', 'Team', 'Offense', 'Defense']}
            rows={topTeams}
          />
        </Section>
      </div>

      <Section
        title="What comes next"
        description="The next real migration step is to replace these placeholders with data-backed Home and Dashboard screens using existing loaders where they remain useful."
      >
        <EmptyState
          title="Static preview by design"
          description="This screen is intentionally thin. It proves the new structure first so feature migration can happen without rethinking layout, styling, and routing every time."
        />
      </Section>
    </Page>
  );
};

