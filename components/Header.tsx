
import React from 'react';
import { User } from '../types';
import { SearchIcon, QuestionMarkCircleIcon } from './icons';

interface TopBarProps {
  user: User | null;
}

const TopBar: React.FC<TopBarProps> = ({ user }) => {
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
                <div className="w-9 h-9 bg-yellow-400 rounded-full flex items-center justify-center font-bold text-white border-2 border-white shadow-sm">
                  {user.displayName.slice(0, 2).toUpperCase()}
                </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopBar;
