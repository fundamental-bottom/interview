'use client';

import { useEffect, useState } from 'react';
import type { JobView } from './api-types';
import { postJson } from './api-types';

export function JobStatusCard({
  eventId,
  job,
  jobActive,
  onChanged,
}: {
  eventId: string;
  job: JobView | null;
  jobActive: boolean;
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // An action error ("only FAILED jobs can be retried", regenerate 409, …)
  // is about the job state it was raised against — drop it once the poll
  // moves the job forward.
  useEffect(() => {
    setError(null);
  }, [job?.id, job?.status]);

  async function act(url: string) {
    setBusy(true);
    setError(null);
    try {
      await postJson(url);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {job ? (
        <p>
          <span className={`badge ${job.status}`}>{job.status}</span>{' '}
          <span className="muted">
            attempt {job.attempts || '–'} · created {new Date(job.createdAt).toLocaleTimeString()}
            {job.finishedAt ? ` · finished ${new Date(job.finishedAt).toLocaleTimeString()}` : ''}
          </span>
        </p>
      ) : (
        <p className="muted">No job yet.</p>
      )}
      {job?.status === 'FAILED' && job.error && <div className="error-box">{job.error}</div>}
      {error && <div className="error-box">{error}</div>}
      <div className="actions">
        {job?.status === 'FAILED' && (
          <button disabled={busy} onClick={() => act(`/api/jobs/${job.id}/retry`)}>
            Retry job
          </button>
        )}
        <button
          className="secondary"
          disabled={busy || jobActive}
          title="Re-run the pipeline on the raw transcript; produces a new version"
          onClick={() => act(`/api/events/${eventId}/regenerate`)}
        >
          Regenerate processed transcript
        </button>
      </div>
    </div>
  );
}
