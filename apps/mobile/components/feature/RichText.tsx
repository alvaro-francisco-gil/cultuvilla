import { Fragment } from 'react';
import { Text as RNText } from 'react-native';
import { router } from 'expo-router';
import { Text } from '../primitives';
import type { TextProps } from '../primitives/Text';
import { mentionHref } from '../../lib/newsMentions';
import { mentionRuns } from '../../lib/mentionText';
import type { NewsMention } from '@cultuvilla/shared/models/news/NewsPostDataModel';

interface RichTextProps extends Omit<TextProps, 'children'> {
  text: string;
  /** Mention spans indexing into `text` by `offset`/`length`. */
  mentions: NewsMention[];
  /** The post's village — needed to build place deep-links. */
  municipalityId: string;
}

/**
 * Render a text block with its inline `@`-mentions styled and (where a route
 * exists) tappable. The mention's display text lives in `text` at
 * `[offset, offset+length]`; `mentions` only annotates the ranges. Spans that
 * are out of range or overlap an earlier one are skipped so a malformed post
 * still renders its prose rather than crashing.
 */
export function RichText({ text, mentions, municipalityId, ...textProps }: RichTextProps) {
  if (!mentions.length) return <Text {...textProps}>{text}</Text>;

  const parts = mentionRuns(text, mentions).map((run, i) => {
    if (!run.mention) return <Fragment key={i}>{run.text}</Fragment>;
    const href = mentionHref(run.mention, municipalityId);
    return (
      <RNText
        key={i}
        className="text-accent font-medium underline"
        onPress={href ? () => router.push(href as never) : undefined}
      >
        {run.text}
      </RNText>
    );
  });

  return <Text {...textProps}>{parts}</Text>;
}
