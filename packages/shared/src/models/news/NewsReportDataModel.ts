export type NewsReportTargetType = 'comment';
export type NewsReportStatus = 'open' | 'dismissed' | 'actioned';

export interface NewsReportData {
  targetType: NewsReportTargetType;
  targetId: string;
  postId: string;
  municipalityId: string;
  reporterUserId: string;
  reason: string;
  createdAt: Date;
  status: NewsReportStatus;
  resolvedBy: string | null;
  resolvedAt: Date | null;
}

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
