import { User, AuthCredentials, RegisterData } from '../types';
import { supabaseService } from './supabaseService';
import { enhancedApi } from './enhancedApi';

export class AuthService {
  private static currentUser: User | null = null;
  private static sessionToken: string | null = null;

  // Simple password hashing (in production, use bcrypt or similar)
  private static hashPassword(password: string): string {
    return btoa(password + 'salt').split('').reverse().join('');
  }

  private static verifyPassword(password: string, hash: string): boolean {
    return this.hashPassword(password) === hash;
  }

  private static getEnv() {
    return (import.meta as any).env || {};
  }

  static async login(credentials: AuthCredentials): Promise<{ user: User; token: string }> {
    try {
      // Try Supabase auth first
      const metaEnv = this.getEnv();
      const supabaseUrl = metaEnv.VITE_SUPABASE_URL;
      const supabaseKey = metaEnv.VITE_SUPABASE_ANON_KEY;
      
      if (supabaseUrl && supabaseKey && supabaseUrl !== 'your_supabase_project_url' && supabaseKey !== 'your_supabase_anon_key') {
        try {
          const { user: authUser, session } = await (supabaseService as any).signIn?.(credentials.email, credentials.password) || {};
          
          if (authUser && session) {
            const user = await supabaseService.getUserById(authUser.id);
            if (!user) {
              throw new Error('User profile not found');
            }
            
            this.currentUser = user;
            this.sessionToken = session.access_token;
            
            localStorage.setItem('auth_token', session.access_token);
            localStorage.setItem('current_user', JSON.stringify(user));
            
            return { user, token: session.access_token };
          }
        } catch (supabaseError) {
          console.warn('Supabase auth failed, falling back to demo mode:', supabaseError);
        }
      }
      
      // Fallback to demo mode with enhanced API
      const users = await enhancedApi.getUsers();
      const user = users.find(u => u.email === credentials.email);
      
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.isActive) {
        throw new Error('Account is deactivated');
      }

      if (user.passwordHash && !this.verifyPassword(credentials.password, user.passwordHash)) {
        throw new Error('Invalid password');
      }

      // Generate session token
      const token = btoa(JSON.stringify({ uid: user.uid, timestamp: Date.now() }));
      
      this.currentUser = user;
      this.sessionToken = token;
      
      localStorage.setItem('auth_token', token);
      localStorage.setItem('current_user', JSON.stringify(user));

      await enhancedApi.updateUser(user.uid, { lastLogin: new Date() });

      return { user, token };
    } catch (error: any) {
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  static async register(registerData: RegisterData): Promise<{ user: User; token: string }> {
    try {
      const metaEnv = this.getEnv();
      const supabaseUrl = metaEnv.VITE_SUPABASE_URL;
      const supabaseKey = metaEnv.VITE_SUPABASE_ANON_KEY;
      
      if (supabaseUrl && supabaseKey && supabaseUrl !== 'your_supabase_project_url' && supabaseKey !== 'your_supabase_anon_key') {
        try {
          const { user: authUser, session } = await (supabaseService as any).signUp?.(
            registerData.email, 
            registerData.password, 
            registerData.displayName
          ) || {};
          
          if (authUser && session) {
            const user = await supabaseService.getUserById(authUser.id);
            if (!user) {
              throw new Error('User profile not created');
            }
            
            this.currentUser = user;
            this.sessionToken = session.access_token;
            
            localStorage.setItem('auth_token', session.access_token);
            localStorage.setItem('current_user', JSON.stringify(user));
            
            return { user, token: session.access_token };
          }
        } catch (supabaseError) {
          console.warn('Supabase registration failed, falling back to demo mode:', supabaseError);
        }
      }
      
      const users = await enhancedApi.getUsers();
      const existingUser = users.find(u => u.email === registerData.email);
      
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      const passwordHash = this.hashPassword(registerData.password);
      
      const newUser: Partial<User> = {
        uid: `user-${Date.now()}`,
        email: registerData.email,
        displayName: registerData.displayName,
        role: registerData.role || 'member',
        department: registerData.department,
        passwordHash,
        workload: 40,
        isActive: true,
        createdAt: new Date(),
        lastLogin: new Date()
      };

      const createdUser = await enhancedApi.createUser(newUser);
      const token = btoa(JSON.stringify({ uid: createdUser.uid, timestamp: Date.now() }));
      
      this.currentUser = createdUser;
      this.sessionToken = token;
      
      localStorage.setItem('auth_token', token);
      localStorage.setItem('current_user', JSON.stringify(createdUser));

      return { user: createdUser, token };
    } catch (error: any) {
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  static async logout(): Promise<void> {
    try {
      const metaEnv = this.getEnv();
      const supabaseUrl = metaEnv.VITE_SUPABASE_URL;
      const supabaseKey = metaEnv.VITE_SUPABASE_ANON_KEY;
      
      if (supabaseUrl && supabaseKey && supabaseUrl !== 'your_supabase_project_url' && supabaseKey !== 'your_supabase_anon_key') {
        try {
          await (supabaseService as any).signOut?.();
        } catch (error) {
          console.warn('Supabase signout error:', error);
        }
      }
    } catch (error) {
      console.warn('Logout error:', error);
    } finally {
      this.currentUser = null;
      this.sessionToken = null;
      localStorage.removeItem('auth_token');
      localStorage.removeItem('current_user');
    }
  }

  static async checkSession(): Promise<User | null> {
    try {
      const token = localStorage.getItem('auth_token');
      const userData = localStorage.getItem('current_user');
      
      if (!token || !userData) {
        return null;
      }

      const user = JSON.parse(userData);
      const tokenData = JSON.parse(atob(token));
      
      if (Date.now() - tokenData.timestamp > 24 * 60 * 60 * 1000) {
        await this.logout();
        return null;
      }

      const currentUser = await enhancedApi.getUserById(user.uid);
      if (!currentUser || !currentUser.isActive) {
        await this.logout();
        return null;
      }

      this.currentUser = currentUser;
      this.sessionToken = token;
      
      return currentUser;
    } catch (error) {
      await this.logout();
      return null;
    }
  }

  static getCurrentUser(): User | null {
    return this.currentUser;
  }

  static getSessionToken(): string | null {
    return this.sessionToken;
  }

  static async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    if (!this.currentUser) {
      throw new Error('Not authenticated');
    }

    const user = this.currentUser;
    if (user.passwordHash && !this.verifyPassword(oldPassword, user.passwordHash)) {
      throw new Error('Current password is incorrect');
    }

    const newPasswordHash = this.hashPassword(newPassword);
    await enhancedApi.updateUser(user.uid, { passwordHash: newPasswordHash });
    
    this.currentUser = { ...user, passwordHash: newPasswordHash };
    localStorage.setItem('current_user', JSON.stringify(this.currentUser));
  }

  static async resetPassword(email: string): Promise<void> {
    console.log(`Password reset requested for ${email}`);
    throw new Error('Password reset functionality would be implemented with email service');
  }
}
