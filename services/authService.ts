import { enhancedApi } from './enhancedApi';
import type { User } from '../types';

export class AuthService {
  private static currentUser: User | null = null;

  // No authentication. The facade waits for the API to load and returns its current user,
  // or the demo user when the API is not running, so this never reads a second copy.
  static async getCurrentUser(): Promise<User> {
    this.currentUser ??= await enhancedApi.getCurrentUser();
    return this.currentUser;
  }

  static async logout(): Promise<void> {
    this.currentUser = null;
  }
}
