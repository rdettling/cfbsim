import type { ReactNode } from 'react';

type SectionProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export const Section = ({ title, description, actions, children }: SectionProps) => {
  return (
    <section className="ui-section">
      {(title || description || actions) ? (
        <header className="ui-section__header">
          <div>
            {title ? <h2 className="ui-section__title">{title}</h2> : null}
            {description ? <p className="ui-section__description">{description}</p> : null}
          </div>
          {actions}
        </header>
      ) : null}
      <div className="ui-section__body">{children}</div>
    </section>
  );
};

