'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { EventDetailView } from './api-types';
import { JOB_ACTIVE_STATUSES } from './api-types';
import { meetingTypeLabel } from './labels';
import { AttachTranscript } from './AttachTranscript';
import { JobStatusCard } from './JobStatusCard';
import { ProcessedTranscript } from './ProcessedTranscript';

const POLL_INTERVAL_MS = 2500;

export function EventDetail({
  eventId,
  initialData,
}: {
  eventId: string;
  initialData?: EventDetailView;
}) {
  const [detail, setDetail] = useState<EventDetailView | null>(initialData ?? null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Refreshes overlap (interval + action-triggered): only the newest request
  // may write state, or a slow stale GET could undo a fresher response.
  const requestSeq = useRef(0);

  const refresh = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      const res = await fetch(`/api/events/${eventId}`, { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Failed to load event (${res.status})`);
      }
      const data = await res.json();
      if (seq !== requestSeq.current) return;
      setDetail(data);
      setLoadError(null);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, [eventId]);

  // Poll while the page is open so job transitions and new versions appear
  // without a manual reload.
  useEffect(() => {
    void refresh();
    const handle = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(handle);
  }, [refresh]);

  // A transient poll failure must not blank the page (and any in-progress
  // edit with it) — keep showing the last good data with a banner on top.
  if (!detail) {
    return loadError ? <div className="error-box">{loadError}</div> : <p className="muted">Loading…</p>;
  }

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: detail.timezone,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));

  const jobActive =
    detail.latestJob !== null && JOB_ACTIVE_STATUSES.includes(detail.latestJob.status);

  return (
    <>
      <p>
        <Link href="/">← All events</Link>
      </p>

      {loadError && <div className="error-box">Refresh failed: {loadError}</div>}

      <div className="detail-header">
        <h1>{detail.title}</h1>
        <span className="badge type">{meetingTypeLabel(detail.meetingType)}</span>
        <span className={`badge ${detail.status}`}>{detail.status}</span>
      </div>
      <p className="muted">
        {fmt(detail.startTime)} → {fmt(detail.endTime)} ({detail.timezone})
      </p>

      <div className="card">
        <h2>Raw transcript</h2>
        {detail.rawTranscript ? (
          <>
            <p className="muted">
              {detail.rawTranscript.fileName ? `${detail.rawTranscript.fileName} · ` : ''}
              attached {new Date(detail.rawTranscript.createdAt).toLocaleString()} · immutable
            </p>
            <pre className="raw-transcript">{detail.rawTranscript.content}</pre>
          </>
        ) : (
          <AttachTranscript eventId={detail.id} onAttached={refresh} />
        )}
      </div>

      {detail.rawTranscript && (
        <div className="card">
          <h2>Processing job</h2>
          <JobStatusCard
            eventId={detail.id}
            job={detail.latestJob}
            jobActive={jobActive}
            onChanged={refresh}
          />
        </div>
      )}

      <div className="card">
        <h2>Processed transcript</h2>
        <ProcessedTranscript
          eventId={detail.id}
          versions={detail.versions}
          jobActive={jobActive}
          hasRaw={detail.rawTranscript !== null}
          onSaved={refresh}
        />
      </div>
    </>
  );
}
