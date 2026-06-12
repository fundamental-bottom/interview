import { prisma } from '@/lib/db';

/** The event-list projection shared by the home page and GET /api/events. */
export async function listEventSummaries() {
  const events = await prisma.calendarEvent.findMany({
    orderBy: { startTime: 'desc' },
    include: {
      rawTranscript: { select: { id: true } },
      jobs: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true } },
      _count: { select: { processedVersions: true } },
    },
  });

  return events.map((e) => ({
    id: e.id,
    title: e.title,
    meetingType: e.meetingType,
    startTime: e.startTime,
    endTime: e.endTime,
    timezone: e.timezone,
    status: e.status,
    hasRawTranscript: e.rawTranscript !== null,
    latestJobStatus: e.jobs[0]?.status ?? null,
    versionCount: e._count.processedVersions,
  }));
}
