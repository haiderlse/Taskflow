import { Env, AppData } from './_middleware';
import { json } from '../_lib/db';

/** Who am I? The client calls this instead of a login form; Access already authenticated. */
export const onRequestGet: PagesFunction<Env, string, AppData> = async ({ data }) => {
  const { user } = data;
  return json({
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    isActive: user.isActive,
  });
};
