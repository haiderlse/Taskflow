import { User, AuthCredentials, RegisterData } from '../types';
import { supabaseService } from './supabaseService';

/**
 * Authentication is Supabase-only.
 *
 * There is deliberately no local/demo fallback: a fallback meant an unreachable
 * project silently signed people into throwaway accounts backed by mock data,
 * with passwords "hashed" by a reversible string transform. If Supabase is not
 * configured or not reachable, signing in fails with a message saying so.
 */

const NOT_CONFIGURED_MESSAGE =
  'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local and restart the dev server.';

export class AuthService {
  private static currentUser: User | null = null;
  private static sessionToken: string | null = null;

  private static getEnv() {
    return (import.meta as any).env || {};
  }

  /** True when a usable Supabase URL and anon key are present. */
  static isConfigured(): boolean {
    const env = this.getEnv();
    const url = env.VITE_SUPABASE_URL;
    const key = env.VITE_SUPABASE_ANON_KEY;
    return Boolean(
      url &&
        key &&
        url !== 'your_supabase_project_url' &&
        key !== 'your_supabase_anon_key' &&
        String(url).startsWith('http')
    );
  }

  static configurationMessage(): string {
    return NOT_CONFIGURED_MESSAGE;
  }

  private static requireConfigured() {
    if (!this.isConfigured() || !supabaseService.available) {
      throw new Error(NOT_CONFIGURED_MESSAGE);
    }
  }

  /**
   * Caches the signed-in profile for synchronous reads. The Supabase client owns
   * the session itself (including refresh); this is only a convenience copy.
   */
  private static cacheSession(user: User, token: string) {
    this.currentUser = user;
    this.sessionToken = token;
    try {
      localStorage.setItem('current_user', JSON.stringify(user));
    } catch {
      // Storage can be unavailable; the Supabase client still holds the session.
    }
  }

  private static clearSession() {
    this.currentUser = null;
    this.sessionToken = null;
    try {
      localStorage.removeItem('current_user');
      localStorage.removeItem('auth_token');
    } catch {
      // Non-fatal.
    }
  }

  static async login(credentials: AuthCredentials): Promise<{ user: User; token: string }> {
    this.requireConfigured();

    const { user: authUser, session } = await supabaseService.signIn(
      credentials.email,
      credentials.password
    );

    if (!authUser || !session) {
      throw new Error('Invalid email or password.');
    }

    const user = await supabaseService.getUserById(authUser.id);
    if (!user) {
      throw new Error(
        'Signed in, but no profile row exists for this account in the users table. Run supabase-schema.sql, then sign up again.'
      );
    }
    if (!user.isActive) {
      await supabaseService.signOut();
      throw new Error('This account has been deactivated.');
    }

    this.cacheSession(user, session.access_token);

    try {
      await supabaseService.updateUser(user.uid, { lastLogin: new Date() });
    } catch {
      // A failed last-login stamp must not block signing in.
    }

    return { user, token: session.access_token };
  }

  static async register(registerData: RegisterData): Promise<{ user: User; token: string }> {
    this.requireConfigured();

    const { user: authUser, session } = await supabaseService.signUp(
      registerData.email,
      registerData.password,
      registerData.displayName
    );

    if (!authUser) {
      throw new Error('Sign-up failed. Please try again.');
    }

    // With "Confirm email" enabled, Supabase returns a user but no session until
    // the address is verified, so there is nothing to sign in with yet.
    if (!session) {
      throw new Error(
        'Account created. Check your inbox to confirm the email address, then sign in. (To skip this, turn off "Confirm email" in Supabase → Authentication → Providers → Email.)'
      );
    }

    const user = await supabaseService.getUserById(authUser.id);
    if (!user) {
      throw new Error('Account created, but the profile row was not written. Check that supabase-schema.sql has been run.');
    }

    this.cacheSession(user, session.access_token);
    return { user, token: session.access_token };
  }

  static async logout(): Promise<void> {
    try {
      if (this.isConfigured() && supabaseService.available) {
        await supabaseService.signOut();
      }
    } catch (error) {
      console.warn('Supabase sign-out error:', error);
    } finally {
      this.clearSession();
    }
  }

  /**
   * Restores a session on page load. The Supabase client persists and refreshes
   * its own token, so this asks it rather than trusting anything in localStorage.
   */
  static async checkSession(): Promise<User | null> {
    if (!this.isConfigured() || !supabaseService.available) return null;

    try {
      const session = await supabaseService.getSession();
      if (!session) {
        this.clearSession();
        return null;
      }

      const user = await supabaseService.getCurrentUser();
      if (!user || !user.isActive) {
        await this.logout();
        return null;
      }

      this.cacheSession(user, session.access_token);
      return user;
    } catch (error) {
      console.warn('Session check failed:', error);
      this.clearSession();
      return null;
    }
  }

  static getCurrentUser(): User | null {
    return this.currentUser;
  }

  static getSessionToken(): string | null {
    return this.sessionToken;
  }

  /**
   * Supabase re-authenticates against the active session, so the old password is
   * not re-checked here; it is verified by signing in before the change.
   */
  static async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    this.requireConfigured();
    if (!this.currentUser) {
      throw new Error('Not authenticated');
    }

    // Prove the current password before allowing a change.
    await supabaseService.signIn(this.currentUser.email, oldPassword);
    await supabaseService.updatePassword(newPassword);
  }

  static async resetPassword(email: string): Promise<void> {
    this.requireConfigured();
    await supabaseService.sendPasswordReset(email);
  }
}
