import Link from 'next/link';
import { listEventSummaries } from '@/lib/events';
import { formatInZone } from '@/lib/time';
import { meetingTypeLabel } from '@/components/labels';
import { CreateEventForm } from '@/components/CreateEventForm';

export const dynamic = 'force-dynamic';

export default async function EventsPage() {
  const events = await listEventSummaries();

  return (
    <>
      <h1>Calendar events</h1>

      <div className="card">
        <h2>New event</h2>
        <CreateEventForm />
      </div>

      <div className="card">
        <h2>
          Events <span className="muted">({events.length})</span>
        </h2>
        {events.length === 0 ? (
          <p className="muted">No events yet — create one above.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>When</th>
                <th>Status</th>
                <th>Transcript</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link href={`/events/${e.id}`}>{e.title}</Link>
                  </td>
                  <td>
                    <span className="badge type">{meetingTypeLabel(e.meetingType)}</span>
                  </td>
                  <td>
                    {formatInZone(e.startTime, e.timezone)}
                    <div className="muted">
                      → {formatInZone(e.endTime, e.timezone)} ({e.timezone})
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${e.status}`}>{e.status}</span>
                  </td>
                  <td>
                    {e.hasRawTranscript ? (
                      <>
                        {e.latestJobStatus && (
                          <span className={`badge ${e.latestJobStatus}`}>{e.latestJobStatus}</span>
                        )}{' '}
                        <span className="muted">
                          {e.versionCount} version{e.versionCount === 1 ? '' : 's'}
                        </span>
                      </>
                    ) : (
                      <span className="muted">none</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
