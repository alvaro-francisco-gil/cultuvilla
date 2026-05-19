import type { HTMLAttributes, ReactNode, JSX } from 'react';
import type { TypographyVariant } from '@cultuvilla/shared/design-system';

type Tone = 'primary' | 'muted' | 'onAccent' | 'danger' | 'success';

interface TextProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  children: ReactNode;
  variant?: TypographyVariant;
  tone?: Tone;
}

const TONE_CLASS: Record<Tone, string> = {
  primary: 'text-primary',
  muted: 'text-muted',
  onAccent: 'text-on-accent',
  danger: 'text-danger',
  success: 'text-success',
};

const TAG: Record<TypographyVariant, keyof JSX.IntrinsicElements> = {
  display: 'h1',
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  body: 'span',
  bodySm: 'span',
  caption: 'span',
};

// Typography primitive. Renders the right HTML element for its variant
// (so headings stay semantic), pulls size/weight/line-height from the
// type scale, and accepts a `tone` to switch semantic text color.
export function Text({
  children,
  variant = 'body',
  tone = 'primary',
  className = '',
  ...rest
}: TextProps) {
  const Tag = TAG[variant];
  return (
    <Tag
      className={`text-${variant} ${TONE_CLASS[tone]} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
