import { z } from 'zod';

// ---------------------------------------------------------------------------
// Domain enums. SQLite has no native enums, so these are the single source of
// truth; every API boundary validates against them and the rest of the code
// works with the narrowed TypeScript unions.
// ---------------------------------------------------------------------------

export const MEETING_TYPES = ['EXPERT_CALL', 'ROADSHOW', 'WEEKLY_GROUP_CALL'] as const;
export type MeetingType = (typeof MEETING_TYPES)[number];

export const EVENT_STATUSES = ['SCHEDULED', 'COMPLETED', 'CANCELLED'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const JOB_STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const VERSION_SOURCES = ['PIPELINE', 'MANUAL_EDIT'] as const;
export type VersionSource = (typeof VERSION_SOURCES)[number];

// ---------------------------------------------------------------------------
// Processed transcript content.
//
// Segments are the cleaned utterances. The summary is a small structured
// document: per-meeting-type summarizers BUILD different documents, but they
// all emit the same block vocabulary, so storage and rendering are completely
// type-agnostic. Adding a meeting type touches neither.
// ---------------------------------------------------------------------------

export const segmentSchema = z.object({
  speaker: z.string().min(1),
  text: z.string().min(1),
  timestamp: z.string().optional(), // "HH:MM:SS" from the raw transcript, kept for reference
});
export type Segment = z.infer<typeof segmentSchema>;

export const summaryBlockSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('paragraph'), text: z.string() }),
  z.object({ kind: z.literal('bullets'), items: z.array(z.string()) }),
  z.object({
    kind: z.literal('qa'),
    pairs: z.array(z.object({ question: z.string(), answer: z.string() })),
  }),
  z.object({
    kind: z.literal('actionItems'),
    items: z.array(z.object({ description: z.string(), owner: z.string() })),
  }),
]);
export type SummaryBlock = z.infer<typeof summaryBlockSchema>;

export const summaryDocumentSchema = z.object({
  format: z.enum(MEETING_TYPES),
  sections: z.array(
    z.object({
      title: z.string(),
      blocks: z.array(summaryBlockSchema),
    }),
  ),
});
export type SummaryDocument = z.infer<typeof summaryDocumentSchema>;
export type SummarySection = SummaryDocument['sections'][number];

// ---------------------------------------------------------------------------
// API input schemas.
// ---------------------------------------------------------------------------

const isValidTimeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

// Times arrive as naive wall-clock strings ("2026-06-12T09:00") plus the IANA
// zone they should be interpreted in; conversion to UTC happens server-side
// (lib/time.ts) so the stored instant is unambiguous.
const naiveLocalTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'expected YYYY-MM-DDTHH:mm')
  // The regex only checks shape; reject impossible components ("T25:00") and
  // silent rollovers ("02-30" becoming March 2nd) via a UTC round-trip.
  .refine((s) => {
    const d = new Date(`${s}:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 16) === s;
  }, 'not a real calendar date/time');

export const createEventSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    meetingType: z.enum(MEETING_TYPES),
    startLocal: naiveLocalTime,
    endLocal: naiveLocalTime,
    timezone: z.string().refine(isValidTimeZone, 'unknown IANA timezone'),
    status: z.enum(EVENT_STATUSES).default('SCHEDULED'),
  })
  .refine((v) => v.endLocal > v.startLocal, {
    message: 'endTime must be after startTime',
    path: ['endLocal'],
  });
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const attachRawTranscriptSchema = z.object({
  text: z.string().min(1, 'transcript text is empty').max(1_000_000),
  fileName: z.string().max(255).optional(),
});

export const manualEditSchema = z.object({
  segments: z.array(segmentSchema).min(1),
});
