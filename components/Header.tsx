import React, { useState, useEffect } from 'react';
import { User, Task } from '../types';
import { SearchIcon, QuestionMarkCircleIcon, ChevronDownIcon, SunIcon, MoonIcon, ClockIcon } from './icons';
import { useTheme } from '../utils/ThemeContext';
import GlobalTimer from './GlobalTimer';

interface TopBarProps {
  user: User | null;
  onLogout?: () => void;
  onOpenSearch?: () => void;
  tasks?: Task[];
  onOpenTask?: (task: Task) => void;
  onOpenTimesheet?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ 
  user, 
  onLogout, 
  onOpenSearch,
  tasks = [],
  onOpenTask,
  onOpenTimesheet
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { theme, isDark, toggleTheme } = useTheme();

  // Global Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (onOpenSearch) onOpenSearch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenSearch]);

  const handleLogout = () => {
    setShowUserMenu(false);
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <header className="bg-main-bg dark:bg-slate-900 flex-shrink-0 border-b border-border-color dark:border-slate-800 transition-colors">
      <div className="mx-auto px-6">
        <div className="flex justify-between items-center h-16 gap-4">
          <div className="flex-1 max-w-md">
            <div 
              onClick={onOpenSearch}
              className="relative w-full cursor-pointer group"
            >
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
              </div>
              <input
                type="text"
                readOnly
                placeholder="Search tasks, projects, assignees (Ctrl+K)..."
                className="block w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 group-hover:border-blue-400 dark:group-hover:border-blue-500 rounded-xl py-2 pl-9 pr-12 text-xs placeholder-gray-400 dark:placeholder-slate-400 cursor-pointer shadow-xs focus:outline-none transition-colors font-medium text-gray-700 dark:text-slate-200"
              />
              <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
                <kbd className="inline-flex items-center border border-gray-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-[10px] font-mono font-medium text-gray-400 dark:text-slate-400 bg-gray-50 dark:bg-slate-900">
                  ⌘K / Ctrl+K
                </kbd>
              </div>
            </div>
          </div>

          {user && (
            <div className="flex items-center space-x-2.5">
              {/* Global Time Tracker Widget */}
              <GlobalTimer
                currentUser={user}
                tasks={tasks}
                onOpenTask={onOpenTask}
                onOpenTimesheet={onOpenTimesheet}
              />

              {/* Timesheets Quick Link */}
              {onOpenTimesheet && (
                <button
                  onClick={onOpenTimesheet}
                  className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-xs font-semibold shadow-xs"
                  title="Workspace Timesheets"
                >
                  <ClockIcon className="w-3.5 h-3.5 text-amber-500" />
                  <span className="hidden md:inline">Timesheets</span>
                </button>
              )}

              {/* Dark Mode Toggle Button */}
              <button
                onClick={toggleTheme}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all text-xs font-semibold shadow-xs"
                title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                aria-label="Toggle theme"
              >
                {isDark ? (
                  <>
                    <SunIcon className="h-4 w-4 text-amber-400" />
                    <span className="hidden sm:inline">Light</span>
                  </>
                ) : (
                  <>
                    <MoonIcon className="h-4 w-4 text-slate-600" />
                    <span className="hidden sm:inline">Dark</span>
                  </>
                )}
              </button>
              
              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 text-dark-text dark:text-slate-200 hover:text-gray-700 dark:hover:text-white focus:outline-none"
                >
                  <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center font-bold text-white border border-white shadow-sm text-xs">
                    {user.displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                </button>

                {/* User Dropdown Menu */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 focus:outline-none z-50 overflow-hidden">
                    <div className="py-1">
                      <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
                        <p className="text-xs font-bold text-gray-900 dark:text-white">{user.displayName}</p>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate">{user.email}</p>
                        <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200">
                          {user.role}
                        </span>
                      </div>
                      
                      <button
                        onClick={toggleTheme}
                        className="flex items-center justify-between w-full px-4 py-2 text-left text-xs text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        <span>Theme: {isDark ? 'Dark Mode' : 'Light Mode'}</span>
                        {isDark ? <SunIcon className="w-3.5 h-3.5 text-amber-400" /> : <MoonIcon className="w-3.5 h-3.5 text-slate-500" />}
                      </button>

                      {onOpenTimesheet && (
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            onOpenTimesheet();
                          }}
                          className="block w-full px-4 py-2 text-left text-xs text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                        >
                          Workspace Timesheets
                        </button>
                      )}
                      
                      <div className="border-t border-gray-100 dark:border-slate-700">
                        <button
                          onClick={handleLogout}
                          className="block w-full px-4 py-2 text-left text-xs text-red-600 dark:text-red-400 font-semibold hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                        >
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Click outside to close menu */}
      {showUserMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowUserMenu(false)}
        />
      )}
    </header>
  );
};

export default TopBar;
