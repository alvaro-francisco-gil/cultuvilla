import { madridYear, resolveFiestaWindow, type FiestaBlock } from '@cultuvilla/shared/models';

/**
 * How far back a just-ended block is still picked up.
 *
 * A block is built once, on the first run after its window closes. The lookback
 * covers a scheduler outage without ever reaching back into last year's
 * fiestas — and the doc's deterministic id makes a second attempt a no-op
 * anyway.
 */
export const END_LOOKBACK_DAYS = 7;

/** Blocks of this village whose exact window closed inside the lookback. */
export function blocksJustEnded(
  fiestas: FiestaBlock[],
  now: Date,
  lookbackDays = END_LOOKBACK_DAYS,
): { block: FiestaBlock; year: number }[] {
  const floor = now.getTime() - lookbackDays * 24 * 60 * 60 * 1000;
  const out: { block: FiestaBlock; year: number }[] = [];
  for (const block of fiestas) {
    // A window can close in a different Madrid year than it opened (a block
    // straddling New Year), and the previous year is still in range early in
    // January — so both are checked rather than assuming today's year.
    for (const year of [madridYear(now), madridYear(now) - 1]) {
      const window = resolveFiestaWindow(block, year, { exactOnly: true });
      if (!window) continue;
      const ended = window.end.getTime();
      if (ended <= now.getTime() && ended >= floor) out.push({ block, year });
    }
  }
  return out;
}
