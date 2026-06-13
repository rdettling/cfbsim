import type { ReactNode } from 'react';

type PageProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export const Page = ({ title, description, eyebrow, actions, children }: PageProps) => {
  return (
    <div className="ui-page">
      <header className="ui-page__header">
        {eyebrow ? <div className="ui-page__eyebrow">{eyebrow}</div> : null}
        <div className="ui-page__title-row">
          <div>
            <h1 className="ui-page__title">{title}</h1>
            {description ? <p className="ui-page__description">{description}</p> : null}
          </div>
          {actions}
        </div>
      </header>
      {children}
    </div>
  );
};

