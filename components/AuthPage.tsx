import React, { useState, useEffect } from 'react';
import { User, AuthCredentials, RegisterData } from '../types';
import { AuthService } from '../services/authService';
import { 
  AsanaLogo, 
  GoogleIcon, 
  EyeIcon, 
  EyeOffIcon, 
  ShieldCheckIcon,
  CheckIcon,
  ChevronRightIcon
} from './icons';

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
    department: 'Engineering',
    role: 'member'
  });
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [showSsoPrompt, setShowSsoPrompt] = useState(false);
  const [ssoDomain, setSsoDomain] = useState('');

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
    } catch (error: any) {
      setAuthError(error.message || 'Login failed. Please check your credentials.');
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
    } catch (error: any) {
      setAuthError(error.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = (userIdToLogin?: string) => {
    const targetId = userIdToLogin || selectedUserId;
    if (targetId) {
      const userToLogin = users.find(u => u.uid === targetId);
      if (userToLogin) {
        onLogin(userToLogin);
      }
    }
  };

  const handleGoogleSignIn = () => {
    // Quick one-click login with first demo user or admin
    if (users.length > 0) {
      onLogin(users[0]);
    }
  };

  const handleSsoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ssoDomain.trim()) return;
    // Auto-match user by domain or fall back to default user
    const matched = users.find(u => u.email.toLowerCase().includes(ssoDomain.toLowerCase().replace('@', '')));
    if (matched) {
      onLogin(matched);
    } else if (users.length > 0) {
      onLogin(users[0]);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#151719] text-[#1E1F21] dark:text-[#F3F4F6] flex flex-col justify-between font-sans selection:bg-[#FCE2E2] selection:text-[#F06A6A]">
      
      {/* Top Asana Navigation Bar */}
      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-gray-200/80 dark:border-slate-800/80 bg-white dark:bg-[#1E1F21]">
        <div className="flex items-center space-x-2.5">
          <AsanaLogo className="w-7 h-7" />
          <span className="text-xl font-bold tracking-tight text-[#1E1F21] dark:text-white font-display">
            asana
          </span>
          <span className="hidden sm:inline-block text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-[#F06A6A] border border-rose-200/60 dark:border-rose-900/50">
            Enterprise
          </span>
        </div>

        <div className="flex items-center space-x-3 text-xs font-semibold">
          {authMode === 'login' ? (
            <div className="flex items-center space-x-2">
              <span className="text-gray-500 dark:text-slate-400 hidden sm:inline">Don't have an account?</span>
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setAuthError(''); }}
                className="px-3.5 py-1.5 rounded-lg border border-gray-300 dark:border-slate-700 text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors font-bold"
              >
                Sign Up
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <span className="text-gray-500 dark:text-slate-400 hidden sm:inline">Already have an account?</span>
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setAuthError(''); }}
                className="px-3.5 py-1.5 rounded-lg border border-gray-300 dark:border-slate-700 text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors font-bold"
              >
                Log In
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-12">
        <div className="w-full max-w-xl bg-white dark:bg-[#1E1F21] rounded-3xl border border-gray-200 dark:border-slate-800 p-6 sm:p-10 shadow-xl shadow-gray-100/50 dark:shadow-none">
            
            {/* Header Titles */}
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs font-bold text-[#F06A6A] tracking-wider uppercase">
                  <span>Work graph platform</span>
                </div>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white mt-1">
                {authMode === 'login' && 'Log in to your workspace'}
                {authMode === 'register' && 'Get started with Asana'}
                {authMode === 'demo' && 'Select a team role to preview'}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-1">
                {authMode === 'login' && 'Connect work across teams, track progress in real time, and hit deadlines.'}
                {authMode === 'register' && 'Join over 100,000+ high-performing teams organizing projects with clarity.'}
                {authMode === 'demo' && 'Switch between Admin, Manager, and Team Member accounts with 1 click.'}
              </p>
            </div>

            {/* Auth Mode Switcher Tabs */}
            <div className="flex p-1 bg-gray-100 dark:bg-slate-800/80 rounded-xl mb-6 border border-gray-200/60 dark:border-slate-700/60 text-xs font-bold">
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setAuthError(''); }}
                className={`flex-1 py-2 px-3 rounded-lg transition-all ${
                  authMode === 'login'
                    ? 'bg-white dark:bg-[#2A2B2D] text-gray-900 dark:text-white shadow-xs'
                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setAuthError(''); }}
                className={`flex-1 py-2 px-3 rounded-lg transition-all ${
                  authMode === 'register'
                    ? 'bg-white dark:bg-[#2A2B2D] text-gray-900 dark:text-white shadow-xs'
                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Sign Up
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('demo'); setAuthError(''); }}
                className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                  authMode === 'demo'
                    ? 'bg-[#F06A6A] text-white shadow-xs'
                    : 'text-[#F06A6A] hover:bg-rose-50 dark:hover:bg-rose-950/40'
                }`}
              >
                <span>⚡ Demo Mode</span>
              </button>
            </div>

            {/* SSO Quick Action Buttons (Login & Register Modes) */}
            {authMode !== 'demo' && (
              <div className="space-y-3 mb-6">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full flex items-center justify-center space-x-3 py-2.5 px-4 rounded-xl border border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-bold text-gray-700 dark:text-slate-200 transition-colors shadow-2xs"
                >
                  <GoogleIcon className="w-4 h-4" />
                  <span>Continue with Google</span>
                </button>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-gray-200 dark:border-slate-800"></div>
                  <span className="shrink-0 mx-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    or with work email
                  </span>
                  <div className="flex-grow border-t border-gray-200 dark:border-slate-800"></div>
                </div>
              </div>
            )}

            {/* Auth Error Banner */}
            {authError && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-start space-x-2.5">
                <div className="w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">!</div>
                <div className="flex-1">{authError}</div>
              </div>
            )}

            {/* LOGIN FORM */}
            {authMode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                    Email address
                  </label>
                  <input
                    type="email"
                    required
                    value={credentials.email}
                    onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
                    placeholder="name@company.com"
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden focus:border-[#F06A6A] focus:ring-2 focus:ring-[#F06A6A]/20 transition-all"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-300">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(true)}
                      className="text-xs font-semibold text-[#F06A6A] hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={credentials.password}
                      onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                      placeholder="Enter your password"
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden focus:border-[#F06A6A] focus:ring-2 focus:ring-[#F06A6A]/20 transition-all pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
                    >
                      {showPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center space-x-2 text-xs text-gray-600 dark:text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded text-[#F06A6A] focus:ring-[#F06A6A] border-gray-300 dark:border-slate-700"
                    />
                    <span>Remember this device</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowSsoPrompt(true)}
                    className="text-xs font-semibold text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 flex items-center space-x-1"
                  >
                    <ShieldCheckIcon className="w-3.5 h-3.5" />
                    <span>Use single sign-on (SSO)</span>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-[#F06A6A] hover:bg-[#E85555] active:bg-[#D44444] text-white font-bold text-xs sm:text-sm shadow-sm hover:shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <span className="flex items-center space-x-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Signing in to Asana...</span>
                    </span>
                  ) : (
                    <span>Log In</span>
                  )}
                </button>
              </form>
            )}

            {/* REGISTER FORM */}
            {authMode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={registerData.displayName}
                    onChange={(e) => setRegisterData({ ...registerData, displayName: e.target.value })}
                    placeholder="e.g. Alex Johnson"
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden focus:border-[#F06A6A] focus:ring-2 focus:ring-[#F06A6A]/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                    Work Email
                  </label>
                  <input
                    type="email"
                    required
                    value={registerData.email}
                    onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                    placeholder="alex@company.com"
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden focus:border-[#F06A6A] focus:ring-2 focus:ring-[#F06A6A]/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                    Create Password (min. 6 chars)
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={registerData.password}
                      onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                      placeholder="Choose a strong password"
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden focus:border-[#F06A6A] focus:ring-2 focus:ring-[#F06A6A]/20 transition-all pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
                    >
                      {showPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                      Department
                    </label>
                    <select
                      value={registerData.department}
                      onChange={(e) => setRegisterData({ ...registerData, department: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-hidden focus:border-[#F06A6A]"
                    >
                      <option value="Engineering">Engineering</option>
                      <option value="Product">Product</option>
                      <option value="Design">Design</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Operations">Operations</option>
                      <option value="Finance">Finance</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                      Workspace Role
                    </label>
                    <select
                      value={registerData.role}
                      onChange={(e) => setRegisterData({ ...registerData, role: e.target.value as any })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-hidden focus:border-[#F06A6A]"
                    >
                      <option value="member">Member</option>
                      <option value="manager">Team Manager</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                </div>

                <p className="text-[11px] text-gray-500 dark:text-slate-400">
                  By signing up, you agree to the Asana Terms of Service and Privacy Policy.
                </p>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-[#F06A6A] hover:bg-[#E85555] active:bg-[#D44444] text-white font-bold text-xs sm:text-sm shadow-sm hover:shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <span className="flex items-center space-x-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Creating Asana Account...</span>
                    </span>
                  ) : (
                    <span>Create Free Account</span>
                  )}
                </button>
              </form>
            )}

            {/* DEMO PERSONA SWITCHER */}
            {authMode === 'demo' && (
              <div className="space-y-4">
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Choose an existing team member persona to explore different role permissions, workflows, and projects:
                </p>

                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {users.map((user) => {
                    const isSelected = selectedUserId === user.uid;
                    const roleColor = 
                      user.role === 'admin' 
                        ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' 
                        : user.role === 'manager'
                        ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                        : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';

                    return (
                      <div
                        key={user.uid}
                        onClick={() => setSelectedUserId(user.uid)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'border-[#F06A6A] bg-rose-50/50 dark:bg-rose-950/30 ring-1 ring-[#F06A6A]'
                            : 'border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-[#F06A6A] text-white flex items-center justify-center font-bold text-sm shadow-2xs shrink-0">
                            {user.displayName ? user.displayName.slice(0, 2).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <p className="text-xs font-bold text-gray-900 dark:text-white">
                                {user.displayName}
                              </p>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${roleColor}`}>
                                {user.role}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-400 dark:text-slate-400 mt-0.5">
                              {user.email} {user.department ? `• ${user.department}` : ''}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDemoLogin(user.uid);
                          }}
                          className="px-3 py-1.5 text-xs font-bold bg-[#F06A6A] hover:bg-[#E85555] text-white rounded-xl shadow-xs transition-colors flex items-center space-x-1 shrink-0"
                        >
                          <span>Log in</span>
                          <ChevronRightIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => handleDemoLogin()}
                    disabled={!selectedUserId || loading}
                    className="w-full py-3 px-4 rounded-xl bg-[#F06A6A] hover:bg-[#E85555] active:bg-[#D44444] text-white font-bold text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center space-x-2"
                  >
                    {loading ? (
                      <span className="flex items-center space-x-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Launching Workspace...</span>
                      </span>
                    ) : (
                      <span>Launch Asana Workspace</span>
                    )}
                  </button>
                </div>
              </div>
            )}
        </div>
      </main>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#1E1F21] rounded-3xl p-6 sm:p-8 border border-gray-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Reset your password</h3>
              <button 
                onClick={() => { setShowForgotModal(false); setForgotSubmitted(false); }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {forgotSubmitted ? (
              <div className="space-y-4 text-center py-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 mx-auto flex items-center justify-center">
                  <CheckIcon className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">Password reset email sent</h4>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  If an account exists for <span className="font-bold text-gray-800 dark:text-slate-200">{forgotEmail}</span>, you will receive password reset instructions shortly.
                </p>
                <button
                  type="button"
                  onClick={() => { setShowForgotModal(false); setForgotSubmitted(false); }}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#F06A6A] hover:bg-[#E85555] text-white font-bold text-xs"
                >
                  Back to login
                </button>
              </div>
            ) : (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (forgotEmail.trim()) setForgotSubmitted(true);
                }} 
                className="space-y-4"
              >
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Enter your account email address and we'll send you a link to reset your password.
                </p>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                    Email address
                  </label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-gray-300 dark:border-slate-700 text-xs font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-4 rounded-xl bg-[#F06A6A] hover:bg-[#E85555] text-white font-bold text-xs"
                  >
                    Send reset link
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* SSO Prompt Modal */}
      {showSsoPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#1E1F21] rounded-3xl p-6 sm:p-8 border border-gray-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <ShieldCheckIcon className="w-5 h-5 text-[#F06A6A]" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Single Sign-On (SSO)</h3>
              </div>
              <button 
                onClick={() => setShowSsoPrompt(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSsoSubmit} className="space-y-4">
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Enter your company's domain or corporate email to be routed to your organization's Identity Provider (Okta, Azure AD, Google Workspace).
              </p>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                  Company Domain or Work Email
                </label>
                <input
                  type="text"
                  required
                  value={ssoDomain}
                  onChange={(e) => setSsoDomain(e.target.value)}
                  placeholder="company.com or name@company.com"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSsoPrompt(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-gray-300 dark:border-slate-700 text-xs font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#F06A6A] hover:bg-[#E85555] text-white font-bold text-xs"
                >
                  Continue with SSO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Asana Footer */}
      <footer className="w-full px-6 py-4 border-t border-gray-200/80 dark:border-slate-800/80 bg-white dark:bg-[#1E1F21] text-[11px] text-gray-500 dark:text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center space-x-4">
          <span>© 2026 Asana, Inc.</span>
          <span className="hover:underline cursor-pointer">Privacy</span>
          <span className="hover:underline cursor-pointer">Terms</span>
          <span className="hover:underline cursor-pointer">Security</span>
          <span className="hover:underline cursor-pointer">Status</span>
        </div>
        <div className="flex items-center space-x-2">
          <span>🌐 English (US)</span>
        </div>
      </footer>

    </div>
  );
};

export default AuthPage;
