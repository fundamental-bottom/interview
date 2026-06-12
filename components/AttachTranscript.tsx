'use client';

import { useState } from 'react';
import { postJson } from './api-types';

export function AttachTranscript({
  eventId,
  onAttached,
}: {
  eventId: string;
  onAttached: () => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function attach(body: { text: string; fileName?: string } | { sample: true }) {
    setBusy(true);
    setError(null);
    try {
      await postJson(`/api/events/${eventId}/raw-transcript`, body);
      onAttached();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      await attach({ text: content, fileName: file.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      // Allow re-selecting the same file after a failed attach.
      input.value = '';
    }
  }

  return (
    <div>
      <p className="muted">
        Paste the raw speech-recognition output, upload a .txt file, or load the bundled sample.
        Attaching starts processing automatically.
      </p>
      <textarea
        rows={6}
        placeholder="[00:00:03] Speaker 1: ..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {error && <div className="error-box">{error}</div>}
      <div className="actions">
        <button disabled={busy || text.trim() === ''} onClick={() => attach({ text })}>
          Attach pasted text
        </button>
        <label>
          <span
            className="muted"
            style={{ display: 'inline-block', padding: '0.45rem 0' }}
          >
            or upload:{' '}
          </span>
          <input
            type="file"
            accept=".txt,text/plain"
            disabled={busy}
            onChange={(e) => void onFileChosen(e)}
          />
        </label>
        <button className="secondary" disabled={busy} onClick={() => attach({ sample: true })}>
          Load sample for this meeting type
        </button>
      </div>
    </div>
  );
}
