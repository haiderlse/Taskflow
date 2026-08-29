import { verifyAccessJwt, AccessEnv, AccessIdentity } from '../_lib/access';

/**
 * Runs before every /api/* function. Scoped to this directory on purpose: the
 * static assets are already behind Access at the edge, and adding a root
 * middleware would put a database round-trip in front of every image request.
 */

export interface Env extends AccessEnv {
  DB: D1Database;
  /**
   * Comma-separated emails that are always admins. Checked on every request, so
   * adding an address here promotes that account on their next page load, and
   * an admin who is demoted in the database is restored rather than silently
   * losing access.
   */
  ADMIN_EMAILS?: string;
}

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  isActive: boolean;
}

export interface AppData extends Record<string, unknown> {
  identity: AccessIdentity;
  user: AppUser;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

/**
 * Access has authenticated the person, but the app still needs a row in `users`
 * to hang roles, assignments and ownership off. The first time someone arrives,
 * create it. Email is the join key, since that is what Access asserts.
 */
const isBootstrapAdmin = (email: string, adminEmails?: string): boolean =>
  (adminEmails || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());

async function resolveUser(
  db: D1Database,
  identity: AccessIdentity,
  adminEmails?: string
): Promise<AppUser | null> {
  const existing = await db
    .prepare('SELECT uid, email, display_name, role, is_active FROM users WHERE email = ?')
    .bind(identity.email)
    .first<{ uid: string; email: string; display_name: string; role: string; is_active: number }>();

  if (existing) {
    if (!existing.is_active) return null;

    let role = existing.role;
    if (isBootstrapAdmin(existing.email, adminEmails) && role !== 'admin') {
      await db.prepare('UPDATE users SET role = ? WHERE uid = ?').bind('admin', existing.uid).run();
      role = 'admin';
    }

    return {
      uid: existing.uid,
      email: existing.email,
      displayName: existing.display_name,
      role,
      isActive: true,
    };
  }

  const uid = crypto.randomUUID();
  const displayName = identity.email.split('@')[0];

  // ADMIN_EMAILS decides admin explicitly. Falling back to "the first person to
  // sign in owns the workspace" keeps a fresh deployment usable, but it is order
  // dependent, so the env var is the one to rely on.
  let role = 'member';
  if (isBootstrapAdmin(identity.email, adminEmails)) {
    role = 'admin';
  } else {
    const { count } = (await db
      .prepare('SELECT COUNT(*) AS count FROM users')
      .first<{ count: number }>()) ?? { count: 0 };
    if (count === 0) role = 'admin';
  }

  await db
    .prepare(
      `INSERT INTO users (uid, email, display_name, role, is_active, last_login)
       VALUES (?, ?, ?, ?, 1, ?)`
    )
    .bind(uid, identity.email, displayName, role, new Date().toISOString())
    .run();

  return { uid, email: identity.email, displayName, role, isActive: true };
}

export const onRequest: PagesFunction<Env, string, AppData> = async context => {
  const { request, env, next, data } = context;

  if (!env.DB) {
    return json({ error: 'The D1 binding "DB" is not configured for this environment.' }, 500);
  }

  // Refusing the dev bypass in a configured (deployed) environment is what stops
  // it from silently becoming an authentication bypass in production.
  if (env.ACCESS_TEAM_DOMAIN && env.DEV_ACCESS_EMAIL) {
    return json(
      { error: 'DEV_ACCESS_EMAIL must not be set when ACCESS_TEAM_DOMAIN is configured.' },
      500
    );
  }

  let identity: AccessIdentity | null;
  try {
    identity = await verifyAccessJwt(request, env);
  } catch (err: any) {
    return json({ error: `Access verification failed: ${err?.message || 'unknown error'}` }, 503);
  }

  if (!identity) {
    return json({ error: 'Not authenticated.' }, 401);
  }

  const user = await resolveUser(env.DB, identity, env.ADMIN_EMAILS);
  if (!user) {
    return json({ error: 'This account has been deactivated.' }, 403);
  }

  data.identity = identity;
  data.user = user;

  return next();
};
