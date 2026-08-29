import { Env, AppData } from '../_middleware';
import {
  json,
  badRequest,
  notFound,
  forbidden,
  mapEventRow,
  toJsonColumn,
  boolToDb,
  isoOrNull,
  syncAttendeeIndex,
  EventRow,
} from '../../_lib/db';

/**
 * Replaces the Supabase UPDATE/DELETE policies, both `USING (auth.uid() = owner_id)`.
 * Ownership is re-checked on every call: being able to *see* an event (as an
 * attendee) must not imply being able to change or delete it.
 */
async function loadOwned(env: Env, id: string, uid: string) {
  const row = await env.DB
    .prepare('SELECT * FROM calendar_events WHERE id = ?')
    .bind(id)
    .first<EventRow>();

  if (!row) return { row: null, response: notFound('No such event.') };
  if (row.owner_id !== uid) {
    // Deliberately the same shape as a genuine 403 rather than leaking, via a
    // 404, whether an event with this id exists on someone else's calendar.
    return { row: null, response: forbidden('Only the event owner can change it.') };
  }
  return { row, response: null };
}

export const onRequestPatch: PagesFunction<Env, string, AppData> = async ({
  request,
  env,
  data,
  params,
}) => {
  const id = String(params.id);
  const { row, response } = await loadOwned(env, id, data.user.uid);
  if (!row) return response!;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return badRequest('Request body must be JSON.');
  }

  // Only these columns are writable. owner_id, id and created_at are excluded so
  // an event cannot be reassigned to another user or have its identity rewritten.
  const sets: string[] = [];
  const binds: unknown[] = [];
  const set = (column: string, value: unknown) => {
    sets.push(`${column} = ?`);
    binds.push(value);
  };

  if (body.title !== undefined) {
    if (!String(body.title).trim()) return badRequest('An event needs a title.');
    set('title', String(body.title).trim());
  }
  if (body.description !== undefined) set('description', body.description || '');
  if (body.type !== undefined) set('type', body.type);
  if (body.isAllDay !== undefined) set('is_all_day', boolToDb(body.isAllDay));
  if (body.location !== undefined) set('location', body.location ?? null);
  if (body.conferenceLink !== undefined) set('conference_link', body.conferenceLink ?? null);
  if (body.projectId !== undefined) set('project_id', body.projectId ?? null);
  if (body.taskIds !== undefined) set('task_ids', toJsonColumn(body.taskIds));
  if (body.color !== undefined) set('color', body.color ?? null);
  if (body.reminders !== undefined) set('reminders', toJsonColumn(body.reminders));
  if (body.exceptions !== undefined) set('exceptions', toJsonColumn(body.exceptions));
  if (body.status !== undefined) set('status', body.status);
  if (body.recurrence !== undefined) {
    set('recurrence', body.recurrence ? toJsonColumn(body.recurrence) : null);
  }

  const nextStart = body.start !== undefined ? isoOrNull(body.start) : row.start_time;
  const nextEnd = body.end !== undefined ? isoOrNull(body.end) : row.end_time;
  if (!nextStart || !nextEnd) return badRequest('Start and end must be valid dates.');
  if (new Date(nextEnd) <= new Date(nextStart)) return badRequest('End must be after the start.');
  if (body.start !== undefined) set('start_time', nextStart);
  if (body.end !== undefined) set('end_time', nextEnd);

  if (body.attendees !== undefined) set('attendees', toJsonColumn(body.attendees));

  if (sets.length === 0) return json(mapEventRow(row));

  binds.push(id);
  await env.DB
    .prepare(`UPDATE calendar_events SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...binds)
    .run();

  if (body.attendees !== undefined) {
    await syncAttendeeIndex(env.DB, id, Array.isArray(body.attendees) ? body.attendees : []);
  }

  const updated = await env.DB
    .prepare('SELECT * FROM calendar_events WHERE id = ?')
    .bind(id)
    .first<EventRow>();

  return json(mapEventRow(updated!));
};

export const onRequestDelete: PagesFunction<Env, string, AppData> = async ({ env, data, params }) => {
  const id = String(params.id);
  const { row, response } = await loadOwned(env, id, data.user.uid);
  if (!row) return response!;

  // calendar_event_attendees cascades on the foreign key.
  await env.DB.prepare('DELETE FROM calendar_events WHERE id = ?').bind(id).run();
  return json({ ok: true });
};
