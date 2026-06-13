import type { ReactNode, SelectHTMLAttributes } from 'react';
import type { Team } from '../../types/domain';
import styles from './TeamPageHeader.module.css';

type TeamHeaderSelectProps = {
  label: string;
  options: Array<{ value: string | number; label: string }>;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'>;

type TeamPageHeaderProps = {
  team: Team;
  subtitle: ReactNode;
  children?: ReactNode;
};

export const TeamHeaderSelect = ({ label, options, ...props }: TeamHeaderSelectProps) => (
  <label className={styles.field}>
    <span className={styles.label}>{label}</span>
    <select className={styles.select} {...props}>
      {options.map((option) => (
        <option key={String(option.value)} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

export const TeamPageHeader = ({ team, subtitle, children }: TeamPageHeaderProps) => {
  const accent = team.colorPrimary || '#0f4c81';

  return (
    <section className={styles.header} style={{ borderTopColor: accent }}>
      <div className={styles.left}>
        <div className={styles.badge} style={{ background: accent }}>
          {team.abbreviation}
        </div>
        <div>
          <h2 className={styles.title}>
            {team.ranking > 0 ? `#${team.ranking} ` : ''}
            {team.name} {team.mascot}
          </h2>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
      </div>
      {children ? <div className={styles.controls}>{children}</div> : null}
    </section>
  );
};
