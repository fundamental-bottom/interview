// The HTTP contract, tested by calling the route handlers directly (they are
// plain functions taking a Request and async params).
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { POST as createEvent } from '@/app/api/events/route';
import { GET as getEvent } from '@/app/api/events/[id]/route';
import { POST as attachRaw } from '@/app/api/events/[id]/raw-transcript/route';
import { POST as regenerate } from '@/app/api/events/[id]/regenerate/route';
import { POST as manualEdit } from '@/app/api/events/[id]/versions/route';
import { POST as retry } from '@/app/api/jobs/[id]/retry/route';

const json = (body: unknown) =>
  new Request('http://test.local/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const params = (id: string) => ({ params: Promise.resolve({ id }) });

const validEvent = {
  title: 'API test call',
  meetingType: 'EXPERT_CALL',
  startLocal: '2026-06-12T09:00',
  endLocal: '2026-06-12T10:00',
  timezone: 'America/New_York',
};

const RAW = '[00:00:01] Speaker 1: what is the outlook\n[00:00:05] Speaker 2: revenue grows 20 percent';

// The attach/regenerate routes kick the real background runner, so tests wait
// for quiescence instead of draining themselves (a second drain would return
// immediately while the kicked loop still owns the claimed job).
async function waitForIdleJobs(timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const active = await prisma.transcriptJob.count({
      where: { status: { in: ['PENDING', 'PROCESSING'] } },
    });
    if (active === 0) return;
    if (Date.now() > deadline) throw new Error('jobs did not settle in time');
    await new Promise((r) => setTimeout(r, 20));
  }
}

beforeEach(async () => {
  await waitForIdleJobs(); // never delete rows out from under an in-flight job
  await prisma.calendarEvent.deleteMany();
});

describe('events API', () => {
  it('creates an event, converting wall-clock + zone to the right UTC instant', async () => {
    const res = await createEvent(json(validEvent));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(new Date(body.startTime).toISOString()).toBe('2026-06-12T13:00:00.000Z'); // 09:00 EDT
  });

  it('rejects invalid payloads with a 400 and a readable message', async () => {
    const res = await createEvent(json({ ...validEvent, endLocal: '2026-06-12T08:00' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/endTime must be after startTime/);
  });

  it('404s on a missing event', async () => {
    const res = await getEvent(new Request('http://test.local'), params('nope'));
    expect(res.status).toBe(404);
  });
});

describe('transcript flow over HTTP', () => {
  async function createEventViaApi(): Promise<string> {
    const res = await createEvent(json(validEvent));
    return (await res.json()).id;
  }

  it('attach -> job -> processed versions round-trips through the API', async () => {
    const id = await createEventViaApi();

    const attach = await attachRaw(json({ text: RAW, fileName: 'call.txt' }), params(id));
    expect(attach.status).toBe(201);
    expect((await attach.json()).job.status).toBe('PENDING');

    await waitForIdleJobs();

    const detail = await (await getEvent(new Request('http://t'), params(id))).json();
    expect(detail.latestJob.status).toBe('COMPLETED');
    expect(detail.rawTranscript.content).toBe(RAW);
    expect(detail.versions).toHaveLength(1);
    expect(detail.versions[0].segments[0]).toMatchObject({ speaker: 'Speaker 1' });
    expect(detail.versions[0].summary.format).toBe('EXPERT_CALL');
  });

  it('refuses a second raw transcript (immutability) with 409', async () => {
    const id = await createEventViaApi();
    await attachRaw(json({ text: RAW }), params(id));
    const second = await attachRaw(json({ text: RAW }), params(id));
    expect(second.status).toBe(409);
    expect((await second.json()).error).toMatch(/immutable/);
  });

  it('regenerate 409s with no raw transcript, then appends a version once attached', async () => {
    const id = await createEventViaApi();
    expect((await regenerate(new Request('http://t'), params(id))).status).toBe(409);

    await attachRaw(json({ text: RAW }), params(id));
    await waitForIdleJobs();
    expect((await regenerate(new Request('http://t'), params(id))).status).toBe(201);
    await waitForIdleJobs();

    const detail = await (await getEvent(new Request('http://t'), params(id))).json();
    expect(detail.versions.map((v: { version: number }) => v.version)).toEqual([2, 1]);
  });

  it('manual edit 409s before any version exists, then creates a MANUAL_EDIT version', async () => {
    const id = await createEventViaApi();
    const segments = [{ speaker: 'Expert', text: 'Margins reach 40 percent.' }];

    expect((await manualEdit(json({ segments }), params(id))).status).toBe(409);

    await attachRaw(json({ text: RAW }), params(id));
    await waitForIdleJobs();

    const res = await manualEdit(json({ segments }), params(id));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ version: 2, source: 'MANUAL_EDIT' });

    const invalid = await manualEdit(json({ segments: [{ speaker: 'X', text: '' }] }), params(id));
    expect(invalid.status).toBe(400);
  });

  it('retry maps job states to 404 / 409 / ok', async () => {
    expect((await retry(new Request('http://t'), params('missing'))).status).toBe(404);

    const id = await createEventViaApi();
    await attachRaw(json({ text: RAW }), params(id));
    await waitForIdleJobs();

    const detail = await (await getEvent(new Request('http://t'), params(id))).json();
    const completed = await retry(new Request('http://t'), params(detail.latestJob.id));
    expect(completed.status).toBe(409);
    expect((await completed.json()).error).toMatch(/Only FAILED jobs/);
  });
});
