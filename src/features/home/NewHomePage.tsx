import { Button } from '../../ui/Button';
import { Page } from '../../ui/Page';
import { Section } from '../../ui/Section';
import { StatCard } from '../../ui/StatCard';
import styles from './NewHomePage.module.css';

const checklist = [
  'Lean app shell with no component library dependency in the new path',
  'Responsive layout rules and spacing tokens for desktop and mobile',
  'Feature-local UI ownership instead of giant page files',
];

export const NewHomePage = () => {
  return (
    <Page
      eyebrow="Phase 1"
      title="A lighter frontend for a sports sim that still feels interactive."
      description="This preview path is the new shell. It exists to prove the visual language, routing model, and primitive layer before real data-backed screens replace the old UI."
      actions={<Button to="/__new/dashboard">Open Preview Dashboard</Button>}
    >
      <div className="ui-stat-grid">
        <StatCard label="Shell status" value="Live" meta="The new frontend entrypoint is running alongside the legacy app." />
        <StatCard label="UI stack" value="Plain React" meta="Global CSS plus feature-local styling replaces the old component-library-first path." />
        <StatCard label="Migration mode" value="Parallel" meta="Current routes still work while new screens are built under a dedicated preview namespace." />
      </div>

      <div className={styles.grid}>
        <Section
          title="What this step accomplishes"
          description="The shell phase is about foundation, not parity. It creates the minimum viable structure needed to rebuild feature screens without carrying the old layout and styling model forward."
        >
          <ul className={styles.list}>
            {checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Section>

        <Section
          title="Migration path"
          description="Home and Dashboard are the first reference screens because they define navigation, hierarchy, surface design, and data presentation patterns for most of the app."
          actions={<Button variant="secondary" to="/__new/dashboard">View the first reference screen</Button>}
        >
          <div className={styles.callout}>
            <strong>Legacy app remains available.</strong>
            <p>The existing application continues to run at the normal routes while the new shell evolves at <code>/__new</code>.</p>
          </div>
        </Section>
      </div>
    </Page>
  );
};

