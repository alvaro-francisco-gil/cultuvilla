import { z } from 'zod';
import { DayKeySchema, madridDayRange, type FiestaBlock } from '../models/municipality/FiestaBlockModel';
import type { WrappedBlock } from '../models/wrapped/WrappedDataModel';

/**
 * What an admin asks for when creating a year's Wrapped: the days each fiesta
 * block ran this year, and the one range everything is counted over.
 *
 * Days cross the wire as `YYYY-MM-DD` Madrid calendar days and are resolved to
 * instants only on the server (`madridDayRange`), so a phone in another time
 * zone cannot move a fiesta by a day.
 */
const DaySpanSchema = z.object({ startDay: DayKeySchema, endDay: DayKeySchema });

export const WrappedRequestSchema = z.object({
  municipalityId: z.string().min(1),
  year: z.number().int().min(2000).max(2100),
  blocks: z.array(DaySpanSchema.extend({ blockId: z.string().min(1) })).min(1),
  range: DaySpanSchema,
});
export type WrappedRequest = z.infer<typeof WrappedRequestSchema>;

export type WrappedRequestProblem =
  | 'malformed'
  | 'unknown-block'
  | 'duplicate-block'
  | 'outside-year'
  | 'ends-before-start'
  | 'range-in-future'
  | 'range-misses-block';

export type ResolvedWrappedRequest =
  | { ok: true; request: WrappedRequest; blocks: WrappedBlock[]; range: { start: Date; end: Date } }
  | { ok: false; problem: WrappedRequestProblem };

/**
 * Check a request against the village's declared fiestas and today's Madrid
 * day, and resolve it into the blocks and range a Wrapped is built from.
 *
 * - every block must be one the village declared, at most once;
 * - every day must fall in the requested year, and no span may end before it starts;
 * - the range may not end after today — a Wrapped made mid-fiestas would be
 *   shared missing its last days;
 * - the range must contain every block, or the cover would show dates whose
 *   events were never counted.
 */
export function resolveWrappedRequest(
  raw: unknown,
  fiestas: FiestaBlock[],
  today: string,
): ResolvedWrappedRequest {
  const parsed = WrappedRequestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, problem: 'malformed' };
  const request = parsed.data;
  const yearPrefix = `${String(request.year)}-`;
  const spans = [request.range, ...request.blocks];

  const byId = new Map(fiestas.map((b) => [b.id, b]));
  if (request.blocks.some((b) => !byId.has(b.blockId))) return { ok: false, problem: 'unknown-block' };
  if (new Set(request.blocks.map((b) => b.blockId)).size !== request.blocks.length) {
    return { ok: false, problem: 'duplicate-block' };
  }
  // Day keys are zero-padded, so string order is calendar order.
  if (spans.some((s) => !s.startDay.startsWith(yearPrefix) || !s.endDay.startsWith(yearPrefix))) {
    return { ok: false, problem: 'outside-year' };
  }
  if (spans.some((s) => s.endDay < s.startDay)) return { ok: false, problem: 'ends-before-start' };
  if (request.range.endDay > today) return { ok: false, problem: 'range-in-future' };
  if (request.blocks.some((b) => b.startDay < request.range.startDay || b.endDay > request.range.endDay)) {
    return { ok: false, problem: 'range-misses-block' };
  }

  const blocks = request.blocks
    .map((b) => ({ blockId: b.blockId, name: byId.get(b.blockId)?.name ?? '', ...madridDayRange(b.startDay, b.endDay) }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  return { ok: true, request, blocks, range: madridDayRange(request.range.startDay, request.range.endDay) };
}

/** The smallest range containing every span — the default an admin starts from. */
export function coveringRange(spans: { startDay: string; endDay: string }[]): { startDay: string; endDay: string } | null {
  if (spans.length === 0) return null;
  return {
    startDay: spans.map((s) => s.startDay).reduce((a, b) => (b < a ? b : a)),
    endDay: spans.map((s) => s.endDay).reduce((a, b) => (b > a ? b : a)),
  };
}
