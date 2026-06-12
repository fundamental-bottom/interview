// Parsing of raw speech-recognition output.
//
// Expected line shape: "[H:MM:SS] Speaker N: text" (hours may be 1-2 digits,
// seconds optional, empty text allowed — filler-only turns clean down to
// nothing later anyway). Lines that don't look like an utterance are treated
// as continuations of the previous utterance (transcripts often hard-wrap
// long turns); a file where nothing parses is rejected with a clear error.

export interface RawUtterance {
  timestamp: string;
  speaker: string;
  text: string;
}

export class TranscriptParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranscriptParseError';
  }
}

const UTTERANCE_RE = /^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([^:]{1,60}):\s*(.*)$/;

// Failure-injection marker, stripped before parsing. See lib/jobs/runner.ts.
export const FLAKY_MARKER = '[[FLAKY]]';

export function parseRawTranscript(raw: string): RawUtterance[] {
  const utterances: RawUtterance[] = [];

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.replaceAll(FLAKY_MARKER, '').trim();
    if (!trimmed) continue;

    const match = UTTERANCE_RE.exec(trimmed);
    if (match) {
      utterances.push({ timestamp: match[1], speaker: match[2].trim(), text: match[3].trim() });
    } else if (utterances.length > 0) {
      const last = utterances[utterances.length - 1];
      last.text = last.text === '' ? trimmed : `${last.text} ${trimmed}`;
    }
    // Junk before the first utterance is dropped; if the whole file is junk
    // we fail below with a clear error.
  }

  if (utterances.length === 0) {
    throw new TranscriptParseError(
      'No speaker utterances found. Expected lines like "[00:00:03] Speaker 1: ..."',
    );
  }
  return utterances;
}
