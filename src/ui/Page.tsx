import type { ReactNode } from 'react';

type PageProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  compact?: boolean;
  children: ReactNode;
};

export const Page = ({ title, description, eyebrow, actions, compact = false, children }: PageProps) => {
  return (
    <div className={compact ? 'ui-page ui-page--compact' : 'ui-page'}>
      <header className={compact ? 'ui-page__header ui-page__header--compact' : 'ui-page__header'}>
        {eyebrow ? <div className="ui-page__eyebrow">{eyebrow}</div> : null}
        <div className={compact ? 'ui-page__title-row ui-page__title-row--compact' : 'ui-page__title-row'}>
          <div>
            <h1 className={compact ? 'ui-page__title ui-page__title--compact' : 'ui-page__title'}>{title}</h1>
            {description ? (
              <p className={compact ? 'ui-page__description ui-page__description--compact' : 'ui-page__description'}>
                {description}
              </p>
            ) : null}
          </div>
          {actions}
        </div>
      </header>
      {children}
    </div>
  );
};
