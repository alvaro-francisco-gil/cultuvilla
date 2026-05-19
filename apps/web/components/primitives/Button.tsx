import type { ReactNode } from 'react';
import { Pressable } from './Pressable';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

interface ButtonProps {
  children: ReactNode;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: `data-${string}`]: any;
}

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:opacity-90',
  secondary:
    'bg-subtle text-primary border border-subtle hover:bg-subtle',
  ghost: 'bg-transparent text-primary hover:bg-subtle',
  danger: 'bg-danger text-on-danger hover:opacity-90',
};

const SIZE: Record<Size, string> = {
  md: 'px-4 py-2 text-body',
  lg: 'px-6 py-3 text-body',
};

export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`${VARIANT[variant]} ${SIZE[size]} rounded-md font-medium ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
      {...rest}
    >
      {loading ? '…' : children}
    </Pressable>
  );
}
