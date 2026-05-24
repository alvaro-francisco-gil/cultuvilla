export interface NewsCommentData {
  postId: string;
  municipalityId: string;
  authorUserId: string;
  body: string;
  createdAt: Date;
  hidden: boolean;
}

export interface NewsCommentDataInput {
  postId: string;
  municipalityId: string;
  authorUserId: string;
  body: string;
  createdAt: Date;
  hidden?: boolean;
}

export function buildNewsCommentData(input: NewsCommentDataInput): NewsCommentData {
  return {
    postId: input.postId,
    municipalityId: input.municipalityId,
    authorUserId: input.authorUserId,
    body: input.body,
    createdAt: input.createdAt,
    hidden: input.hidden ?? false,
  };
}
