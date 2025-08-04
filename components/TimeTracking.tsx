import React, { useState, useEffect } from 'react';
import { Task, User, TimeEntry } from '../types';
import { enhancedApi } from '../services/enhancedApi';
import { PlayIcon, PauseIcon, ClockIcon, PlusIcon } from './icons';

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
  const [manualTime, setManualTime] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    loadTimeEntries();
  }, [task.id]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTracking && currentEntry) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - currentEntry.startTime.getTime()) / 60000);
        setCurrentTime(elapsed);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTracking, currentEntry]);

  const loadTimeEntries = async () => {
    try {
      const entries = await enhancedApi.getTimeEntriesForTask(task.id);
      setTimeEntries(entries);
      
      // Check if there's a running timer
      const runningEntry = entries.find(e => e.isRunning && e.userId === currentUser.uid);
      if (runningEntry) {
        setIsTracking(true);
        setCurrentEntry(runningEntry);
        const elapsed = Math.floor((Date.now() - runningEntry.startTime.getTime()) / 60000);
        setCurrentTime(elapsed);
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
      setCurrentTime(0);
      await loadTimeEntries();
    } catch (error) {
      console.error('Failed to start tracking:', error);
    }
  };

  const stopTracking = async () => {
    if (!currentEntry) return;
    
    try {
      await enhancedApi.stopTimeTracking(currentEntry.id);
      setIsTracking(false);
      setCurrentEntry(null);
      setCurrentTime(0);
      await loadTimeEntries();
      if (onTimeUpdate) {
        onTimeUpdate(task.timeTracked + currentTime);
      }
    } catch (error) {
      console.error('Failed to stop tracking:', error);
    }
  };

  const addManualTime = async () => {
    if (!manualTime) return;
    
    const duration = parseInt(manualTime);
    if (isNaN(duration) || duration <= 0) return;
    
    try {
      await enhancedApi.createTimeEntry(task.id, currentUser.uid, duration, manualDescription);
      setManualTime('');
      setManualDescription('');
      setShowManualEntry(false);
      await loadTimeEntries();
      if (onTimeUpdate) {
        onTimeUpdate(task.timeTracked + duration);
      }
    } catch (error) {
      console.error('Failed to add manual time:', error);
    }
  };

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatTimeShort = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getTotalTime = () => {
    return task.timeTracked + (isTracking ? currentTime : 0);
  };

  const getTimeProgress = () => {
    if (!task.estimatedTime) return 0;
    return Math.min((getTotalTime() / task.estimatedTime) * 100, 100);
  };

  return (
    <div className="space-y-4">
      {/* Current Tracking Status */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <ClockIcon className="w-5 h-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-900">Time Tracking</span>
          </div>
          <button
            onClick={() => setShowManualEntry(!showManualEntry)}
            className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-sm"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Add Time</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {formatTime(getTotalTime())}
            </div>
            <div className="text-sm text-gray-500">Total tracked</div>
          </div>
          {task.estimatedTime && (
            <div>
              <div className="text-lg font-semibold text-gray-700">
                {formatTime(task.estimatedTime)}
              </div>
              <div className="text-sm text-gray-500">Estimated</div>
              <div className="mt-1">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${getTimeProgress() > 100 ? 'bg-red-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(getTimeProgress(), 100)}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {getTimeProgress().toFixed(0)}% of estimate
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Timer Controls */}
        <div className="flex items-center space-x-3">
          {isTracking ? (
            <>
              <button
                onClick={stopTracking}
                className="flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
              >
                <PauseIcon className="w-4 h-4" />
                <span>Stop ({formatTimeShort(currentTime)})</span>
              </button>
              <div className="text-sm text-gray-600">
                Timer running for {formatTimeShort(currentTime)}
              </div>
            </>
          ) : (
            <button
              onClick={startTracking}
              className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
            >
              <PlayIcon className="w-4 h-4" />
              <span>Start Timer</span>
            </button>
          )}
        </div>
      </div>

      {/* Manual Time Entry */}
      {showManualEntry && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Add Manual Time</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time (minutes)
              </label>
              <input
                type="number"
                value={manualTime}
                onChange={(e) => setManualTime(e.target.value)}
                placeholder="e.g., 30"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                value={manualDescription}
                onChange={(e) => setManualDescription(e.target.value)}
                placeholder="What did you work on?"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex space-x-2">
              <button
                onClick={addManualTime}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
              >
                Add Time
              </button>
              <button
                onClick={() => setShowManualEntry(false)}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time Entries List */}
      {timeEntries.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-4 py-3 border-b border-gray-200">
            <h4 className="font-medium text-gray-900">Time Entries</h4>
          </div>
          <div className="divide-y divide-gray-200">
            {timeEntries
              .filter(entry => !entry.isRunning)
              .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
              .map(entry => (
                <div key={entry.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">
                        {formatTime(entry.duration)}
                      </div>
                      {entry.description && (
                        <div className="text-sm text-gray-600 mt-1">
                          {entry.description}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(entry.startTime).toLocaleDateString()} at{' '}
                        {new Date(entry.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeTracking;