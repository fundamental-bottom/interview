import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { drainJobs } from '@/lib/jobs/runner';
import { sweepOnce } from '@/lib/jobs/sweeper';

const expertSample = readFileSync(
  path.join(__dirname, '..', 'sample-data', 'expert-call-raw.txt'),
  'utf8',
);

beforeEach(async () => {
  await prisma.calendarEvent.deleteMany();
});

async function createProcessingJob(startedAt: Date) {
  const event = await prisma.calendarEvent.create({
    data: {
      title: 'Sweeper test',
      meetingType: 'EXPERT_CALL',
      startTime: new Date('2026-06-01T13:00:00Z'),
      endTime: new Date('2026-06-01T14:00:00Z'),
      timezone: 'UTC',
    },
  });
  const raw = await prisma.rawTranscript.create({
    data: { eventId: event.id, content: expertSample },
  });
  return prisma.transcriptJob.create({
    data: { eventId: event.id, rawTranscriptId: raw.id, status: 'PROCESSING', startedAt, attempts: 1 },
  });
}

describe('sweepOnce (crash recovery)', () => {
  it('resets a stale PROCESSING job to PENDING so the runner can finish it', async () => {
    const job = await createProcessingJob(new Date(Date.now() - 2 * 60_000));

    const pending = await sweepOnce();
    expect(pending).toBe(1);

    const reset = await prisma.transcriptJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(reset.status).toBe('PENDING');
    expect(reset.startedAt).toBeNull();

    await drainJobs();
    const done = await prisma.transcriptJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(done.status).toBe('COMPLETED');
    expect(done.attempts).toBe(2); // original claim + re-claim after recovery
  });

  it('leaves a fresh PROCESSING job alone', async () => {
    const job = await createProcessingJob(new Date());

    const pending = await sweepOnce();
    expect(pending).toBe(0);

    const untouched = await prisma.transcriptJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(untouched.status).toBe('PROCESSING');
  });
});
