import { prisma } from '@/lib/db';
import { processRawTranscript } from '@/lib/transcript/pipeline';
import { FLAKY_MARKER } from '@/lib/transcript/parse';
import { isUniqueViolation, latestVersionNumber } from '@/lib/versions';
import type { MeetingType } from '@/lib/types';

// The async pipeline. Jobs are rows in TranscriptJob; all state transitions
// go through the database so nothing is fire-and-forget:
//
//   enqueue            -> PENDING
//   claim (atomic)     -> PROCESSING  (attempts += 1)
//   success            -> COMPLETED   (+ new ProcessedTranscriptVersion, same tx)
//   error              -> FAILED      (error message stored)
//   retry (user)       -> PENDING
//   stale PROCESSING   -> PENDING     (sweeper crash recovery, see sweeper.ts)
//
// Execution happens in-process: kickJobRunner() starts a single drain loop
// that claims PENDING jobs one at a time. The claim is a conditional update,
// so even if multiple loops raced (or a second process shared the DB), each
// job runs at most once per transition to PROCESSING.

const globalForRunner = globalThis as unknown as { __jobRunnerActive?: boolean };

const ACTIVE_STATUSES = ['PENDING', 'PROCESSING'];

/** Fixed artificial latency so the UI visibly shows PENDING -> PROCESSING. */
function processingDelayMs(): number {
  const raw = process.env.PROCESSING_DELAY_MS;
  return raw === undefined ? 1500 : Number(raw);
}

const sleep = (ms: number) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

export class ActiveJobError extends Error {
  constructor() {
    super('A processing job for this event is already pending or running');
    this.name = 'ActiveJobError';
  }
}

/** Create a PENDING job for the event's raw transcript and start the runner. */
export async function enqueueProcessingJob(eventId: string, rawTranscriptId: string) {
  const active = await prisma.transcriptJob.findFirst({
    where: { eventId, status: { in: ACTIVE_STATUSES } },
    select: { id: true },
  });
  if (active) throw new ActiveJobError();

  const job = await prisma.transcriptJob.create({
    data: { eventId, rawTranscriptId },
  });
  kickJobRunner();
  return job;
}

/**
 * FAILED -> PENDING. Returns false if the job doesn't exist or isn't FAILED;
 * throws ActiveJobError if another job for the same event is already active
 * (e.g. the user regenerated after the failure) — the one-active-job-per-event
 * invariant holds for retries too.
 */
export async function retryJob(jobId: string): Promise<boolean> {
  const job = await prisma.transcriptJob.findUnique({
    where: { id: jobId },
    select: { eventId: true },
  });
  if (!job) return false;

  const activeSibling = await prisma.transcriptJob.findFirst({
    where: { eventId: job.eventId, status: { in: ACTIVE_STATUSES }, NOT: { id: jobId } },
    select: { id: true },
  });
  if (activeSibling) throw new ActiveJobError();

  const updated = await prisma.transcriptJob.updateMany({
    where: { id: jobId, status: 'FAILED' },
    data: { status: 'PENDING', error: null, startedAt: null, finishedAt: null },
  });
  if (updated.count === 0) return false;
  kickJobRunner();
  return true;
}

/**
 * Start the drain loop unless one is already running. Returns immediately;
 * progress is observable through job rows.
 */
export function kickJobRunner(): void {
  if (globalForRunner.__jobRunnerActive) return;
  globalForRunner.__jobRunnerActive = true;
  void drainJobs()
    .catch((err) => console.error('[jobs] runner loop crashed:', err))
    .finally(() => {
      globalForRunner.__jobRunnerActive = false;
    });
}

/** Drain all PENDING jobs — used by the kick above and awaited directly by tests. */
export async function drainJobs(): Promise<void> {
  for (;;) {
    const jobId = await claimNextPendingJob();
    if (!jobId) return;
    await executeClaimedJob(jobId);
  }
}

async function claimNextPendingJob(): Promise<string | null> {
  for (;;) {
    const candidate = await prisma.transcriptJob.findFirst({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!candidate) return null;

    const claimed = await prisma.transcriptJob.updateMany({
      where: { id: candidate.id, status: 'PENDING' },
      data: { status: 'PROCESSING', startedAt: new Date(), attempts: { increment: 1 } },
    });
    if (claimed.count === 1) return candidate.id;
    // Someone else claimed it between the find and the update — look again.
  }
}

/** Never throws: any per-job error lands on the job row, not the drain loop. */
async function executeClaimedJob(jobId: string): Promise<void> {
  try {
    const job = await prisma.transcriptJob.findUniqueOrThrow({
      where: { id: jobId },
      include: { rawTranscript: true, event: true },
    });

    await sleep(processingDelayMs());

    // Deterministic failure injection for demoing retry: a transcript
    // containing [[FLAKY]] fails on its first attempt and succeeds after.
    if (job.rawTranscript.content.includes(FLAKY_MARKER) && job.attempts === 1) {
      throw new Error('Injected transient failure (transcript contains [[FLAKY]], first attempt)');
    }

    const result = processRawTranscript(
      job.rawTranscript.content,
      job.event.meetingType as MeetingType, // validated when the event was created
    );

    // The new version and the COMPLETED transition commit atomically (batch
    // transaction). The version number comes from a plain read: the claim
    // discipline makes concurrent writers for one event practically
    // impossible, and the unique (eventId, version) constraint plus one
    // retry covers the remainder.
    for (let attempt = 0; ; attempt++) {
      const version = (await latestVersionNumber(job.eventId)) + 1;
      try {
        await prisma.$transaction([
          prisma.processedTranscriptVersion.create({
            data: {
              eventId: job.eventId,
              version,
              segments: JSON.stringify(result.segments),
              summary: JSON.stringify(result.summary),
              source: 'PIPELINE',
              jobId: job.id,
            },
          }),
          prisma.transcriptJob.update({
            where: { id: job.id },
            data: { status: 'COMPLETED', finishedAt: new Date(), error: null },
          }),
        ]);
        return;
      } catch (err) {
        if (isUniqueViolation(err) && attempt < 2) continue;
        throw err;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      await prisma.transcriptJob.update({
        where: { id: jobId },
        data: { status: 'FAILED', finishedAt: new Date(), error: message },
      });
    } catch (updateErr) {
      // Best effort: the job stays PROCESSING and the sweeper's stale-reset
      // returns it to PENDING after the timeout.
      console.error(`[jobs] could not mark job ${jobId} FAILED:`, updateErr);
    }
  }
}
