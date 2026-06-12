// Shapes Prisma rows into API responses, parsing the JSON columns of
// processed transcript versions back into structured data.

import type {
  CalendarEvent,
  ProcessedTranscriptVersion,
  RawTranscript,
  TranscriptJob,
} from '@/generated/prisma/client';
import type { Segment, SummaryDocument } from '@/lib/types';

export function serializeJob(job: TranscriptJob) {
  return {
    id: job.id,
    status: job.status,
    attempts: job.attempts,
    error: job.error,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  };
}

export function serializeVersion(v: ProcessedTranscriptVersion) {
  return {
    id: v.id,
    version: v.version,
    source: v.source,
    jobId: v.jobId,
    createdAt: v.createdAt,
    segments: JSON.parse(v.segments) as Segment[],
    summary: JSON.parse(v.summary) as SummaryDocument,
  };
}

export function serializeEventDetail(
  event: CalendarEvent & {
    rawTranscript: RawTranscript | null;
    jobs: TranscriptJob[];
    processedVersions: ProcessedTranscriptVersion[];
  },
) {
  return {
    id: event.id,
    title: event.title,
    meetingType: event.meetingType,
    startTime: event.startTime,
    endTime: event.endTime,
    timezone: event.timezone,
    status: event.status,
    createdAt: event.createdAt,
    rawTranscript: event.rawTranscript
      ? {
          id: event.rawTranscript.id,
          content: event.rawTranscript.content,
          fileName: event.rawTranscript.fileName,
          createdAt: event.rawTranscript.createdAt,
        }
      : null,
    latestJob: event.jobs[0] ? serializeJob(event.jobs[0]) : null,
    versions: event.processedVersions.map(serializeVersion),
  };
}

export type EventDetail = ReturnType<typeof serializeEventDetail>;
export type JobView = ReturnType<typeof serializeJob>;
export type VersionView = ReturnType<typeof serializeVersion>;
