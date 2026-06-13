import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loadRealignment, updateRealignmentSettings } from '../../domain/league';
import type { Settings } from '../../types/domain';
import type { RealignmentPageData } from '../../types/pages';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { LoadingState } from '../../ui/LoadingState';
import { Page } from '../../ui/Page';
import { Section } from '../../ui/Section';
import styles from './NewRealignmentPage.module.css';

type PlayoffChanges = {
  teams?: { old: number; new: number };
  autobids?: { old: number; new: number };
  conf_champ_top_4?: { old: boolean; new: boolean };
};

const playoffLabel = (teams: number) => {
  if (teams === 2) return '2 Teams (BCS)';
  if (teams === 4) return '4 Teams';
  if (teams === 12) return '12 Teams';
  return `${teams} Teams`;
};

export const NewRealignmentPage = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<RealignmentPageData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const nextData = await loadRealignment();
        if (!cancelled) {
          setData(nextData);
          setSettings(nextData.settings);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || 'Failed to load realignment data');
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
      if (timer) clearTimeout(timer);
    };
  }, []);

  const handlePlayoffTeamsChange = (teams: number) => {
    if (!settings) return;
    const nextSettings: Settings = { ...settings, playoff_teams: teams };
    if (teams !== 12) {
      nextSettings.playoff_autobids = undefined;
      nextSettings.playoff_conf_champ_top_4 = false;
    } else {
      nextSettings.playoff_autobids = settings.playoff_autobids || 6;
    }
    setSettings(nextSettings);
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    try {
      await updateRealignmentSettings(settings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError((err as Error).message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState title="Loading realignment" description="Preparing next-season changes and postseason format options." />;
  }

  if (error || !data || !settings) {
    return <EmptyState title="Realignment unavailable" description={error ?? 'No realignment data was found.'} />;
  }

  const realignmentChanges = Object.entries(data.realignment || {});
  const playoffChanges: PlayoffChanges = data.playoff_changes || {};

  return (
    <Page
      eyebrow="Offseason Setup"
      title="Configure Next Season"
      description="Review transition rules, proposed conference moves, and postseason format changes."
      actions={<Button to="/__new/summary">Back to Summary</Button>}
      compact
    >
      <div className={styles.layout}>
        <Section title="Season Transitions" accent={data.team.colorPrimary || '#0f4c81'}>
          <div className={styles.controls}>
            <div className={styles.toggleRow}>
              <div>
                <p className={styles.toggleTitle}>Auto Realignment</p>
                <p className={styles.toggleMeta}>Automatically update conference assignments from year data.</p>
              </div>
              <label className={styles.switch}>
                <input
                  checked={settings.auto_realignment}
                  onChange={(event) => setSettings({ ...settings, auto_realignment: event.target.checked })}
                  type="checkbox"
                />
                <span>{settings.auto_realignment ? 'On' : 'Off'}</span>
              </label>
            </div>

            <div className={styles.toggleRow}>
              <div>
                <p className={styles.toggleTitle}>Auto Update Postseason Format</p>
                <p className={styles.toggleMeta}>Automatically update playoff format from year data.</p>
              </div>
              <label className={styles.switch}>
                <input
                  checked={settings.auto_update_postseason_format}
                  onChange={(event) => setSettings({ ...settings, auto_update_postseason_format: event.target.checked })}
                  type="checkbox"
                />
                <span>{settings.auto_update_postseason_format ? 'On' : 'Off'}</span>
              </label>
            </div>

            {!settings.auto_update_postseason_format ? (
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Playoff Teams</span>
                  <select
                    className={styles.select}
                    onChange={(event) => handlePlayoffTeamsChange(Number(event.target.value))}
                    value={settings.playoff_teams}
                  >
                    <option value={2}>2 Teams (BCS)</option>
                    <option value={4}>4 Teams</option>
                    <option value={12}>12 Teams</option>
                  </select>
                </label>

                {settings.playoff_teams === 12 ? (
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Conference Champion Autobids</span>
                    <select
                      className={styles.select}
                      onChange={(event) => setSettings({ ...settings, playoff_autobids: Number(event.target.value) })}
                      value={settings.playoff_autobids || 6}
                    >
                      {Array.from({ length: 11 }, (_, index) => (
                        <option key={index} value={index}>
                          {index}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {settings.playoff_teams === 12 ? (
                  <div className={styles.toggleRow}>
                    <div>
                      <p className={styles.toggleTitle}>Conference Champions in Top 4 Seeds</p>
                      <p className={styles.toggleMeta}>Reserve top-four seeds for conference champions.</p>
                    </div>
                    <label className={styles.switch}>
                      <input
                        checked={settings.playoff_conf_champ_top_4 || false}
                        onChange={(event) => setSettings({ ...settings, playoff_conf_champ_top_4: event.target.checked })}
                        type="checkbox"
                      />
                      <span>{settings.playoff_conf_champ_top_4 ? 'On' : 'Off'}</span>
                    </label>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className={styles.note}>Year data will drive next season’s postseason format automatically.</div>
            )}
          </div>
        </Section>

        {realignmentChanges.length > 0 ? (
          <Section
            title="Proposed Conference Realignment"
            accent="#2e7d32"
            actions={!settings.auto_realignment ? <span className={styles.warning}>Will not apply while auto realignment is off</span> : undefined}
          >
            <div className={styles.tablePanel}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Old Conference</th>
                    <th>New Conference</th>
                  </tr>
                </thead>
                <tbody>
                  {realignmentChanges.map(([team, confs], index) => (
                    <tr className={index % 2 === 1 ? styles.altRow : undefined} key={team}>
                      <td>
                        <Link className={styles.teamLink} to={`/__new/${team}/history`}>
                          {team}
                        </Link>
                      </td>
                      <td><span className={styles.chipOld}>{confs.old}</span></td>
                      <td><span className={styles.chipNew}>{confs.new}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        ) : null}

        {Object.keys(playoffChanges).length > 0 ? (
          <Section
            title="Proposed Playoff Format Changes"
            accent="#0f4c81"
            actions={!settings.auto_update_postseason_format ? <span className={styles.warning}>Will not apply while auto update is off</span> : undefined}
          >
            <div className={styles.tablePanel}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Setting</th>
                    <th>Current</th>
                    <th>Proposed</th>
                  </tr>
                </thead>
                <tbody>
                  {playoffChanges.teams ? (
                    <tr>
                      <td>Playoff Teams</td>
                      <td>{playoffLabel(playoffChanges.teams.old)}</td>
                      <td><span className={styles.chipNew}>{playoffLabel(playoffChanges.teams.new)}</span></td>
                    </tr>
                  ) : null}
                  {playoffChanges.autobids ? (
                    <tr className={playoffChanges.teams ? styles.altRow : undefined}>
                      <td>Conference Champion Autobids</td>
                      <td>{playoffChanges.autobids.old}</td>
                      <td><span className={styles.chipNew}>{playoffChanges.autobids.new}</span></td>
                    </tr>
                  ) : null}
                  {playoffChanges.conf_champ_top_4 ? (
                    <tr className={styles.altRow}>
                      <td>Conference Champions in Top 4</td>
                      <td>{playoffChanges.conf_champ_top_4.old ? 'Yes' : 'No'}</td>
                      <td><span className={styles.chipNew}>{playoffChanges.conf_champ_top_4.new ? 'Yes' : 'No'}</span></td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Section>
        ) : null}

        {saveSuccess ? <div className={styles.statusSuccess}>Settings saved successfully.</div> : null}
        {saveError ? <div className={styles.statusError}>{saveError}</div> : null}

        <div className={styles.actions}>
          <Button disabled={saving} onClick={handleSave} variant="secondary">
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
          <Button onClick={() => navigate('/__new/roster_progression')}>Advance to Progression</Button>
        </div>
      </div>
    </Page>
  );
};
