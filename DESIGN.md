# Design notes

## Data model

Four entities (Prisma + SQLite, `prisma/schema.prisma`):

- **CalendarEvent** — the anchor. `title`, `meetingType`, `startTime`/`endTime` stored as UTC instants plus the IANA `timezone` they were entered in (input is wall-clock time + zone, converted server-side with a DST-correct double-offset lookup, `lib/time.ts`), `status`.
- **RawTranscript** — 1:1 with an event (unique `eventId`). Immutable by construction: no update path exists, and a second attach returns 409.
- **ProcessedTranscriptVersion** — append-only versions per event (`@@unique(eventId, version)`). Holds `segments` (ordered `{speaker, text, timestamp}`) and a structured `summary`, both JSON. `source` distinguishes `PIPELINE` from `MANUAL_EDIT`; `jobId` links a pipeline version to the job that produced it. "Current" = highest version; everything else is history.
- **TranscriptJob** — explicit pipeline state: `PENDING → PROCESSING → COMPLETED | FAILED`, with `attempts`, `error`, and timing fields.

SQLite has no enums, so enum-like columns are strings validated with zod at every API boundary (`lib/types.ts` is the single source of truth for the unions).

## Async pipeline

Attaching a raw transcript creates the job and returns immediately; nothing is fire-and-forget because **every transition is a database row update**:

- An in-process runner (`lib/jobs/runner.ts`) drains PENDING jobs. Claims are atomic conditional updates (`UPDATE ... WHERE status = 'PENDING'`), so concurrent runners execute a job at most once — covered by a test that races three drains.
- The new version + the COMPLETED transition commit in one batch transaction; failures store the error message on the job, and a per-job error can never kill the drain loop. There are deliberately **no interactive transactions**: with one SQLite connection behind the driver adapter, an open interactive transaction can swallow interleaved writes on rollback, so writers use single statements / batch transactions with the `(eventId, version)` unique constraint as the race backstop.
- A sweeper (`lib/jobs/sweeper.ts`, started once per server via `instrumentation.ts`) covers the two crash modes the per-request kick can't: PENDING jobs left behind by a restart, and PROCESSING rows orphaned by a mid-job crash (reset to PENDING after 60s).
- **Retry** is user-triggered (FAILED → PENDING, attempts preserved). For demos, a transcript containing `[[FLAKY]]` deterministically fails its first attempt and succeeds on retry; a transcript with no parseable speaker lines fails permanently with a clear error.

Trade-off, made consciously: the queue is the database and the worker lives in the web process. For a single-user local app this gives full observability with zero infrastructure; the claim discipline means moving to a real worker (BullMQ, pg-boss, or a cron-driven runner) changes only who calls `drainJobs()`.

## Per-meeting-type formats

Processing is parse → clean → summarize (`lib/transcript/`). The split that keeps types cheap to add:

- Summarizers are a `Record<MeetingType, Summarizer>` registry (`lib/transcript/summarize/index.ts`). Each one *builds a different document* (Q&A pairs, roadshow sections, minutes with owners) but emits the same small block vocabulary (`paragraph | bullets | qa | actionItems`).
- Storage, API, and rendering only know that vocabulary, so they are type-agnostic.

**Adding a fourth meeting type** = add the value to `MEETING_TYPES` (the `Record` then fails to compile until you register a summarizer — the gap can't ship silently), write one summarizer file, and map its sample/label. No schema change, no API change, no UI change. A new *block kind* (e.g. a table) would be one renderer case + the zod union.

The processor is deterministic and rule-based (filler/stutter removal, role inference by word count, question-cue extraction, action-item/owner matching by content-word overlap). An LLM-backed processor would replace one function (`processRawTranscript`) behind the same signature.

## Tests (63)

The things that would actually break: parsing edge cases (near-miss speaker lines, hyphenated fillers, filler-only turns), cleaner idempotence and meaning preservation, all three summarizers against the real sample files (with count and absence assertions, not just substring presence), the full job lifecycle (success, parse failure, flaky-then-retry, atomic claims under concurrency, the one-active-job guard for enqueue *and* retry), sweeper crash recovery, version monotonicity for regenerate + manual edit, DST boundary conversion (including characterization of nonexistent/ambiguous wall-clock times), input validation (impossible calendar dates are 400s, not 500s), and the HTTP contract itself — the route handlers are called directly as functions for the attach→process→edit→retry flow and its 4xx cases.

## What I'd build next

1. **SSE or polling-with-ETag** instead of the 2.5s client poll for job status.
2. **Real queue + LLM processor** behind the existing interfaces (worker process, provider key via env).
3. **Segment-level diffing** between versions, and an explicit "restore version N" action.
4. **Full-text search** across processed transcripts (SQLite FTS5 would do locally).
5. Pagination, auth, and multi-tenancy — consciously skipped: single-user was in scope, and none of them change the core design.
