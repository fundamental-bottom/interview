import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseRawTranscript, TranscriptParseError } from '@/lib/transcript/parse';

const sample = (name: string) =>
  readFileSync(path.join(__dirname, '..', 'sample-data', name), 'utf8');

describe('parseRawTranscript', () => {
  it('parses the expert call sample', () => {
    const utterances = parseRawTranscript(sample('expert-call-raw.txt'));
    expect(utterances).toHaveLength(12);
    expect(utterances[0]).toMatchObject({ timestamp: '00:00:03', speaker: 'Speaker 1' });
    expect(new Set(utterances.map((u) => u.speaker))).toEqual(
      new Set(['Speaker 1', 'Speaker 2', 'Speaker 3']),
    );
  });

  it('treats unlabelled lines as continuations of the previous utterance', () => {
    const utterances = parseRawTranscript(
      '[00:00:01] Speaker 1: first part\nsecond part wrapped\n\n[00:00:09] Speaker 2: reply',
    );
    expect(utterances).toHaveLength(2);
    expect(utterances[0].text).toBe('first part second part wrapped');
  });

  it('strips every [[FLAKY]] failure-injection marker, not just the first', () => {
    const utterances = parseRawTranscript('[00:00:01] Speaker 1: hello [[FLAKY]]world [[FLAKY]]');
    expect(utterances[0].text).toBe('hello world');
  });

  it('accepts single-digit hours instead of merging the line into the previous speaker', () => {
    const utterances = parseRawTranscript(
      '[0:00:01] Speaker 1: hello\n[0:00:09] Speaker 2: thanks for having me',
    );
    expect(utterances).toHaveLength(2);
    expect(utterances[1]).toMatchObject({ speaker: 'Speaker 2', text: 'thanks for having me' });
  });

  it('parses an empty-text utterance as its own turn, not as junk continuation', () => {
    const utterances = parseRawTranscript('[00:00:01] Speaker 1: hi\n[00:00:05] Speaker 2:');
    expect(utterances).toHaveLength(2);
    expect(utterances[1]).toMatchObject({ speaker: 'Speaker 2', text: '' });
  });

  it('rejects transcripts with no recognizable utterances', () => {
    expect(() => parseRawTranscript('just some\nfree text')).toThrow(TranscriptParseError);
  });
});
