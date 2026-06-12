'use client';

import { useState } from 'react';
import type { Segment } from '@/lib/types';
import type { VersionView } from './api-types';
import { postJson } from './api-types';
import { SummaryView } from './SummaryView';

export function ProcessedTranscript({
  eventId,
  versions, // newest first
  jobActive,
  hasRaw,
  onSaved,
}: {
  eventId: string;
  versions: VersionView[];
  jobActive: boolean;
  hasRaw: boolean;
  onSaved: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Segment[] | null>(null); // non-null = editing
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (versions.length === 0) {
    if (jobActive) return <p className="muted">Processing the raw transcript…</p>;
    if (hasRaw) return <p className="muted">No processed transcript yet.</p>;
    return <p className="muted">Attach a raw transcript to generate one.</p>;
  }

  const selected = versions.find((v) => v.id === selectedId) ?? versions[0];

  async function saveDraft() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      await postJson(`/api/events/${eventId}/versions`, { segments: draft });
      setDraft(null);
      setSelectedId(null); // jump back to the newest version
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="version-bar">
        <span className="muted">Versions:</span>
        {versions.map((v) => (
          <button
            key={v.id}
            className={`version ${v.id === selected.id ? 'active' : ''}`}
            onClick={() => {
              setSelectedId(v.id);
              setDraft(null);
            }}
            title={`${v.source} · ${new Date(v.createdAt).toLocaleString()}`}
          >
            v{v.version}
          </button>
        ))}
        <span className="muted">
          viewing v{selected.version} · {selected.source} ·{' '}
          {new Date(selected.createdAt).toLocaleString()}
        </span>
      </div>

      <SummaryView summary={selected.summary} />

      <h3>Segments</h3>
      {draft === null ? (
        <>
          {selected.segments.map((s, i) => (
            <div className="segment" key={i}>
              {s.timestamp && <span className="timestamp">[{s.timestamp}]</span>}
              <span className="speaker">{s.speaker}:</span>
              {s.text}
            </div>
          ))}
          <div className="actions">
            <button
              className="secondary"
              onClick={() => {
                // Pin the version being edited so a job completing mid-edit
                // (new "latest") can't swap the header under the draft.
                setSelectedId(selected.id);
                setDraft(selected.segments.map((s) => ({ ...s })));
              }}
            >
              Edit segments (creates a new version)
            </button>
          </div>
        </>
      ) : (
        <>
          {draft.map((s, i) => (
            <div className="segment-edit" key={i}>
              <input
                value={s.speaker}
                aria-label={`Speaker for segment ${i + 1}`}
                onChange={(e) =>
                  setDraft(draft.map((d, j) => (j === i ? { ...d, speaker: e.target.value } : d)))
                }
              />
              <textarea
                value={s.text}
                aria-label={`Text for segment ${i + 1}`}
                onChange={(e) =>
                  setDraft(draft.map((d, j) => (j === i ? { ...d, text: e.target.value } : d)))
                }
              />
            </div>
          ))}
          {error && <div className="error-box">{error}</div>}
          <div className="actions">
            <button disabled={busy} onClick={() => void saveDraft()}>
              Save as v{versions[0].version + 1}
            </button>
            <button className="secondary" disabled={busy} onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
