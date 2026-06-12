import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { listEventSummaries } from '@/lib/events';
import { createEventSchema } from '@/lib/types';
import { zonedNaiveToUtc } from '@/lib/time';
import { readJsonBody, zodErrorResponse } from '@/lib/api';

export async function GET() {
  return NextResponse.json(await listEventSummaries());
}

export async function POST(req: Request) {
  const parsed = createEventSchema.safeParse(await readJsonBody(req));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const { title, meetingType, startLocal, endLocal, timezone, status } = parsed.data;
  const event = await prisma.calendarEvent.create({
    data: {
      title,
      meetingType,
      startTime: zonedNaiveToUtc(startLocal, timezone),
      endTime: zonedNaiveToUtc(endLocal, timezone),
      timezone,
      status,
    },
  });
  return NextResponse.json(event, { status: 201 });
}
