
import React, { useState, useEffect } from 'react';
import { User, AuthCredentials, RegisterData } from '../types';
import { AuthService } from '../services/authService';

interface AuthPageProps {
  users: User[];
  onLogin: (user: User) => void;
  loading: boolean;
}

type AuthMode = 'login' | 'register' | 'demo';

const AuthPage: React.FC<AuthPageProps> = ({ users, onLogin, loading }) => {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [credentials, setCredentials] = useState<AuthCredentials>({ email: '', password: '' });
  const [registerData, setRegisterData] = useState<RegisterData>({ 
    email: '', 
    password: '', 
    displayName: '',
    department: '',
    role: 'member'
  });
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!selectedUserId && users.length > 0) {
      setSelectedUserId(users[0].uid);
    }
  }, [users, selectedUserId]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsSubmitting(true);

    try {
      const { user } = await AuthService.login(credentials);
      onLogin(user);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsSubmitting(true);

    try {
      const { user } = await AuthService.register(registerData);
      onLogin(user);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUserId) {
      const userToLogin = users.find(u => u.uid === selectedUserId);
      if (userToLogin) {
        onLogin(userToLogin);
      }
    }
  };

  const renderLoginForm = () => (
    <form className="mt-6 space-y-6" onSubmit={handleLogin}>
      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-light-text mb-1">
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={credentials.email}
            onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
            className="appearance-none rounded-md relative block w-full px-3 py-3 border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-accent focus:border-accent focus:z-10 sm:text-sm"
            placeholder="Enter your email"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-light-text mb-1">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            value={credentials.password}
            onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
            className="appearance-none rounded-md relative block w-full px-3 py-3 border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-accent focus:border-accent focus:z-10 sm:text-sm"
            placeholder="Enter your password"
          />
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-accent hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-accent disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Signing In...' : 'Sign In'}
        </button>
      </div>
    </form>
  );

  const renderRegisterForm = () => (
    <form className="mt-6 space-y-6" onSubmit={handleRegister}>
      <div className="space-y-4">
        <div>
          <label htmlFor="reg-name" className="block text-sm font-medium text-light-text mb-1">
            Full Name
          </label>
          <input
            id="reg-name"
            name="displayName"
            type="text"
            required
            value={registerData.displayName}
            onChange={(e) => setRegisterData({ ...registerData, displayName: e.target.value })}
            className="appearance-none rounded-md relative block w-full px-3 py-3 border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-accent focus:border-accent focus:z-10 sm:text-sm"
            placeholder="Enter your full name"
          />
        </div>
        <div>
          <label htmlFor="reg-email" className="block text-sm font-medium text-light-text mb-1">
            Email Address
          </label>
          <input
            id="reg-email"
            name="email"
            type="email"
            required
            value={registerData.email}
            onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
            className="appearance-none rounded-md relative block w-full px-3 py-3 border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-accent focus:border-accent focus:z-10 sm:text-sm"
            placeholder="Enter your email"
          />
        </div>
        <div>
          <label htmlFor="reg-password" className="block text-sm font-medium text-light-text mb-1">
            Password
          </label>
          <input
            id="reg-password"
            name="password"
            type="password"
            required
            value={registerData.password}
            onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
            className="appearance-none rounded-md relative block w-full px-3 py-3 border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-accent focus:border-accent focus:z-10 sm:text-sm"
            placeholder="Create a password"
            minLength={6}
          />
        </div>
        <div>
          <label htmlFor="reg-department" className="block text-sm font-medium text-light-text mb-1">
            Department (Optional)
          </label>
          <input
            id="reg-department"
            name="department"
            type="text"
            value={registerData.department}
            onChange={(e) => setRegisterData({ ...registerData, department: e.target.value })}
            className="appearance-none rounded-md relative block w-full px-3 py-3 border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-accent focus:border-accent focus:z-10 sm:text-sm"
            placeholder="e.g., Engineering, Marketing"
          />
        </div>
        <div>
          <label htmlFor="reg-role" className="block text-sm font-medium text-light-text mb-1">
            Role
          </label>
          <select
            id="reg-role"
            name="role"
            value={registerData.role}
            onChange={(e) => setRegisterData({ ...registerData, role: e.target.value as any })}
            className="appearance-none rounded-md relative block w-full px-3 py-3 border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-accent focus:border-accent focus:z-10 sm:text-sm"
          >
            <option value="member">Member</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-accent hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-accent disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Creating Account...' : 'Create Account'}
        </button>
      </div>
    </form>
  );

  const renderDemoForm = () => (
    <form className="mt-6 space-y-6" onSubmit={handleDemoLogin}>
      <div className="rounded-md shadow-sm">
        <div>
          <label htmlFor="user-select" className="block text-sm font-medium text-light-text mb-1">
            Demo User Profile
          </label>
          <select
            id="user-select"
            name="user"
            required
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="appearance-none rounded-md relative block w-full px-3 py-3 border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-accent focus:border-accent focus:z-10 sm:text-sm"
          >
            {users.map(user => (
              <option key={user.uid} value={user.uid}>
                {user.displayName} ({user.email}) - {user.role}
              </option>
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
          {loading ? 'Logging in...' : 'Demo Login'}
        </button>
      </div>
    </form>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-sidebar p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-[#2d2f31] rounded-2xl shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-white">TaskFlow</h1>
          <h2 className="mt-2 text-center text-md text-subtle-text">
            Enterprise Project Management
          </h2>
        </div>

        {/* Auth Mode Tabs */}
        <div className="flex rounded-lg bg-gray-700 p-1">
          <button
            type="button"
            onClick={() => setAuthMode('login')}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
              authMode === 'login' 
                ? 'bg-accent text-white' 
                : 'text-gray-300 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setAuthMode('register')}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
              authMode === 'register' 
                ? 'bg-accent text-white' 
                : 'text-gray-300 hover:text-white'
            }`}
          >
            Register
          </button>
          <button
            type="button"
            onClick={() => setAuthMode('demo')}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
              authMode === 'demo' 
                ? 'bg-accent text-white' 
                : 'text-gray-300 hover:text-white'
            }`}
          >
            Demo
          </button>
        </div>

        {/* Error Message */}
        {authError && (
          <div className="rounded-md bg-red-900 border border-red-700 p-3">
            <p className="text-sm text-red-200">{authError}</p>
          </div>
        )}

        {/* Auth Forms */}
        {authMode === 'login' && renderLoginForm()}
        {authMode === 'register' && renderRegisterForm()}
        {authMode === 'demo' && renderDemoForm()}

        {/* Footer */}
        <div className="text-center">
          {authMode === 'demo' ? (
            <p className="text-xs text-subtle-text">
              Demo mode - No password required
            </p>
          ) : (
            <p className="text-xs text-subtle-text">
              {authMode === 'login' ? (
                <>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setAuthMode('register')}
                    className="text-accent hover:text-accent-hover font-medium"
                  >
                    Register here
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setAuthMode('login')}
                    className="text-accent hover:text-accent-hover font-medium"
                  >
                    Sign in here
                  </button>
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
