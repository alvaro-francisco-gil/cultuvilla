import type { NewsMarkType } from '@cultuvilla/shared/models/news/NewsPostDataModel';

/**
 * NativeWind class for each formatting mark. Bold/italic map to independent
 * text properties, so they compose freely; underline and strikethrough both map
 * to `textDecorationLine`, so applying BOTH renders only one (last class wins) —
 * an accepted limitation for that rare combination.
 */
export const MARK_CLASS: Record<NewsMarkType, string> = {
  bold: 'font-bold',
  italic: 'italic',
  underline: 'underline',
  strikethrough: 'line-through',
};

/** Space-joined classes for a run's active marks (empty string when none). */
export function markClasses(types: NewsMarkType[] | undefined): string {
  if (!types || types.length === 0) return '';
  return types.map((t) => MARK_CLASS[t]).join(' ');
}
