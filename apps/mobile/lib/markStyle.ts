import type { TextStyle } from 'react-native';
import type { NewsMarkType } from '@cultuvilla/shared/models/news/NewsPostDataModel';

/**
 * How each formatting mark is applied when rendering a run.
 *
 * Bold and italic map to independent text properties (`fontWeight`,
 * `fontStyle`), so they go through NativeWind classes. Underline and
 * strikethrough BOTH map to the single `textDecorationLine` property, which a
 * class can't express reliably (only one class would win, so they couldn't
 * combine) — so decoration is driven by an explicit RN style instead, computed
 * from the active marks plus whether the run is a link/mention (those are always
 * underlined).
 */
const FONT_MARK_CLASS: Partial<Record<NewsMarkType, string>> = {
  bold: 'font-bold',
  italic: 'italic',
};

/** Space-joined bold/italic classes for a run's marks (empty string when none). */
export function markFontClasses(types: NewsMarkType[] | undefined): string {
  if (!types || types.length === 0) return '';
  return types.map((t) => FONT_MARK_CLASS[t]).filter(Boolean).join(' ');
}

/** `textDecorationLine` for the combination, or undefined when there is none. */
export function decorationStyle(underline: boolean, strikethrough: boolean): TextStyle | undefined {
  const parts: string[] = [];
  if (underline) parts.push('underline');
  if (strikethrough) parts.push('line-through');
  if (parts.length === 0) return undefined;
  return { textDecorationLine: parts.join(' ') as TextStyle['textDecorationLine'] };
}

export interface MarkPresentation {
  className: string;
  style?: TextStyle;
}

/**
 * Resolve a run's marks (and whether it is a link/mention — those underline) to
 * the className + style a `Text` needs. Underline comes from an `underline` mark
 * OR the link/mention treatment; strikethrough from a `strikethrough` mark.
 */
export function markPresentation(types: NewsMarkType[] | undefined, linked: boolean): MarkPresentation {
  const t = types ?? [];
  return {
    className: markFontClasses(t),
    style: decorationStyle(linked || t.includes('underline'), t.includes('strikethrough')),
  };
}
