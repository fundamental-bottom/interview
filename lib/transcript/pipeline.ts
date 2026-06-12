import type { MeetingType, Segment, SummaryDocument } from '@/lib/types';
import { cleanText } from './clean';
import { parseRawTranscript, TranscriptParseError } from './parse';
import { getSummarizer } from './summarize';

export interface ProcessedResult {
  segments: Segment[];
  summary: SummaryDocument;
}

// The deterministic "mock LLM" pipeline: parse -> clean -> summarize.
// An LLM-backed implementation would replace this function (same signature:
// raw text + meeting type in, segments + summary out) — nothing upstream or
// downstream would change.
export function processRawTranscript(rawContent: string, meetingType: MeetingType): ProcessedResult {
  const utterances = parseRawTranscript(rawContent);

  // Filler-only turns clean down to "" — drop them, or they'd violate
  // segmentSchema (text min 1) and block later manual edits.
  const segments: Segment[] = utterances
    .map((u) => ({
      speaker: u.speaker,
      text: cleanText(u.text),
      timestamp: u.timestamp,
    }))
    .filter((s) => s.text.length > 0);

  if (segments.length === 0) {
    throw new TranscriptParseError('Every utterance was empty after cleanup — nothing to process');
  }

  const summary = getSummarizer(meetingType)(segments);
  return { segments, summary };
}

/** Rebuild the summary from segments — used when a manual edit changes the text. */
export function summarizeSegments(segments: Segment[], meetingType: MeetingType): SummaryDocument {
  return getSummarizer(meetingType)(segments);
}
