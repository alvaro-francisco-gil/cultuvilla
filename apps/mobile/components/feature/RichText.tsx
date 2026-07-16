import { Fragment } from 'react';
import { Text as RNText, Linking } from 'react-native';
import { router } from 'expo-router';
import { Text } from '../primitives';
import type { TextProps } from '../primitives/Text';
import { mentionHref } from '../../lib/newsMentions';
import { buildLinkRuns, isSafeHttpUrl } from '../../lib/linkText';
import { markPresentation } from '../../lib/markStyle';
import type { NewsMention, NewsLink, NewsMark } from '@cultuvilla/shared/models/news/NewsPostDataModel';

interface RichTextProps extends Omit<TextProps, 'children'> {
  text: string;
  mentions: NewsMention[];
  /** Stored custom-text external links indexing into `text`. */
  links?: NewsLink[];
  /** Stored formatting marks (bold/italic/underline/strikethrough) indexing into `text`. */
  marks?: NewsMark[];
  municipalityId: string;
}

// Colour + weight for a link/mention span. Underline is NOT here — decoration is
// applied via style (markStyle.ts) so it composes with a strikethrough mark.
const LINK_CLASS = 'text-accent font-medium';

function openExternal(url: string) {
  if (isSafeHttpUrl(url)) void Linking.openURL(url);
}

/**
 * Render a text block with its inline `@`-mentions (in-app navigation),
 * external links — both stored custom-text links and bare URLs autolinked at
 * render — and formatting marks (bold/italic/underline/strikethrough), styled
 * and tappable. Unsafe-scheme URLs render as plain text.
 */
export function RichText({ text, mentions, links = [], marks = [], municipalityId, ...textProps }: RichTextProps) {
  const runs = buildLinkRuns(text, mentions, links, marks);
  if (runs.length === 1 && !runs[0]!.mention && !runs[0]!.link && !runs[0]!.autoUrl && !runs[0]!.marks) {
    return <Text {...textProps}>{text}</Text>;
  }

  const parts = runs.map((run, i) => {
    if (run.mention) {
      const href = mentionHref(run.mention, municipalityId);
      const pres = markPresentation(run.marks, true);
      return (
        <RNText
          key={i}
          className={`${LINK_CLASS} ${pres.className}`}
          style={pres.style}
          onPress={href ? () => router.push(href as never) : undefined}
        >
          {run.text}
        </RNText>
      );
    }
    const url = run.link?.url ?? run.autoUrl;
    if (url && isSafeHttpUrl(url)) {
      const pres = markPresentation(run.marks, true);
      return (
        <RNText
          key={i}
          className={`${LINK_CLASS} ${pres.className}`}
          style={pres.style}
          onPress={() => openExternal(url)}
        >
          {run.text}
        </RNText>
      );
    }
    if (run.marks?.length) {
      const pres = markPresentation(run.marks, false);
      return (
        <RNText key={i} className={pres.className} style={pres.style}>
          {run.text}
        </RNText>
      );
    }
    return <Fragment key={i}>{run.text}</Fragment>;
  });

  return <Text {...textProps}>{parts}</Text>;
}
