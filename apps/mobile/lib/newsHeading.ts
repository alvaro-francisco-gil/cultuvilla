import type { TypographyVariant } from '@cultuvilla/shared/design-system';
import type { NewsTextStyle } from '@cultuvilla/shared/models/news/NewsPostDataModel';

export type HeadingLevel = Exclude<NewsTextStyle, 'paragraph'>;

/** How each heading level reads — shared by the editor and the reader so what
 *  the author types looks like what the village sees. */
export const HEADING_PRESENTATION: Record<HeadingLevel, { variant: TypographyVariant; className: string }> = {
  section: { variant: 'h2', className: 'font-bold' },
  subsection: { variant: 'h3', className: 'font-semibold' },
};
