import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { jsonError } from '@/lib/api';
import { serializeEventDetail } from '@/lib/serialize';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await prisma.calendarEvent.findUnique({
    where: { id },
    include: {
      rawTranscript: true,
      jobs: { orderBy: { createdAt: 'desc' } },
      processedVersions: { orderBy: { version: 'desc' } },
    },
  });
  if (!event) return jsonError(404, 'Event not found');
  return NextResponse.json(serializeEventDetail(event));
}
