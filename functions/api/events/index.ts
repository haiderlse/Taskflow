import { Env, AppData } from '../_middleware';
import {
  json,
  badRequest,
  mapEventRow,
  toJsonColumn,
  boolToDb,
  isoOrNull,
  newId,
  syncAttendeeIndex,
  EventRow,
} from '../../_lib/db';

/**
 * Replaces the Supabase RLS policy
 *   USING (auth.uid() = owner_id OR attendees @> [{userId: auth.uid()}])
 * Authorization is now explicit: the query itself only ever returns rows the
 * caller owns or is invited to, so a missing check cannot leak another user's
 * calendar.
 */
export const onRequestGet: PagesFunction<Env, string, AppData> = async ({ env, data }) => {
  const { results } = await env.DB
    .prepare(
      `SELECT e.* FROM calendar_events e
       WHERE e.owner_id = ?1
          OR EXISTS (
               SELECT 1 FROM calendar_event_attendees a
               WHERE a.event_id = e.id AND a.user_id = ?1
             )
       ORDER BY e.start_time`
    )
    .bind(data.user.uid)
    .all<EventRow>();

  return json(results.map(mapEventRow));
};

export const onRequestPost: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return badRequest('Request body must be JSON.');
  }

  if (!body?.title || typeof body.title !== 'string' || !body.title.trim()) {
    return badRequest('An event needs a title.');
  }

  const start = isoOrNull(body.start);
  const end = isoOrNull(body.end);
  if (!start || !end) return badRequest('An event needs a valid start and end.');
  if (new Date(end) <= new Date(start)) return badRequest('End must be after the start.');

  const id = body.id && typeof body.id === 'string' ? body.id : newId('evt');
  const attendees = Array.isArray(body.attendees) ? body.attendees : [];

  // owner_id comes from the verified session, never from the request body:
  // otherwise a caller could create events owned by someone else.
  const ownerId = data.user.uid;

  await env.DB
    .prepare(
      `INSERT INTO calendar_events
         (id, title, description, type, owner_id, start_time, end_time, is_all_day, location,
          conference_link, attendees, project_id, task_ids, color, reminders, recurrence,
          exceptions, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .bind(
      id,
      body.title.trim(),
      body.description || '',
      body.type || 'meeting',
      ownerId,
      start,
      end,
      boolToDb(body.isAllDay),
      body.location ?? null,
      body.conferenceLink ?? null,
      toJsonColumn(attendees),
      body.projectId ?? null,
      toJsonColumn(body.taskIds ?? []),
      body.color ?? null,
      toJsonColumn(body.reminders ?? []),
      body.recurrence ? toJsonColumn(body.recurrence) : null,
      toJsonColumn(body.exceptions ?? []),
      body.status || 'confirmed'
    )
    .run();

  await syncAttendeeIndex(env.DB, id, attendees);

  const row = await env.DB
    .prepare('SELECT * FROM calendar_events WHERE id = ?')
    .bind(id)
    .first<EventRow>();

  return json(mapEventRow(row!), 201);
};
