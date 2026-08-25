
import React, { useState } from 'react';
import { Task, User, ColumnId } from '../types';
import TaskCard from './TaskCard';
import { PlusIcon } from './icons';

interface KanbanColumnProps {
  columnId: ColumnId;
  tasks: Task[];
  users: User[];
  allTasks?: Task[];
  onDrop: (e: React.DragEvent<HTMLDivElement>, columnId: ColumnId) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, taskId: string) => void;
  onTaskClick: (task: Task) => void;
  onTaskCreate: (title: string, columnId: ColumnId) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ columnId, tasks, users, allTasks = [], onDrop, onDragStart, onTaskClick, onTaskCreate }) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    onDrop(e, columnId);
    setIsDraggingOver(false);
  };
  
  const handleCreateTask = () => {
      if (newTaskTitle.trim()) {
          onTaskCreate(newTaskTitle.trim(), columnId);
          setNewTaskTitle('');
          setIsAddingTask(false);
      }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex-shrink-0 w-80 bg-slate-100 dark:bg-slate-900 border border-transparent dark:border-slate-800 rounded-xl p-3 transition-colors ${isDraggingOver ? 'bg-slate-200 dark:bg-slate-800 ring-2 ring-blue-400' : ''}`}
    >
      <div className="flex justify-between items-center mb-4 px-1">
        <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200">{columnId}</h3>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 rounded-full px-2 py-0.5">{tasks.length}</span>
      </div>
      <div className="space-y-1 h-full">
        {tasks.sort((a,b) => a.order - b.order).map(task => (
          <TaskCard key={task.id} task={task} users={users} allTasks={allTasks} onDragStart={onDragStart} onClick={onTaskClick} />
        ))}

        {isAddingTask ? (
            <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm">
                <textarea
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleCreateTask())}
                    placeholder="Enter a title for this task..."
                    className="w-full border-none resize-none focus:ring-0 p-1 bg-transparent text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500"
                    autoFocus
                />
                <div className="flex items-center justify-end space-x-2 mt-2">
                     <button onClick={() => setIsAddingTask(false)} className="text-xs font-medium px-3 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300">Cancel</button>
                    <button onClick={handleCreateTask} className="text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-white hover:bg-primary-hover">Add Task</button>
                </div>
            </div>
        ) : (
            <button
              onClick={() => setIsAddingTask(true)}
              className="w-full flex items-center space-x-2 p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-xs font-semibold"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Add a task</span>
            </button>
        )}
      </div>
    </div>
  );
};

export default KanbanColumn;
