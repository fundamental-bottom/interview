# Funda Take-Home: Meeting Transcript Platform

## Quick start (solution)

```bash
npm install
npm run setup   # prisma generate + migrate + seed (3 demo events)
npm run dev     # http://localhost:3000
```

`npm test` runs the suite (63 tests). See [DESIGN.md](DESIGN.md) for the data model, pipeline, and trade-offs.

Demo walkthrough: open a seeded event → **Load sample for this meeting type** (or paste/upload a `.txt`) → watch the job go `PENDING → PROCESSING → COMPLETED` → the processed transcript appears with the per-type summary. **Regenerate** or **Edit segments** to create new versions. To see the failure path, paste a sample with a line containing `[[FLAKY]]` added — the job fails on the first attempt and succeeds on **Retry** (a transcript with no `[HH:MM:SS] Speaker N:` lines fails permanently with a clear error).

---

*Original assignment below.*

At Funda we record many kinds of investor meetings — expert calls, company roadshows, internal weekly group calls — and turn their recordings into clean, structured, searchable transcripts. This assignment asks you to build a miniature version of that system.

**Timebox: aim for 4–6 focused hours.** We'd rather see a well-designed core than a feature-complete rush job. If you run out of time, write down what you'd do next in your design notes.

## What you build

A small web application (any stack you like — see [Constraints](#constraints)) with the following four capabilities.

### 1. Calendar events

Users can create and list **calendar events** representing upcoming or past meetings. An event has at least:

- `title`
- `meetingType` — one of `EXPERT_CALL` | `ROADSHOW` | `WEEKLY_GROUP_CALL`
- `startTime` / `endTime` (timezone-aware)
- `status` — e.g. `SCHEDULED` | `COMPLETED` | `CANCELLED`

A calendar event is the anchor everything else hangs off: transcripts belong to an event.

### 2. Two types of transcripts

Each event can hold two kinds of transcript, and the distinction must be visible in your data model:

1. **Raw transcript** — what comes out of speech recognition. Plain text with rough speaker labels, filler words, mis-recognitions. A user attaches it to an event by pasting text or uploading a `.txt` file (samples provided in [`sample-data/`](sample-data/)).
2. **Processed transcript** — the cleaned, structured version: an ordered list of segments `{ speaker, text }`, plus a generated **summary**. This is what end users actually read.

The raw transcript is immutable once attached. The processed transcript should be **versioned**: regenerating or manually editing it creates a new version rather than overwriting history (a simple version integer + history list is enough).

### 3. Automatic transcript generation

When a raw transcript is attached to an event, the system **automatically** produces the processed transcript — the user does not click "process".

- This must run as an **asynchronous job**, not inline in the upload request. Model the job explicitly: `pending → processing → completed | failed`, with the status visible in the UI and a way to retry a failed job.
- For the actual text processing you may either:
  - call a real LLM API (any provider; keep your key out of the repo), **or**
  - write a deterministic mock processor (e.g. rule-based speaker splitting + a template summary).
  
  We are evaluating the **pipeline design**, not the quality of the language model. A clean mock is worth full marks.

### 4. Different formats per meeting type

The processed transcript's **summary format depends on the meeting type**:

| Meeting type | Summary format |
|---|---|
| `EXPERT_CALL` | Q&A pairs (question asked → expert's answer) + a "Key takeaways" list |
| `ROADSHOW` | Sections: Company overview / Management remarks / Investor Q&A |
| `WEEKLY_GROUP_CALL` | Meeting minutes: Topics discussed / Decisions made / Action items (with owners) |

Design this so that **adding a fourth meeting type with its own format is cheap** — tell us in your design notes what a new type would require.

## Deliverables

1. The application code, runnable locally with clear instructions (`docker compose up` or a couple of commands — we will run it).
2. A short **DESIGN.md** (½–1 page): your data model, how the async pipeline works, how per-type formats are organized, what you'd build next, and any trade-offs you consciously made.
3. Whatever tests you think this system needs. We don't expect full coverage — we expect you to test the things that would actually break.

## Constraints

- **Stack**: your choice. We use TypeScript/Next.js/Prisma/PostgreSQL, but a Python/Go/etc. backend with a minimal UI is equally fine. SQLite is fine.
- **UI**: functional beats beautiful. List events, show an event with both transcripts and job status, attach a raw transcript. No design polish needed.
- **No auth required.** Single-user is fine.
- Use the fabricated transcripts in [`sample-data/`](sample-data/) to demo — one per meeting type.

## What we evaluate

- **Data modeling** — do the entities (event, raw vs processed transcript, versions, jobs) reflect the domain cleanly?
- **Async pipeline** — explicit job state, failure handling, retry; no "fire and forget".
- **Extensibility** — how isolated is the per-meeting-type formatting logic?
- **Code quality** — clarity over cleverness; sensible boundaries; the kind of code a teammate could extend.
- **Judgment** — what you chose *not* to build, and whether you can explain why.

## Submitting

Push to a private repo and invite us, or send a zip. Include DESIGN.md and run instructions. We'll read your code first and run it second — make both easy.
