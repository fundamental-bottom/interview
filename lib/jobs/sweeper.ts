import { prisma } from '@/lib/db';
import { kickJobRunner } from './runner';

// Recovery loop, started once per server process from instrumentation.ts.
//
// It exists for two failure modes the in-request kick can't cover:
//  - the server restarted while jobs were PENDING (e.g. seeded data, or a
//    kick that never ran) — they'd otherwise sit forever;
//  - the server died mid-job, leaving a PROCESSING row with no worker. Rows
//    stuck in PROCESSING longer than STALE_PROCESSING_MS go back to PENDING.

const SWEEP_INTERVAL_MS = 3_000;
const STALE_PROCESSING_MS = 60_000;

const globalForSweeper = globalThis as unknown as { __jobSweeper?: ReturnType<typeof setInterval> };

/**
 * One sweep pass: reset stale PROCESSING rows, report how many PENDING jobs
 * are waiting. Pure database work (no scheduling) so tests can drive it.
 */
export async function sweepOnce(): Promise<number> {
  const reset = await prisma.transcriptJob.updateMany({
    where: { status: 'PROCESSING', startedAt: { lt: new Date(Date.now() - STALE_PROCESSING_MS) } },
    data: { status: 'PENDING', startedAt: null },
  });
  if (reset.count > 0) {
    console.warn(`[jobs] reset ${reset.count} stale PROCESSING job(s) to PENDING`);
  }
  return prisma.transcriptJob.count({ where: { status: 'PENDING' } });
}

export function startJobSweeper(): void {
  if (globalForSweeper.__jobSweeper) return;

  const sweep = async () => {
    try {
      const pending = await sweepOnce();
      if (pending > 0) kickJobRunner();
    } catch (err) {
      console.error('[jobs] sweep failed:', err);
    }
  };

  globalForSweeper.__jobSweeper = setInterval(sweep, SWEEP_INTERVAL_MS);
  globalForSweeper.__jobSweeper.unref?.();
  void sweep(); // run once at startup so restarts recover immediately
}
