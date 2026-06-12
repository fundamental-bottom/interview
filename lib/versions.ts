import { prisma } from '@/lib/db';
import { Prisma } from '@/generated/prisma/client';
import { summarizeSegments } from '@/lib/transcript/pipeline';
import type { MeetingType, Segment } from '@/lib/types';

// Version numbers are dense integers per event. Writers compute latest + 1
// with a plain read and rely on the @@unique(eventId, version) constraint to
// catch the (single-user, practically unreachable) race, retrying once on
// conflict. This deliberately avoids interactive transactions: with one
// SQLite connection behind the driver adapter, an open interactive
// transaction can swallow unrelated concurrent writes if it rolls back.

export async function latestVersionNumber(eventId: string): Promise<number> {
  const latest = await prisma.processedTranscriptVersion.findFirst({
    where: { eventId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  return latest?.version ?? 0;
}

export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

export class NothingToEditError extends Error {
  constructor() {
    super('Nothing to edit yet — no processed transcript exists');
    this.name = 'NothingToEditError';
  }
}

/**
 * A manual edit becomes a new MANUAL_EDIT version. The summary is re-derived
 * from the edited segments with the event's summarizer so it never drifts
 * from the text it claims to summarize.
 */
export async function createManualVersion(
  eventId: string,
  meetingType: MeetingType,
  segments: Segment[],
) {
  const summary = summarizeSegments(segments, meetingType);
  for (let attempt = 0; ; attempt++) {
    const latest = await latestVersionNumber(eventId);
    if (latest === 0) throw new NothingToEditError();
    try {
      return await prisma.processedTranscriptVersion.create({
        data: {
          eventId,
          version: latest + 1,
          segments: JSON.stringify(segments),
          summary: JSON.stringify(summary),
          source: 'MANUAL_EDIT',
        },
      });
    } catch (err) {
      if (isUniqueViolation(err) && attempt < 2) continue;
      throw err;
    }
  }
}
