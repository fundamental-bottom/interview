import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import {
  ActiveJobError,
  drainJobs,
  enqueueProcessingJob,
  retryJob,
} from '@/lib/jobs/runner';
import { createManualVersion, NothingToEditError } from '@/lib/versions';
import type { MeetingType } from '@/lib/types';

const expertSample = readFileSync(
  path.join(__dirname, '..', 'sample-data', 'expert-call-raw.txt'),
  'utf8',
);

async function createEventWithRaw(content: string, meetingType: MeetingType = 'EXPERT_CALL') {
  const event = await prisma.calendarEvent.create({
    data: {
      title: 'Test event',
      meetingType,
      startTime: new Date('2026-06-01T13:00:00Z'),
      endTime: new Date('2026-06-01T14:00:00Z'),
      timezone: 'UTC',
    },
  });
  const raw = await prisma.rawTranscript.create({
    data: { eventId: event.id, content },
  });
  return { event, raw };
}

async function waitForJob(jobId: string, statuses: string[], timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const job = await prisma.transcriptJob.findUniqueOrThrow({ where: { id: jobId } });
    if (statuses.includes(job.status)) return job;
    if (Date.now() > deadline) throw new Error(`job stuck in ${job.status}`);
    await new Promise((r) => setTimeout(r, 25));
  }
}

beforeEach(async () => {
  await prisma.calendarEvent.deleteMany(); // cascades to transcripts, versions, jobs
});

describe('job lifecycle', () => {
  it('processes an enqueued job to COMPLETED and writes version 1', async () => {
    const { event, raw } = await createEventWithRaw(expertSample);
    const job = await enqueueProcessingJob(event.id, raw.id);
    expect(job.status).toBe('PENDING');

    const done = await waitForJob(job.id, ['COMPLETED', 'FAILED']);
    expect(done.status).toBe('COMPLETED');
    expect(done.attempts).toBe(1);
    expect(done.startedAt).not.toBeNull();
    expect(done.finishedAt).not.toBeNull();

    const versions = await prisma.processedTranscriptVersion.findMany({
      where: { eventId: event.id },
    });
    expect(versions).toHaveLength(1);
    expect(versions[0].version).toBe(1);
    expect(versions[0].source).toBe('PIPELINE');
    expect(versions[0].jobId).toBe(job.id);
    expect(JSON.parse(versions[0].segments).length).toBeGreaterThan(0);
  });

  it('refuses a second job while one is active', async () => {
    const { event, raw } = await createEventWithRaw(expertSample);
    // Insert a PENDING job directly so the runner isn't racing the assertion.
    await prisma.transcriptJob.create({ data: { eventId: event.id, rawTranscriptId: raw.id } });
    await expect(enqueueProcessingJob(event.id, raw.id)).rejects.toThrow(ActiveJobError);
  });

  it('marks unparseable transcripts FAILED with the parse error preserved', async () => {
    const { event, raw } = await createEventWithRaw('no speaker lines here\nat all');
    const job = await enqueueProcessingJob(event.id, raw.id);

    const done = await waitForJob(job.id, ['COMPLETED', 'FAILED']);
    expect(done.status).toBe('FAILED');
    expect(done.error).toMatch(/No speaker utterances found/);
    expect(await prisma.processedTranscriptVersion.count({ where: { eventId: event.id } })).toBe(0);
  });

  it('a [[FLAKY]] transcript fails first, then a retry succeeds', async () => {
    const { event, raw } = await createEventWithRaw(`[[FLAKY]]\n${expertSample}`);
    const job = await enqueueProcessingJob(event.id, raw.id);

    const failed = await waitForJob(job.id, ['COMPLETED', 'FAILED']);
    expect(failed.status).toBe('FAILED');
    expect(failed.attempts).toBe(1);
    expect(failed.error).toMatch(/Injected transient failure/);

    expect(await retryJob(job.id)).toBe(true);
    const done = await waitForJob(job.id, ['COMPLETED', 'FAILED']);
    expect(done.status).toBe('COMPLETED');
    expect(done.attempts).toBe(2);

    const versions = await prisma.processedTranscriptVersion.findMany({
      where: { eventId: event.id },
    });
    expect(versions).toHaveLength(1);
  });

  it('only FAILED jobs can be retried', async () => {
    const { event, raw } = await createEventWithRaw(expertSample);
    const job = await enqueueProcessingJob(event.id, raw.id);
    await waitForJob(job.id, ['COMPLETED']);
    expect(await retryJob(job.id)).toBe(false);
  });

  it('retry refuses while another job for the event is active', async () => {
    const { event, raw } = await createEventWithRaw(expertSample);
    const failed = await prisma.transcriptJob.create({
      data: { eventId: event.id, rawTranscriptId: raw.id, status: 'FAILED', attempts: 1 },
    });
    // PROCESSING (not PENDING) so a background drain loop can't race the assertion.
    await prisma.transcriptJob.create({
      data: { eventId: event.id, rawTranscriptId: raw.id, status: 'PROCESSING', startedAt: new Date() },
    });
    await expect(retryJob(failed.id)).rejects.toThrow(ActiveJobError);
  });

  it('claims are atomic: concurrent drains process a job exactly once', async () => {
    const { event, raw } = await createEventWithRaw(expertSample);
    const job = await prisma.transcriptJob.create({
      data: { eventId: event.id, rawTranscriptId: raw.id },
    });

    await Promise.all([drainJobs(), drainJobs(), drainJobs()]);

    const done = await prisma.transcriptJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(done.status).toBe('COMPLETED');
    expect(done.attempts).toBe(1);
    expect(await prisma.processedTranscriptVersion.count({ where: { eventId: event.id } })).toBe(1);
  });
});

describe('processed transcript versioning', () => {
  it('regenerating appends a new version instead of overwriting', async () => {
    const { event, raw } = await createEventWithRaw(expertSample);
    const first = await enqueueProcessingJob(event.id, raw.id);
    await waitForJob(first.id, ['COMPLETED']);

    const second = await enqueueProcessingJob(event.id, raw.id);
    await waitForJob(second.id, ['COMPLETED']);

    const versions = await prisma.processedTranscriptVersion.findMany({
      where: { eventId: event.id },
      orderBy: { version: 'asc' },
    });
    expect(versions.map((v) => v.version)).toEqual([1, 2]);
  });

  it('manual edits create a MANUAL_EDIT version with a re-derived summary', async () => {
    const { event, raw } = await createEventWithRaw(expertSample);
    const job = await enqueueProcessingJob(event.id, raw.id);
    await waitForJob(job.id, ['COMPLETED']);

    const edited = [
      { speaker: 'Moderator', text: 'How do you see adoption?' },
      { speaker: 'Expert', text: 'Adoption reaches 90 percent next year.' },
    ];
    const version = await createManualVersion(event.id, 'EXPERT_CALL', edited);
    expect(version.version).toBe(2);
    expect(version.source).toBe('MANUAL_EDIT');

    const summary = JSON.parse(version.summary);
    expect(summary.format).toBe('EXPERT_CALL');
    expect(JSON.stringify(summary)).toMatch(/90 percent/);
  });

  it('rejects a manual edit when no version exists yet', async () => {
    const { event } = await createEventWithRaw(expertSample);
    await expect(
      createManualVersion(event.id, 'EXPERT_CALL', [{ speaker: 'A', text: 'hi' }]),
    ).rejects.toThrow(NothingToEditError);
  });
});
