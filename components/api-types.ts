// Client-side views of the API JSON, derived from the server serializers so
// the two can't drift: the only difference on the wire is that Dates arrive
// as ISO strings.
import type {
  EventDetail,
  JobView as ServerJobView,
  VersionView as ServerVersionView,
} from '@/lib/serialize';

type Serialized<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T;

export type JobView = Serialized<ServerJobView>;
export type VersionView = Serialized<ServerVersionView>;
export type EventDetailView = Serialized<EventDetail>;

export const JOB_ACTIVE_STATUSES = ['PENDING', 'PROCESSING'];

export async function postJson(url: string, body?: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error((data as { error?: string } | null)?.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}
