import React, { useState, useEffect, useCallback } from 'react';
import { Task, Comment, User } from '../types';
import { mockApi } from '../services/mockApi';
import { XIcon, CalendarIcon, UserIcon } from './icons';

interface TaskModalProps {
  task: Task;
  users: User[];
  currentUser: User;
  onClose: () => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
}

const TaskModal: React.FC<TaskModalProps> = ({ task, users, currentUser, onClose, onUpdateTask }) => {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [assigneeId, setAssigneeId] = useState(task.assigneeId);
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.toISOString().split('T')[0] : '');
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);

  useEffect(() => {
    mockApi.getCommentsForTask(task.id).then(setComments);
    const unsubscribe = mockApi.subscribeToComments(task.id, setComments);
    return () => unsubscribe();
  }, [task.id]);

  const handleUpdate = (updates: Partial<Task>) => {
    onUpdateTask(task.id, updates);
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim() && !isCommenting) {
      setIsCommenting(true);
      await mockApi.addComment(task.id, currentUser.uid, newComment.trim());
      setNewComment('');
      setIsCommenting(false);
    }
  };
  
  const getUserDisplayName = useCallback((userId: string) => {
    return users.find(u => u.uid === userId)?.displayName || 'Unknown User';
  }, [users]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-50 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => handleUpdate({ title })}
            className="w-full text-2xl font-bold bg-transparent focus:outline-none focus:bg-white rounded px-2 py-1 -m-2"
            placeholder="Task Title"
          />
        </div>

        <div className="p-6 flex-grow overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
             <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-slate-200">
               <UserIcon className="w-5 h-5 text-slate-500 flex-shrink-0" />
               <div className="flex-grow">
                  <label htmlFor="assignee" className="block text-xs font-medium text-slate-500">Assignee</label>
                  <select
                    id="assignee"
                    value={assigneeId || ''}
                    onChange={(e) => {
                        const newId = e.target.value || null;
                        setAssigneeId(newId);
                        handleUpdate({ assigneeId: newId });
                    }}
                    className="w-full bg-transparent text-sm font-semibold text-slate-800 focus:outline-none -ml-1 border-none"
                  >
                    <option value="">Unassigned</option>
                    {users.map(user => <option key={user.uid} value={user.uid}>{user.displayName}</option>)}
                  </select>
               </div>
             </div>
             <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-slate-200">
               <CalendarIcon className="w-5 h-5 text-slate-500 flex-shrink-0" />
               <div className="flex-grow">
                 <label htmlFor="dueDate" className="block text-xs font-medium text-slate-500">Due Date</label>
                 <input
                    type="date"
                    id="dueDate"
                    value={dueDate}
                    onChange={(e) => {
                        setDueDate(e.target.value);
                        handleUpdate({ dueDate: e.target.value ? new Date(e.target.value) : null });
                    }}
                    className="w-full bg-transparent text-sm font-semibold text-slate-800 focus:outline-none border-none p-0"
                 />
               </div>
             </div>
          </div>
          
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Description</h3>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => handleUpdate({ description })}
            className="w-full h-32 p-2 border rounded-md focus:ring-primary focus:border-primary"
            placeholder="Add a more detailed description..."
          />
          
          <h3 className="text-lg font-semibold text-slate-800 mt-6 mb-4">Activity</h3>
          <div className="space-y-4">
            {comments.map(comment => (
              <div key={comment.id} className="flex items-start space-x-3">
                <div className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                  {getUserDisplayName(comment.userId).charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="bg-white p-3 rounded-lg rounded-tl-none border">
                    <p className="font-semibold text-slate-700 text-sm">{getUserDisplayName(comment.userId)}</p>
                    <p className="text-slate-600">{comment.text}</p>
                  </div>
                   <p className="text-xs text-slate-400 mt-1">{new Date(comment.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleCommentSubmit} className="mt-6 flex items-start space-x-3">
             <div className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm flex-shrink-0">
                {currentUser.displayName.charAt(0)}
             </div>
            <div className="flex-1">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="w-full p-2 border rounded-md focus:ring-primary focus:border-primary"
                placeholder="Add a comment..."
                rows={2}
              />
              <button
                type="submit"
                disabled={!newComment.trim() || isCommenting}
                className="mt-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                {isCommenting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>

        <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-slate-800">
          <XIcon className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

export default TaskModal;
