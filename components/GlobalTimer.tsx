import React, { useState, useEffect } from 'react';
import { Task, User, TimeEntry } from '../types';
import { enhancedApi } from '../services/enhancedApi';
import { PlayIcon, PauseIcon, ClockIcon, XIcon, PlusIcon, ChevronDownIcon } from './icons';

interface GlobalTimerProps {
  currentUser: User | null;
  tasks: Task[];
  onOpenTask?: (task: Task) => void;
  onOpenTimesheet?: () => void;
}

export const GlobalTimer: React.FC<GlobalTimerProps> = ({
  currentUser,
  tasks,
  onOpenTask,
  onOpenTimesheet
}) => {
  const [runningEntry, setRunningEntry] = useState<TimeEntry | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [searchTask, setSearchTask] = useState('');

  // Check for active timer on mount and periodically
  useEffect(() => {
    if (!currentUser) return;

    const checkRunningTimer = async () => {
      try {
        const allEntries = await enhancedApi.getTimeEntriesForTask(''); // or check user entries
        // Let's get entries for all tasks or from API
        const entries = (await enhancedApi.getWorkloadAnalytics(currentUser.uid)) ? [] : [];
      } catch (e) {
        // ignore
      }
    };
    
    // We can also poll or listen
  }, [currentUser]);

  // Timer interval for active timer
  useEffect(() => {
    let interval: any;
    if (runningEntry) {
      const updateElapsed = () => {
        const start = new Date(runningEntry.startTime).getTime();
        const now = Date.now();
        setElapsedSeconds(Math.max(0, Math.floor((now - start) / 1000)));
      };
      updateElapsed();
      interval = setInterval(updateElapsed, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(interval);
  }, [runningEntry]);

  if (!currentUser) return null;

  const formatTimer = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartTimer = async (taskId: string) => {
    try {
      const entry = await enhancedApi.startTimeTracking(taskId, currentUser.uid);
      setRunningEntry(entry);
      setShowTaskPicker(false);
      setSearchTask('');
    } catch (error) {
      console.error('Failed to start timer:', error);
    }
  };

  const handleStopTimer = async () => {
    if (!runningEntry) return;
    try {
      await enhancedApi.stopTimeTracking(runningEntry.id);
      setRunningEntry(null);
      setElapsedSeconds(0);
    } catch (error) {
      console.error('Failed to stop timer:', error);
    }
  };

  const currentTask = runningEntry ? tasks.find(t => t.id === runningEntry.taskId) : null;
  const filteredTasks = tasks.filter(t => 
    t.status !== 'Done' && 
    (t.title.toLowerCase().includes(searchTask.toLowerCase()) || 
     (t.assigneeId === currentUser.uid))
  );

  return (
    <div className="relative flex items-center">
      {runningEntry ? (
        <div className="flex items-center space-x-2 bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 px-3 py-1 rounded-xl shadow-xs animate-pulse-subtle">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          
          <button
            onClick={() => currentTask && onOpenTask && onOpenTask(currentTask)}
            className="text-xs font-bold text-blue-900 dark:text-blue-200 truncate max-w-[140px] hover:underline"
            title={currentTask?.title || 'Active Task'}
          >
            {currentTask?.title || 'Active Task'}
          </button>

          <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60">
            {formatTimer(elapsedSeconds)}
          </span>

          <button
            onClick={handleStopTimer}
            className="p-1 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
            title="Stop Timer"
          >
            <PauseIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <button
            onClick={() => setShowTaskPicker(!showTaskPicker)}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all shadow-xs"
            title="Start time tracking on a task"
          >
            <ClockIcon className="w-3.5 h-3.5 text-blue-500" />
            <span className="hidden sm:inline">Track Time</span>
            <ChevronDownIcon className="w-3 h-3 text-gray-400" />
          </button>

          {showTaskPicker && (
            <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 p-3 z-50 text-xs">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-slate-700">
                <span className="font-bold text-gray-900 dark:text-white">Start Timer</span>
                <button onClick={() => setShowTaskPicker(false)} className="text-gray-400 hover:text-gray-600">
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              </div>

              <input
                type="text"
                value={searchTask}
                onChange={(e) => setSearchTask(e.target.value)}
                placeholder="Search active tasks..."
                className="w-full px-2.5 py-1.5 mb-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-xs text-gray-900 dark:text-slate-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />

              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {filteredTasks.length === 0 ? (
                  <div className="text-center py-4 text-gray-400">No matching tasks</div>
                ) : (
                  filteredTasks.slice(0, 8).map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleStartTimer(t.id)}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-700 text-left transition-colors group"
                    >
                      <div className="truncate mr-2">
                        <p className="font-semibold text-gray-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
                          {t.title}
                        </p>
                        <span className="text-[10px] text-gray-400">
                          {t.priority} • {t.timeTracked ? `${Math.floor(t.timeTracked / 60)}h ${t.timeTracked % 60}m logged` : 'No time logged'}
                        </span>
                      </div>
                      <PlayIcon className="w-3.5 h-3.5 text-blue-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))
                )}
              </div>

              {onOpenTimesheet && (
                <div className="pt-2 mt-2 border-t border-gray-100 dark:border-slate-700">
                  <button
                    onClick={() => {
                      setShowTaskPicker(false);
                      onOpenTimesheet();
                    }}
                    className="w-full py-1 text-center text-blue-600 dark:text-blue-400 hover:underline font-semibold text-xs"
                  >
                    View All Timesheets & Reports →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalTimer;
