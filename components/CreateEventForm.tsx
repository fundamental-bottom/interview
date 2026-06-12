'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EVENT_STATUSES, MEETING_TYPES } from '@/lib/types';
import { MEETING_TYPE_LABELS } from './labels';
import { postJson } from './api-types';

export function CreateEventForm() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [meetingType, setMeetingType] = useState<string>(MEETING_TYPES[0]);
  const [startLocal, setStartLocal] = useState('');
  const [endLocal, setEndLocal] = useState('');
  // Browser timezone data is filled in after mount: reading Intl during
  // render would make the server-rendered HTML disagree with the client's.
  const [timezone, setTimezone] = useState('UTC');
  const [timezones, setTimezones] = useState<string[]>(['UTC']);
  const [status, setStatus] = useState<string>(EVENT_STATUSES[0]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setTimezones(Intl.supportedValuesOf('timeZone'));
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await postJson('/api/events', { title, meetingType, startLocal, endLocal, timezone, status });
      setTitle('');
      setStartLocal('');
      setEndLocal('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="row">
        <label className="field" style={{ flex: 2 }}>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
        </label>
        <label className="field">
          Meeting type
          <select value={meetingType} onChange={(e) => setMeetingType(e.target.value)}>
            {MEETING_TYPES.map((t) => (
              <option key={t} value={t}>
                {MEETING_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {EVENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="row">
        <label className="field">
          Starts
          <input
            type="datetime-local"
            value={startLocal}
            onChange={(e) => setStartLocal(e.target.value)}
            required
          />
        </label>
        <label className="field">
          Ends
          <input
            type="datetime-local"
            value={endLocal}
            onChange={(e) => setEndLocal(e.target.value)}
            required
          />
        </label>
        <label className="field">
          Timezone
          <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <div className="error-box">{error}</div>}
      <button type="submit" disabled={submitting}>
        {submitting ? 'Creating…' : 'Create event'}
      </button>
    </form>
  );
}
