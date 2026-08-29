import { Env, AppData } from './_middleware';
import { json, boolFromDb } from '../_lib/db';

/** Active users, for assignee pickers and attendee lists. Never exposes anything secret. */
export const onRequestGet: PagesFunction<Env, string, AppData> = async ({ env }) => {
  const { results } = await env.DB
    .prepare(
      `SELECT uid, email, display_name, avatar, role, department, workload, is_active, created_at
       FROM users WHERE is_active = 1 ORDER BY display_name`
    )
    .all<any>();

  return json(
    results.map(r => ({
      uid: r.uid,
      email: r.email,
      displayName: r.display_name,
      avatar: r.avatar || undefined,
      role: r.role,
      department: r.department || undefined,
      workload: r.workload ?? undefined,
      isActive: boolFromDb(r.is_active),
      createdAt: r.created_at,
    }))
  );
};
