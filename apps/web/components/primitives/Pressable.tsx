import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface PressableProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  children: ReactNode;
  onPress: () => void;
}

// Interactive wrapper. `onPress` keeps the API aligned with React Native
// (where there is no `onClick`); a `<Pressable>` written today reads the
// same way when ported to mobile. Enforces the 44px touch target by
// applying min-w/min-h so even icon-only buttons stay tappable.
export function Pressable({
  children,
  onPress,
  className = '',
  disabled,
  type,
  ...rest
}: PressableProps) {
  return (
    <button
      type={type ?? 'button'}
      onClick={disabled ? undefined : onPress}
      disabled={disabled}
      className={`inline-flex items-center justify-center min-h-[44px] min-w-[44px] disabled:opacity-50 disabled:cursor-not-allowed active:opacity-80 transition ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
