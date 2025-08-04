
import React, { useState, useEffect } from 'react';
import { User } from '../types';

interface AuthPageProps {
  users: User[];
  onLogin: (user: User) => void;
  loading: boolean;
}

const AuthPage: React.FC<AuthPageProps> = ({ users, onLogin, loading }) => {
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  useEffect(() => {
    if (!selectedUserId && users.length > 0) {
      setSelectedUserId(users[0].uid);
    }
  }, [users, selectedUserId]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUserId) {
      const userToLogin = users.find(u => u.uid === selectedUserId);
      if (userToLogin) {
        onLogin(userToLogin);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-sidebar p-4">
      <div className="w-full max-w-sm p-8 space-y-6 bg-[#2d2f31] rounded-2xl shadow-lg">
        <div>
          <h1 className="text-3xl font-extrabold text-center text-white">TaskFlow</h1>
          <h2 className="mt-2 text-center text-md text-subtle-text">
            Welcome! Please select a profile to log in.
          </h2>
        </div>
        <form className="mt-6 space-y-6" onSubmit={handleLogin}>
          <div className="rounded-md shadow-sm">
            <div>
              <label htmlFor="user-select" className="block text-sm font-medium text-light-text mb-1">User Profile</label>
              <select
                id="user-select"
                name="user"
                required
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="appearance-none rounded-md relative block w-full px-3 py-3 border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-accent focus:border-accent focus:z-10 sm:text-sm"
              >
                {users.map(user => (
                  <option key={user.uid} value={user.uid}>{user.displayName} ({user.email})</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={!selectedUserId || loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-accent hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-accent disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </div>
        </form>
         <p className="mt-4 text-center text-xs text-subtle-text">
            This is a simulated login. No password required.
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
