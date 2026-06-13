type EmptyStateProps = {
  title: string;
  description: string;
};

export const EmptyState = ({ title, description }: EmptyStateProps) => {
  return (
    <div className="ui-empty">
      <p className="ui-empty__title">{title}</p>
      <p className="ui-empty__description">{description}</p>
    </div>
  );
};

