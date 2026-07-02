import { Fragment } from 'react';
import { Text as RNText } from 'react-native';
import { router } from 'expo-router';
import { Text } from '../primitives';
import type { TextProps } from '../primitives/Text';
import { mentionHref } from '../../lib/newsMentions';
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

  const sorted = [...mentions].sort((a, b) => a.offset - b.offset);
  const parts: React.ReactNode[] = [];
  let cursor = 0;

  sorted.forEach((m, i) => {
    if (m.offset < cursor || m.offset + m.length > text.length || m.length <= 0) return;
    if (m.offset > cursor) {
      parts.push(<Fragment key={`t${cursor}`}>{text.slice(cursor, m.offset)}</Fragment>);
    }
    const label = text.slice(m.offset, m.offset + m.length) || m.label;
    const href = mentionHref(m, municipalityId);
    parts.push(
      <RNText
        key={`m${i}`}
        className="text-accent font-medium underline"
        onPress={href ? () => router.push(href as never) : undefined}
      >
        {label}
      </RNText>,
    );
    cursor = m.offset + m.length;
  });

  if (cursor < text.length) {
    parts.push(<Fragment key={`t${cursor}`}>{text.slice(cursor)}</Fragment>);
  }

  return <Text {...textProps}>{parts}</Text>;
}
