import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ActiveJobError, enqueueProcessingJob } from '@/lib/jobs/runner';
import { jsonError } from '@/lib/api';
import { serializeJob } from '@/lib/serialize';

// Re-run the pipeline against the immutable raw transcript. The result is a
// NEW processed transcript version; history is never overwritten.

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await prisma.calendarEvent.findUnique({
    where: { id },
    include: { rawTranscript: { select: { id: true } } },
  });
  if (!event) return jsonError(404, 'Event not found');
  if (!event.rawTranscript) return jsonError(409, 'No raw transcript attached yet');

  try {
    const job = await enqueueProcessingJob(event.id, event.rawTranscript.id);
    return NextResponse.json({ job: serializeJob(job) }, { status: 201 });
  } catch (err) {
    if (err instanceof ActiveJobError) return jsonError(409, err.message);
    throw err;
  }
}
