/** Shared helpers for the D1-backed API: responses, JSON columns, row mapping. */

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export const badRequest = (message: string) => json({ error: message }, 400);
export const forbidden = (message = 'Not allowed.') => json({ error: message }, 403);
export const notFound = (message = 'Not found.') => json({ error: message }, 404);

/** SQLite stores JSON as TEXT; a malformed value must not take the request down. */
export const parseJson = <T>(value: unknown, fallback: T): T => {
  if (typeof value !== 'string' || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const toJsonColumn = (value: unknown): string => JSON.stringify(value ?? null);

export const boolFromDb = (value: unknown): boolean => value === 1 || value === true;
export const boolToDb = (value: unknown): number => (value ? 1 : 0);

/** Dates cross the wire as ISO strings; the client revives them into Date objects. */
export const isoOrNull = (value: unknown): string | null => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

export interface EventRow {
  id: string;
  title: string;
  description: string | null;
  type: string;
  owner_id: string;
  start_time: string;
  end_time: string;
  is_all_day: number;
  location: string | null;
  conference_link: string | null;
  attendees: string;
  project_id: string | null;
  task_ids: string;
  color: string | null;
  reminders: string;
  recurrence: string | null;
  exceptions: string;
  status: string;
  created_at: string;
  updated_at: string;
}

/** Shapes a row into the CalendarEvent the client already expects. */
export const mapEventRow = (row: EventRow) => ({
  id: row.id,
  title: row.title,
  description: row.description || '',
  type: row.type,
  ownerId: row.owner_id,
  start: row.start_time,
  end: row.end_time,
  isAllDay: boolFromDb(row.is_all_day),
  location: row.location || undefined,
  conferenceLink: row.conference_link || undefined,
  attendees: parseJson<unknown[]>(row.attendees, []),
  projectId: row.project_id || undefined,
  taskIds: parseJson<string[]>(row.task_ids, []),
  color: row.color || undefined,
  reminders: parseJson<unknown[]>(row.reminders, []),
  recurrence: row.recurrence ? parseJson<unknown>(row.recurrence, null) : null,
  exceptions: parseJson<string[]>(row.exceptions, []),
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Rewrites the attendee index for an event. SQLite cannot index inside a JSON
 * column, so attendee lookups use a side table that must be kept in step with
 * calendar_events.attendees on every write.
 */
export const syncAttendeeIndex = async (
  db: D1Database,
  eventId: string,
  attendees: Array<{ userId?: string }>
) => {
  const statements: D1PreparedStatement[] = [
    db.prepare('DELETE FROM calendar_event_attendees WHERE event_id = ?').bind(eventId),
  ];

  const userIds = [...new Set(attendees.map(a => a?.userId).filter((id): id is string => !!id))];
  for (const userId of userIds) {
    statements.push(
      db
        .prepare('INSERT OR IGNORE INTO calendar_event_attendees (event_id, user_id) VALUES (?, ?)')
        .bind(eventId, userId)
    );
  }

  await db.batch(statements);
};
