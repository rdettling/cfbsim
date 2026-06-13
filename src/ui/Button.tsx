import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

type SharedProps = {
  children: ReactNode;
  variant?: ButtonVariant;
};

type LinkButtonProps = SharedProps & {
  to: string;
};

type NativeButtonProps = SharedProps & ButtonHTMLAttributes<HTMLButtonElement> & {
  to?: never;
};

type ButtonProps = LinkButtonProps | NativeButtonProps;

const classNameFor = (variant: ButtonVariant) => `ui-button ui-button--${variant}`;

export const Button = ({ children, variant = 'primary', ...props }: ButtonProps) => {
  if ('to' in props) {
    const { to } = props as LinkButtonProps;

    return (
      <Link className={classNameFor(variant)} to={to}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classNameFor(variant)} type="button" {...props}>
      {children}
    </button>
  );
};
