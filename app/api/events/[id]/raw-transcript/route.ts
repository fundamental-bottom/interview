import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { attachRawTranscriptSchema, type MeetingType } from '@/lib/types';
import { kickJobRunner } from '@/lib/jobs/runner';
import { jsonError, readJsonBody, zodErrorResponse } from '@/lib/api';
import { serializeJob } from '@/lib/serialize';

// Attach a raw transcript: pasted text, an uploaded .txt file's contents, or
// `{ sample: true }` to load the bundled sample for the event's meeting type.
// Attaching automatically enqueues the processing job — there is no separate
// "process" action.

const bodySchema = z.union([z.object({ sample: z.literal(true) }), attachRawTranscriptSchema]);

const SAMPLE_FILES: Record<MeetingType, string> = {
  EXPERT_CALL: 'expert-call-raw.txt',
  ROADSHOW: 'roadshow-raw.txt',
  WEEKLY_GROUP_CALL: 'weekly-group-call-raw.txt',
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = bodySchema.safeParse(await readJsonBody(req));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const event = await prisma.calendarEvent.findUnique({
    where: { id },
    include: { rawTranscript: { select: { id: true } } },
  });
  if (!event) return jsonError(404, 'Event not found');
  if (event.rawTranscript) {
    return jsonError(409, 'A raw transcript is already attached; raw transcripts are immutable');
  }

  let content: string;
  let fileName: string | undefined;
  if ('sample' in parsed.data) {
    fileName = SAMPLE_FILES[event.meetingType as MeetingType];
    content = await readFile(path.join(process.cwd(), 'sample-data', fileName), 'utf8');
  } else {
    content = parsed.data.text;
    fileName = parsed.data.fileName;
  }

  // Raw transcript + its processing job are created atomically (nested
  // write): a crash between the two can't leave a transcript with no job.
  const raw = await prisma.rawTranscript.create({
    data: { eventId: event.id, content, fileName, jobs: { create: { eventId: event.id } } },
    include: { jobs: true },
  });
  kickJobRunner();

  return NextResponse.json(
    { rawTranscriptId: raw.id, job: serializeJob(raw.jobs[0]) },
    { status: 201 },
  );
}
