import { describe, expect, it } from 'vitest';
import { createEventSchema } from '@/lib/types';

const valid = {
  title: 'Quarterly expert call',
  meetingType: 'EXPERT_CALL',
  startLocal: '2026-06-12T09:00',
  endLocal: '2026-06-12T10:00',
  timezone: 'America/New_York',
};

describe('createEventSchema', () => {
  it('accepts a well-formed event and defaults status', () => {
    const parsed = createEventSchema.parse(valid);
    expect(parsed.status).toBe('SCHEDULED');
  });

  it.each([
    ['hour 25', { startLocal: '2026-06-12T25:00' }],
    ['month 13', { startLocal: '2026-13-01T09:00', endLocal: '2026-13-01T10:00' }],
    ['Feb 30 rollover', { startLocal: '2026-02-30T09:00', endLocal: '2026-02-30T10:00' }],
    ['minute 99', { startLocal: '2026-06-12T10:99' }],
  ])('rejects impossible date components (%s)', (_name, overrides) => {
    expect(createEventSchema.safeParse({ ...valid, ...overrides }).success).toBe(false);
  });

  it('rejects an end time at or before the start', () => {
    expect(
      createEventSchema.safeParse({ ...valid, endLocal: '2026-06-12T09:00' }).success,
    ).toBe(false);
  });

  it('rejects unknown timezones and meeting types', () => {
    expect(createEventSchema.safeParse({ ...valid, timezone: 'Mars/Olympus' }).success).toBe(false);
    expect(createEventSchema.safeParse({ ...valid, meetingType: 'STANDUP' }).success).toBe(false);
  });
});
