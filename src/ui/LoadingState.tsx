type LoadingStateProps = {
  title?: string;
  description?: string;
};

export const LoadingState = ({
  title = 'Loading',
  description = 'Preparing the current screen from league data.',
}: LoadingStateProps) => {
  return (
    <div className="ui-loading" role="status" aria-live="polite">
      <p className="ui-loading__title">{title}</p>
      <p className="ui-loading__description">{description}</p>
    </div>
  );
};
