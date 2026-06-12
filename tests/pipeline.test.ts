import { describe, expect, it } from 'vitest';
import { processRawTranscript } from '@/lib/transcript/pipeline';
import { TranscriptParseError } from '@/lib/transcript/parse';
import { segmentSchema } from '@/lib/types';

describe('processRawTranscript', () => {
  it('drops filler-only utterances so every stored segment passes segmentSchema', () => {
    const raw = [
      '[00:00:01] Speaker 1: the numbers look good',
      '[00:00:03] Speaker 2: um, uh.',
      '[00:00:05] Speaker 1: agreed',
    ].join('\n');
    const { segments } = processRawTranscript(raw, 'WEEKLY_GROUP_CALL');
    expect(segments).toHaveLength(2);
    for (const segment of segments) {
      expect(segmentSchema.safeParse(segment).success).toBe(true);
    }
  });

  it('fails clearly when cleanup leaves nothing to process', () => {
    expect(() => processRawTranscript('[00:00:01] Speaker 1: um uh', 'EXPERT_CALL')).toThrow(
      TranscriptParseError,
    );
  });
});
