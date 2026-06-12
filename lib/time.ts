// Timezone handling without a date library.
//
// Events are entered as wall-clock times in a chosen IANA zone and stored as
// UTC instants plus the zone name. Conversion uses Intl to find the zone's
// real offset at that moment; the second iteration makes the result correct
// across DST transitions, where the first guess can land on the wrong side
// of the changeover.

function timeZoneOffsetMs(timeZone: string, utcDate: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(utcDate)) parts[p.type] = p.value;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24, // Intl emits "24" for midnight in some locales
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - utcDate.getTime();
}

/** Interpret a naive "YYYY-MM-DDTHH:mm" string as wall-clock time in the given zone. */
export function zonedNaiveToUtc(naive: string, timeZone: string): Date {
  const guess = new Date(`${naive}:00Z`);
  const firstOffset = timeZoneOffsetMs(timeZone, guess);
  const candidate = new Date(guess.getTime() - firstOffset);
  const secondOffset = timeZoneOffsetMs(timeZone, candidate);
  return new Date(guess.getTime() - secondOffset);
}

/** Format a UTC instant as wall-clock time in the event's zone, for display. */
export function formatInZone(utc: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(utc);
}
