
import React, { useState } from 'react';
import { User } from '../types';
import { SearchIcon, QuestionMarkCircleIcon, ChevronDownIcon } from './icons';

interface TopBarProps {
  user: User | null;
  onLogout?: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ user, onLogout }) => {
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = () => {
    setShowUserMenu(false);
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <header className="bg-main-bg flex-shrink-0 border-b border-border-color">
      <div className="mx-auto px-6">
        <div className="flex justify-between items-center h-16">
          <div className="flex-1">
            <div className="relative w-full max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search"
                className="block w-full bg-white border border-gray-300 rounded-md py-2 pl-10 pr-12 text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <kbd className="inline-flex items-center border border-gray-200 rounded px-2 text-sm font-sans font-medium text-gray-400">
                  Ctrl K
                </kbd>
              </div>
            </div>
          </div>
          {user && (
            <div className="flex items-center space-x-4">
              <button className="text-gray-500 hover:text-dark-text">
                <QuestionMarkCircleIcon className="h-6 w-6"/>
              </button>
              
              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 text-dark-text hover:text-gray-700 focus:outline-none"
                >
                  <div className="w-9 h-9 bg-yellow-400 rounded-full flex items-center justify-center font-bold text-white border-2 border-white shadow-sm">
                    {user.displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <ChevronDownIcon className="h-4 w-4" />
                </button>

                {/* User Dropdown Menu */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                    <div className="py-1">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-900">{user.displayName}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                        <p className="text-xs text-gray-400 capitalize">{user.role}</p>
                        {user.department && (
                          <p className="text-xs text-gray-400">{user.department}</p>
                        )}
                      </div>
                      
                      <button
                        onClick={() => setShowUserMenu(false)}
                        className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Profile Settings
                      </button>
                      
                      <button
                        onClick={() => setShowUserMenu(false)}
                        className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Account Settings
                      </button>
                      
                      <button
                        onClick={() => setShowUserMenu(false)}
                        className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Notifications
                      </button>
                      
                      <div className="border-t border-gray-100">
                        <button
                          onClick={handleLogout}
                          className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100"
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
