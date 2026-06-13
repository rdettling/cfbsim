import { useEffect, useState } from 'react';
import { loadSettings } from '../../domain/league';
import type { SettingsPageData } from '../../types/pages';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { LoadingState } from '../../ui/LoadingState';
import { Page } from '../../ui/Page';
import { Section } from '../../ui/Section';
import styles from './SettingsPage.module.css';

const playoffLabel = (teams: number) => {
  if (teams === 2) return '2 Teams (BCS)';
  if (teams === 4) return '4 Teams';
  if (teams === 12) return '12 Teams';
  return `${teams} Teams`;
};

const Status = ({ enabled }: { enabled: boolean }) => (
  <span className={enabled ? styles.statusOn : styles.statusOff}>{enabled ? 'Enabled' : 'Disabled'}</span>
);

export const SettingsPage = () => {
  const [data, setData] = useState<SettingsPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const nextData = await loadSettings();
        if (!cancelled) {
          setData(nextData);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || 'Failed to load settings');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <LoadingState title="Loading settings" description="Pulling league configuration and postseason rules." />;
  }

  if (error || !data) {
    return <EmptyState title="Settings unavailable" description={error ?? 'No settings data was found.'} />;
  }

  const { settings } = data;

  return (
    <Page
      eyebrow="League Setup"
      title="Game Settings"
      description="Current playoff and season-transition configuration for this save."
      actions={<Button to="/dashboard">Back to Dashboard</Button>}
      compact
    >
      <div className={styles.layout}>
        <div className={styles.notice}>
          <p className={styles.noticeTitle}>Read-only during the season</p>
          <p className={styles.noticeText}>
            Playoff format and realignment settings can only be changed during the Realignment stage in the offseason.
          </p>
        </div>

        <Section title="Playoff Format" accent={data.team.colorPrimary || '#0f4c81'}>
          <div className={styles.grid}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Playoff Teams</span>
              <div className={styles.valueBox}>{playoffLabel(settings.playoff_teams)}</div>
            </div>

            {settings.playoff_teams === 12 ? (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Conference Champion Autobids</span>
                <div className={styles.valueBox}>{settings.playoff_autobids ?? 6}</div>
              </div>
            ) : null}

            {settings.playoff_teams === 12 ? (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Conference Champs in Top 4</span>
                <div className={styles.valueBox}>
                  <Status enabled={settings.playoff_conf_champ_top_4 ?? false} />
                </div>
              </div>
            ) : null}
          </div>
        </Section>

        <Section title="Season Transitions" accent="#2e7d32">
          <div className={styles.toggleList}>
            <div className={styles.toggleCard}>
              <div>
                <p className={styles.toggleTitle}>Auto Realignment</p>
                <p className={styles.toggleMeta}>
                  Automatically update conference assignments from year data during season transitions.
                </p>
              </div>
              <Status enabled={settings.auto_realignment} />
            </div>

            <div className={styles.toggleCard}>
              <div>
                <p className={styles.toggleTitle}>Auto Update Postseason Format</p>
                <p className={styles.toggleMeta}>
                  Automatically update playoff format from year data during season transitions.
                </p>
              </div>
              <Status enabled={settings.auto_update_postseason_format} />
            </div>
          </div>
        </Section>
      </div>
    </Page>
  );
};
