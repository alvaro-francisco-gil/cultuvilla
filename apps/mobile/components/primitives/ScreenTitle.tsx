import { Text, type TextProps } from './Text';

/**
 * Large single-line screen title (village name / user name). Renders at the
 * `h1` size but shrinks to fit its available width instead of wrapping to a
 * second line, so long names stay on one line. On native this uses
 * `adjustsFontSizeToFit`; on web (RN-Web doesn't support it) it degrades to a
 * single line with an ellipsis.
 */
export function ScreenTitle({ className = '', ...rest }: Omit<TextProps, 'variant'>) {
  return (
    <Text
      variant="h1"
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.6}
      className={`font-bold ${className}`}
      {...rest}
    />
  );
}
