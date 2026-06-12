import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { serializeEventDetail } from '@/lib/serialize';
import { EventDetail } from '@/components/EventDetail';
import type { EventDetailView } from '@/components/api-types';

export const dynamic = 'force-dynamic';

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await prisma.calendarEvent.findUnique({
    where: { id },
    include: {
      rawTranscript: true,
      jobs: { orderBy: { createdAt: 'desc' } },
      processedVersions: { orderBy: { version: 'desc' } },
    },
  });
  if (!event) notFound();

  // Round-trip through JSON so the client component receives exactly the
  // wire shape its polling fetches will produce (dates as ISO strings).
  const initialData = JSON.parse(
    JSON.stringify(serializeEventDetail(event)),
  ) as EventDetailView;

  return <EventDetail eventId={id} initialData={initialData} />;
}
