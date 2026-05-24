import type { NewsReactionKind } from './NewsPostDataModel';

export interface NewsReactionData {
  postId: string;
  municipalityId: string;
  userId: string;
  kind: NewsReactionKind;
  createdAt: Date;
}

export function reactionDocId(postId: string, userId: string): string {
  return `${postId}_${userId}`;
}

export function buildNewsReactionData(input: NewsReactionData): NewsReactionData {
  return { ...input };
}
