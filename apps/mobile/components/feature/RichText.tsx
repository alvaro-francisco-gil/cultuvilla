import { Fragment } from 'react';
import { Text as RNText, Linking } from 'react-native';
import { router } from 'expo-router';
import { Text } from '../primitives';
import type { TextProps } from '../primitives/Text';
import { mentionHref } from '../../lib/newsMentions';
import { buildLinkRuns, isSafeHttpUrl } from '../../lib/linkText';
import type { NewsMention, NewsLink, NewsBold } from '@cultuvilla/shared/models/news/NewsPostDataModel';

interface RichTextProps extends Omit<TextProps, 'children'> {
  text: string;
  mentions: NewsMention[];
  /** Stored custom-text external links indexing into `text`. */
  links?: NewsLink[];
  /** Stored bold spans indexing into `text`. */
  bolds?: NewsBold[];
  municipalityId: string;
}

const LINK_CLASS = 'text-accent font-medium underline';

function openExternal(url: string) {
  if (isSafeHttpUrl(url)) void Linking.openURL(url);
}

/**
 * Render a text block with its inline `@`-mentions (in-app navigation),
 * external links — both stored custom-text links and bare URLs autolinked at
 * render — and bold spans, styled and tappable. Unsafe-scheme URLs render as
 * plain text.
 */
export function RichText({ text, mentions, links = [], bolds = [], municipalityId, ...textProps }: RichTextProps) {
  const runs = buildLinkRuns(text, mentions, links, bolds);
  if (runs.length === 1 && !runs[0]!.mention && !runs[0]!.link && !runs[0]!.autoUrl && !runs[0]!.bold) {
    return <Text {...textProps}>{text}</Text>;
  }

  const parts = runs.map((run, i) => {
    if (run.mention) {
      const href = mentionHref(run.mention, municipalityId);
      return (
        <RNText
          key={i}
          className={run.bold ? `${LINK_CLASS} font-bold` : LINK_CLASS}
          onPress={href ? () => router.push(href as never) : undefined}
        >
          {run.text}
        </RNText>
      );
    }
    const url = run.link?.url ?? run.autoUrl;
    if (url && isSafeHttpUrl(url)) {
      return (
        <RNText
          key={i}
          className={run.bold ? `${LINK_CLASS} font-bold` : LINK_CLASS}
          onPress={() => openExternal(url)}
        >
          {run.text}
        </RNText>
      );
    }
    if (run.bold) {
      return (
        <RNText key={i} className="font-bold">
          {run.text}
        </RNText>
      );
    }
    return <Fragment key={i}>{run.text}</Fragment>;
  });

  return <Text {...textProps}>{parts}</Text>;
}
