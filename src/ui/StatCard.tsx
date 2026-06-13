type StatCardProps = {
  label: string;
  value: string;
  meta?: string;
};

export const StatCard = ({ label, value, meta }: StatCardProps) => {
  return (
    <article className="ui-stat-card">
      <p className="ui-stat-card__label">{label}</p>
      <p className="ui-stat-card__value">{value}</p>
      {meta ? <p className="ui-stat-card__meta">{meta}</p> : null}
    </article>
  );
};

