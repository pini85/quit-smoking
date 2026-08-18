import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg';

export type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-canvas',
  secondary: 'bg-primary-soft text-primary-strong',
  ghost: 'bg-transparent text-ink-muted',
  danger: 'bg-transparent text-danger',
};

// Both sizes clear the 44px minimum touch target.
const SIZES: Record<ButtonSize, string> = {
  md: 'h-12 px-5 text-[15px]',
  lg: 'h-14 px-6 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-button font-medium',
        'transition-transform duration-[var(--dur-press)] active:scale-[0.97]',
        'disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        fullWidth ? 'w-full' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </button>
  );
}

export default Button;
