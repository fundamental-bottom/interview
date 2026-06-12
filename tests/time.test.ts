import { describe, expect, it } from 'vitest';
import { zonedNaiveToUtc } from '@/lib/time';

describe('zonedNaiveToUtc', () => {
  it('interprets wall-clock time in the given zone (EDT, UTC-4)', () => {
    expect(zonedNaiveToUtc('2026-06-12T09:00', 'America/New_York').toISOString()).toBe(
      '2026-06-12T13:00:00.000Z',
    );
  });

  it('handles zones ahead of UTC (Hong Kong, UTC+8, no DST)', () => {
    expect(zonedNaiveToUtc('2026-06-12T09:00', 'Asia/Hong_Kong').toISOString()).toBe(
      '2026-06-12T01:00:00.000Z',
    );
  });

  it('uses the winter offset on the other side of a DST boundary', () => {
    // January in New York is EST (UTC-5), not EDT.
    expect(zonedNaiveToUtc('2026-01-15T09:00', 'America/New_York').toISOString()).toBe(
      '2026-01-15T14:00:00.000Z',
    );
  });

  it('is exact at the spring-forward boundary', () => {
    // 2026-03-08 03:00 EDT is the first valid wall-clock hour after the jump.
    expect(zonedNaiveToUtc('2026-03-08T03:00', 'America/New_York').toISOString()).toBe(
      '2026-03-08T07:00:00.000Z',
    );
  });

  it('maps a nonexistent spring-forward time to a deterministic instant (characterization)', () => {
    // 02:30 on 2026-03-08 does not exist in New York (clocks jump 02:00->03:00).
    // The double-offset algorithm lands on 06:30Z (= 02:30 EDT); pinned so a
    // refactor can't silently change the mapping.
    expect(zonedNaiveToUtc('2026-03-08T02:30', 'America/New_York').toISOString()).toBe(
      '2026-03-08T06:30:00.000Z',
    );
  });

  it('resolves an ambiguous fall-back time to its first occurrence (characterization)', () => {
    // 01:30 on 2026-11-01 happens twice in New York; we pick the EDT one.
    expect(zonedNaiveToUtc('2026-11-01T01:30', 'America/New_York').toISOString()).toBe(
      '2026-11-01T05:30:00.000Z',
    );
  });

  it('passes UTC through unchanged', () => {
    expect(zonedNaiveToUtc('2026-06-12T09:00', 'UTC').toISOString()).toBe(
      '2026-06-12T09:00:00.000Z',
    );
  });
});
