import React, { useState, useEffect } from 'react';
import { Task, User, TimeEntry } from '../types';
import { enhancedApi } from '../services/enhancedApi';
import { PlayIcon, PauseIcon, ClockIcon, PlusIcon, TrashIcon, CheckIcon, DollarSignIcon } from './icons';

interface TimeTrackingProps {
  task: Task;
  currentUser: User;
  onTimeUpdate?: (newTime: number) => void;
}

const TimeTracking: React.FC<TimeTrackingProps> = ({ task, currentUser, onTimeUpdate }) => {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<TimeEntry | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualMinutes, setManualMinutes] = useState('30');
  const [manualHours, setManualHours] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualCategory, setManualCategory] = useState<TimeEntry['category']>('Development');
  const [manualIsBillable, setManualIsBillable] = useState(true);
  const [currentTimeSeconds, setCurrentTimeSeconds] = useState(0);

  useEffect(() => {
    loadTimeEntries();
  }, [task.id]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTracking && currentEntry) {
      interval = setInterval(() => {
        const elapsedSecs = Math.floor((Date.now() - new Date(currentEntry.startTime).getTime()) / 1000);
        setCurrentTimeSeconds(elapsedSecs);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTracking, currentEntry]);

  const loadTimeEntries = async () => {
    try {
      const entries = await enhancedApi.getTimeEntriesForTask(task.id);
      setTimeEntries(entries);
      
      // Check if there's a running timer for this task
      const runningEntry = entries.find(e => e.isRunning && e.userId === currentUser.uid);
      if (runningEntry) {
        setIsTracking(true);
        setCurrentEntry(runningEntry);
        const elapsedSecs = Math.floor((Date.now() - new Date(runningEntry.startTime).getTime()) / 1000);
        setCurrentTimeSeconds(elapsedSecs);
      } else {
        setIsTracking(false);
        setCurrentEntry(null);
      }
    } catch (error) {
      console.error('Failed to load time entries:', error);
    }
  };

  const startTracking = async () => {
    try {
      const entry = await enhancedApi.startTimeTracking(task.id, currentUser.uid);
      setCurrentEntry(entry);
      setIsTracking(true);
      setCurrentTimeSeconds(0);
      await loadTimeEntries();
    } catch (error) {
      console.error('Failed to start tracking:', error);
    }
  };

  const stopTracking = async () => {
    if (!currentEntry) return;
    try {
      const stopped = await enhancedApi.stopTimeTracking(currentEntry.id);
      setIsTracking(false);
      setCurrentEntry(null);
      setCurrentTimeSeconds(0);
      await loadTimeEntries();
      if (onTimeUpdate) {
        onTimeUpdate((task.timeTracked || 0) + (stopped.duration || 0));
      }
    } catch (error) {
      console.error('Failed to stop tracking:', error);
    }
  };

  const addManualTime = async () => {
    const h = parseInt(manualHours || '0', 10);
    const m = parseInt(manualMinutes || '0', 10);
    const duration = h * 60 + m;
    if (isNaN(duration) || duration <= 0) return;
    
    try {
      const created = await enhancedApi.createTimeEntry(task.id, currentUser.uid, duration, manualDescription);
      created.category = manualCategory;
      created.isBillable = manualIsBillable;
      
      setManualHours('');
      setManualMinutes('30');
      setManualDescription('');
      setShowManualEntry(false);
      await loadTimeEntries();
      if (onTimeUpdate) {
        onTimeUpdate((task.timeTracked || 0) + duration);
      }
    } catch (error) {
      console.error('Failed to add manual time:', error);
    }
  };

  const handleDeleteEntry = (entryId: string) => {
    setTimeEntries(prev => prev.filter(e => e.id !== entryId));
  };

  const formatMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const formatTimerClock = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTotalTime = () => {
    const liveMins = isTracking ? Math.floor(currentTimeSeconds / 60) : 0;
    return (task.timeTracked || 0) + liveMins;
  };

  const getTimeProgress = () => {
    if (!task.estimatedTime || task.estimatedTime <= 0) return 0;
    return Math.min((getTotalTime() / task.estimatedTime) * 100, 100);
  };

  const isOverBudget = task.estimatedTime && getTotalTime() > task.estimatedTime;

  return (
    <div className="space-y-4 text-xs">
      {/* Time Tracking Overview Card */}
      <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4 border border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <ClockIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="font-bold text-gray-900 dark:text-white">Time Tracking & Budget</span>
          </div>
          <button
            onClick={() => setShowManualEntry(!showManualEntry)}
            className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 font-bold"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            <span>{showManualEntry ? 'Cancel' : 'Log Time'}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <span className="text-[11px] text-gray-500 dark:text-slate-400 font-medium">Actual Logged</span>
            <div className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">
              {formatMinutes(getTotalTime())}
            </div>
            {isTracking && (
              <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Timer active ({formatTimerClock(currentTimeSeconds)})</span>
              </span>
            )}
          </div>

          <div>
            <span className="text-[11px] text-gray-500 dark:text-slate-400 font-medium">Estimated Budget</span>
            <div className="text-2xl font-bold text-gray-700 dark:text-slate-300 mt-0.5">
              {task.estimatedTime ? formatMinutes(task.estimatedTime) : '—'}
            </div>
            {task.estimatedTime ? (
              <div className="mt-1">
                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className={`h-1.5 rounded-full transition-all ${isOverBudget ? 'bg-red-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(getTimeProgress(), 100)}%` }}
                  />
                </div>
                <div className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5 font-medium flex justify-between">
                  <span>{getTimeProgress().toFixed(0)}% used</span>
                  <span>{isOverBudget ? '⚠️ Over budget' : `${formatMinutes(Math.max(0, task.estimatedTime - getTotalTime()))} left`}</span>
                </div>
              </div>
            ) : (
              <span className="text-[10px] text-gray-400">No estimated time set</span>
            )}
          </div>
        </div>

        {/* Live Timer Control Bar */}
        <div className="flex items-center space-x-3 pt-3 border-t border-gray-200/80 dark:border-slate-700">
          {isTracking ? (
            <button
              onClick={stopTracking}
              className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl font-bold shadow-xs transition-colors"
            >
              <PauseIcon className="w-4 h-4" />
              <span>Stop Timer ({formatTimerClock(currentTimeSeconds)})</span>
            </button>
          ) : (
            <button
              onClick={startTracking}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold shadow-xs transition-colors"
            >
              <PlayIcon className="w-4 h-4" />
              <span>Start Live Timer</span>
            </button>
          )}
        </div>
      </div>

      {/* Manual Time Entry Form */}
      {showManualEntry && (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
          <h4 className="font-bold text-gray-900 dark:text-white">Log Work Time Manually</h4>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 mb-1">
                Hours
              </label>
              <input
                type="number"
                min="0"
                value={manualHours}
                onChange={(e) => setManualHours(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-medium"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 mb-1">
                Minutes
              </label>
              <input
                type="number"
                min="0"
                max="59"
                value={manualMinutes}
                onChange={(e) => setManualMinutes(e.target.value)}
                placeholder="30"
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-medium"
              />
            </div>
          </div>

          {/* Quick preset buttons */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] text-gray-400 font-medium">Quick presets:</span>
            {[
              { label: '+15m', h: 0, m: 15 },
              { label: '+30m', h: 0, m: 30 },
              { label: '+1h', h: 1, m: 0 },
              { label: '+2h', h: 2, m: 0 }
            ].map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => { setManualHours(p.h ? p.h.toString() : ''); setManualMinutes(p.m.toString()); }}
                className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 text-[10px] font-bold hover:bg-gray-200"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                value={manualCategory}
                onChange={(e) => setManualCategory(e.target.value as any)}
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-medium"
              >
                {['Development', 'Design', 'Review', 'Meeting', 'Testing', 'Bugfix', 'Other'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center space-x-2 pt-6 cursor-pointer">
                <input
                  type="checkbox"
                  checked={manualIsBillable}
                  onChange={(e) => setManualIsBillable(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 border-gray-300 dark:border-slate-700"
                />
                <span className="font-bold text-gray-800 dark:text-slate-200">Billable client work</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 mb-1">
              Work Description
            </label>
            <input
              type="text"
              value={manualDescription}
              onChange={(e) => setManualDescription(e.target.value)}
              placeholder="What specifically was worked on?"
              className="w-full px-3 py-1.5 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 font-medium"
            />
          </div>

          <div className="flex space-x-2 pt-1">
            <button
              onClick={addManualTime}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-xl font-bold transition-colors"
            >
              Add Time Log
            </button>
            <button
              onClick={() => setShowManualEntry(false)}
              className="bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 text-gray-700 dark:text-slate-200 px-3 py-1.5 rounded-xl font-semibold transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Time Entries History */}
      {timeEntries.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/40">
            <h4 className="font-bold text-gray-900 dark:text-white">Logged History ({timeEntries.length})</h4>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-slate-700/60 max-h-48 overflow-y-auto">
            {timeEntries
              .filter(entry => !entry.isRunning)
              .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
              .map(entry => (
                <div key={entry.id} className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-750 transition-colors">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-gray-900 dark:text-white font-mono">
                        {formatMinutes(entry.duration)}
                      </span>
                      {entry.category && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                          {entry.category}
                        </span>
                      )}
                      {entry.isBillable !== false && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                          $ Billable
                        </span>
                      )}
                    </div>
                    {entry.description && (
                      <p className="text-gray-600 dark:text-slate-300 mt-0.5 truncate max-w-sm">
                        {entry.description}
                      </p>
                    )}
                    <span className="text-[10px] text-gray-400 mt-0.5 block">
                      {new Date(entry.startTime).toLocaleDateString()} at {new Date(entry.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <button
                    onClick={() => handleDeleteEntry(entry.id)}
                    className="p-1 rounded text-gray-400 hover:text-red-600 transition-colors"
                    title="Delete entry"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeTracking;
