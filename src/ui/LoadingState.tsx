type LoadingStateProps = {
  title?: string;
  description?: string;
};

export const LoadingState = ({
  title = 'Loading preview',
  description = 'The new frontend shell is ready for feature work. Data-backed screens will replace placeholders as migration continues.',
}: LoadingStateProps) => {
  return (
    <div className="ui-loading" role="status" aria-live="polite">
      <p className="ui-loading__title">{title}</p>
      <p className="ui-loading__description">{description}</p>
    </div>
  );
};

