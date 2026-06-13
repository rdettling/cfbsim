type TeamMarkProps = {
  name: string;
  meta?: string;
  accent?: string;
};

const toInitials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

export const TeamMark = ({ name, meta, accent }: TeamMarkProps) => {
  return (
    <div className="ui-team-mark">
      <span className="ui-team-mark__badge" style={accent ? { background: accent } : undefined} aria-hidden="true">
        {toInitials(name)}
      </span>
      <span className="ui-team-mark__text">
        <span className="ui-team-mark__name">{name}</span>
        {meta ? <span className="ui-team-mark__meta">{meta}</span> : null}
      </span>
    </div>
  );
};

