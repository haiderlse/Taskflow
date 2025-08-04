import { User, AuthCredentials, RegisterData } from '../types';
import { enhancedApi } from './enhancedApi';

export class AuthService {
  private static currentUser: User | null = null;
  private static sessionToken: string | null = null;

  // Simple password hashing (in production, use bcrypt or similar)
  private static hashPassword(password: string): string {
    // This is a simple hash for demo purposes - use proper hashing in production
    return btoa(password + 'salt').split('').reverse().join('');
  }

  private static verifyPassword(password: string, hash: string): boolean {
    return this.hashPassword(password) === hash;
  }

  static async login(credentials: AuthCredentials): Promise<{ user: User; token: string }> {
    try {
      const users = await enhancedApi.getUsers();
      const user = users.find(u => u.email === credentials.email);
      
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.isActive) {
        throw new Error('Account is deactivated');
      }

      // For demo purposes, if user doesn't have a password hash, accept any password
      // In production, all users should have proper password hashes
      if (user.passwordHash && !this.verifyPassword(credentials.password, user.passwordHash)) {
        throw new Error('Invalid password');
      }

      // Update last login
      await enhancedApi.updateUser(user.uid, { lastLogin: new Date() });

      // Generate session token (in production, use JWT or similar)
      const token = btoa(JSON.stringify({ uid: user.uid, timestamp: Date.now() }));
      
      this.currentUser = user;
      this.sessionToken = token;
      
      // Store in localStorage for persistence
      localStorage.setItem('auth_token', token);
      localStorage.setItem('current_user', JSON.stringify(user));

      return { user, token };
    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  static async register(registerData: RegisterData): Promise<{ user: User; token: string }> {
    try {
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
      
      // Generate session token
      const token = btoa(JSON.stringify({ uid: createdUser.uid, timestamp: Date.now() }));
      
      this.currentUser = createdUser;
      this.sessionToken = token;
      
      // Store in localStorage for persistence
      localStorage.setItem('auth_token', token);
      localStorage.setItem('current_user', JSON.stringify(createdUser));

      return { user: createdUser, token };
    } catch (error) {
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  static async logout(): Promise<void> {
    this.currentUser = null;
    this.sessionToken = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('current_user');
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
      
      // Check if token is not older than 24 hours
      if (Date.now() - tokenData.timestamp > 24 * 60 * 60 * 1000) {
        await this.logout();
        return null;
      }

      // Verify user still exists and is active
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
    
    // Update current user object
    this.currentUser = { ...user, passwordHash: newPasswordHash };
    localStorage.setItem('current_user', JSON.stringify(this.currentUser));
  }

  static async resetPassword(email: string): Promise<void> {
    // In a real application, this would send a reset email
    // For demo purposes, we'll just log it
    console.log(`Password reset requested for ${email}`);
    throw new Error('Password reset functionality would be implemented with email service');
  }
}