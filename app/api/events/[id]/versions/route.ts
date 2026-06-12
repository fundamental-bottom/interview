import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { manualEditSchema, type MeetingType } from '@/lib/types';
import { createManualVersion, NothingToEditError } from '@/lib/versions';
import { jsonError, readJsonBody, zodErrorResponse } from '@/lib/api';
import { serializeVersion } from '@/lib/serialize';

// Manual edit: the user submits corrected segments, which become a NEW
// version (source = MANUAL_EDIT) — history is never overwritten.

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = manualEditSchema.safeParse(await readJsonBody(req));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const event = await prisma.calendarEvent.findUnique({ where: { id } });
  if (!event) return jsonError(404, 'Event not found');

  try {
    const version = await createManualVersion(
      id,
      event.meetingType as MeetingType,
      parsed.data.segments,
    );
    return NextResponse.json(serializeVersion(version), { status: 201 });
  } catch (err) {
    if (err instanceof NothingToEditError) return jsonError(409, err.message);
    throw err;
  }
}
