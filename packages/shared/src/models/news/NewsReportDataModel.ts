import { z } from 'zod';

export const NewsReportTargetTypeSchema = z.enum(['comment']);
export type NewsReportTargetType = z.infer<typeof NewsReportTargetTypeSchema>;

export const NewsReportStatusSchema = z.enum(['open', 'dismissed', 'actioned']);
export type NewsReportStatus = z.infer<typeof NewsReportStatusSchema>;

export const NewsReportDataSchema = z.object({
  targetType: NewsReportTargetTypeSchema,
  targetId: z.string(),
  postId: z.string(),
  municipalityId: z.string(),
  reporterUserId: z.string(),
  reason: z.string(),
  createdAt: z.date(),
  status: NewsReportStatusSchema,
  resolvedBy: z.string().nullable(),
  resolvedAt: z.date().nullable(),
});
export type NewsReportData = z.infer<typeof NewsReportDataSchema>;

export interface NewsReportDataInput {
  targetType: NewsReportTargetType;
  targetId: string;
  postId: string;
  municipalityId: string;
  reporterUserId: string;
  reason: string;
  createdAt: Date;
  status?: NewsReportStatus;
  resolvedBy?: string | null;
  resolvedAt?: Date | null;
}

export function buildNewsReportData(input: NewsReportDataInput): NewsReportData {
  return {
    targetType: input.targetType,
    targetId: input.targetId,
    postId: input.postId,
    municipalityId: input.municipalityId,
    reporterUserId: input.reporterUserId,
    reason: input.reason,
    createdAt: input.createdAt,
    status: input.status ?? 'open',
    resolvedBy: input.resolvedBy ?? null,
    resolvedAt: input.resolvedAt ?? null,
  };
}
