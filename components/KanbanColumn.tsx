
import React, { useState } from 'react';
import { Task, User, ColumnId } from '../types';
import TaskCard from './TaskCard';
import { PlusIcon } from './icons';

interface KanbanColumnProps {
  columnId: ColumnId;
  tasks: Task[];
  users: User[];
  onDrop: (e: React.DragEvent<HTMLDivElement>, columnId: ColumnId) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, taskId: string) => void;
  onTaskClick: (task: Task) => void;
  onTaskCreate: (title: string, columnId: ColumnId) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ columnId, tasks, users, onDrop, onDragStart, onTaskClick, onTaskCreate }) => {
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
      className={`flex-shrink-0 w-80 bg-slate-100 rounded-lg p-3 transition-colors ${isDraggingOver ? 'bg-slate-200' : ''}`}
    >
      <div className="flex justify-between items-center mb-4 px-1">
        <h3 className="font-semibold text-slate-700">{columnId}</h3>
        <span className="text-sm text-slate-500 bg-slate-200 rounded-full px-2 py-1">{tasks.length}</span>
      </div>
      <div className="space-y-1 h-full">
        {tasks.sort((a,b) => a.order - b.order).map(task => (
          <TaskCard key={task.id} task={task} users={users} onDragStart={onDragStart} onClick={onTaskClick} />
        ))}

        {isAddingTask ? (
            <div className="bg-white p-2 rounded-md shadow-sm">
                <textarea
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleCreateTask())}
                    placeholder="Enter a title for this task..."
                    className="w-full border-none resize-none focus:ring-0 p-1"
                    autoFocus
                />
                <div className="flex items-center justify-end space-x-2 mt-2">
                     <button onClick={() => setIsAddingTask(false)} className="text-sm px-3 py-1 rounded-md hover:bg-slate-100">Cancel</button>
                    <button onClick={handleCreateTask} className="text-sm px-3 py-1 rounded-md bg-primary text-white hover:bg-primary-hover">Add Task</button>
                </div>
            </div>
        ) : (
            <button
              onClick={() => setIsAddingTask(true)}
              className="w-full flex items-center space-x-2 p-2 rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
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
