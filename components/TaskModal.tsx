import React, { useState, useEffect, useCallback } from 'react';
import { Task, Comment, User } from '../types';
import { enhancedApi } from '../services/enhancedApi';
import TimeTracking from './TimeTracking';
import ApprovalModal from './ApprovalModal';
import { XIcon, CalendarIcon, UserIcon, ClockIcon, CheckCircleIcon } from './icons';

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
  const [startDate, setStartDate] = useState(task.startDate ? task.startDate.toISOString().split('T')[0] : '');
  const [priority, setPriority] = useState(task.priority || 'medium');
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'time' | 'comments' | 'approvals'>('details');
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  useEffect(() => {
    enhancedApi.getCommentsForTask(task.id).then(setComments);
    const unsubscribe = enhancedApi.subscribeToComments(task.id, setComments);
    return () => unsubscribe();
  }, [task.id]);

  const handleUpdate = (updates: Partial<Task>) => {
    onUpdateTask(task.id, updates);
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim() && !isCommenting) {
      setIsCommenting(true);
      await enhancedApi.addComment(task.id, currentUser.uid, newComment.trim());
      setNewComment('');
      setIsCommenting(false);
    }
  };
  
  const getUserDisplayName = useCallback((userId: string) => {
    return users.find(u => u.uid === userId)?.displayName || 'Unknown User';
  }, [users]);

  const handleApprovalSubmitted = () => {
    // Refresh the task data after approval submission
    setShowApprovalModal(false);
    // In a real application, we would reload the task data here
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => handleUpdate({ title })}
            className="w-full text-2xl font-bold bg-transparent focus:outline-none focus:bg-gray-50 rounded px-2 py-1 -m-2"
            placeholder="Task Title"
          />
          
          {/* Tabs */}
          <div className="flex space-x-4 mt-4 border-b">
            <button
              onClick={() => setActiveTab('details')}
              className={`pb-2 border-b-2 ${activeTab === 'details' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('time')}
              className={`pb-2 border-b-2 ${activeTab === 'time' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}
            >
              Time Tracking
            </button>
            <button
              onClick={() => setActiveTab('comments')}
              className={`pb-2 border-b-2 ${activeTab === 'comments' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}
            >
              Comments ({comments.length})
            </button>
            <button
              onClick={() => setActiveTab('approvals')}
              className={`pb-2 border-b-2 ${activeTab === 'approvals' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}
            >
              Approvals {task.approval && (
                <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                  task.approval.status === 'approved' ? 'bg-green-100 text-green-800' :
                  task.approval.status === 'rejected' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {task.approval.status}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex-grow overflow-y-auto">
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Task Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Assignee */}
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <UserIcon className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  <div className="flex-grow">
                    <label htmlFor="assignee" className="block text-xs font-medium text-gray-500">Assignee</label>
                    <select
                      id="assignee"
                      value={assigneeId || ''}
                      onChange={(e) => {
                          const newId = e.target.value || null;
                          setAssigneeId(newId);
                          handleUpdate({ assigneeId: newId });
                      }}
                      className="w-full bg-transparent text-sm font-semibold text-gray-800 focus:outline-none border-none"
                    >
                      <option value="">Unassigned</option>
                      {users.map(user => <option key={user.uid} value={user.uid}>{user.displayName}</option>)}
                    </select>
                  </div>
                </div>

                {/* Priority */}
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-5 h-5 flex-shrink-0">
                    <div className={`w-full h-full rounded ${
                      priority === 'critical' ? 'bg-red-500' :
                      priority === 'high' ? 'bg-orange-500' :
                      priority === 'medium' ? 'bg-blue-500' :
                      'bg-gray-500'
                    }`}></div>
                  </div>
                  <div className="flex-grow">
                    <label htmlFor="priority" className="block text-xs font-medium text-gray-500">Priority</label>
                    <select
                      id="priority"
                      value={priority}
                      onChange={(e) => {
                          setPriority(e.target.value as any);
                          handleUpdate({ priority: e.target.value as any });
                      }}
                      className="w-full bg-transparent text-sm font-semibold text-gray-800 focus:outline-none border-none"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>

                {/* Start Date */}
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <CalendarIcon className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  <div className="flex-grow">
                    <label htmlFor="startDate" className="block text-xs font-medium text-gray-500">Start Date</label>
                    <input
                       type="date"
                       id="startDate"
                       value={startDate}
                       onChange={(e) => {
                           setStartDate(e.target.value);
                           handleUpdate({ startDate: e.target.value ? new Date(e.target.value) : null });
                       }}
                       className="w-full bg-transparent text-sm font-semibold text-gray-800 focus:outline-none border-none p-0"
                    />
                  </div>
                </div>

                {/* Due Date */}
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <CalendarIcon className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  <div className="flex-grow">
                    <label htmlFor="dueDate" className="block text-xs font-medium text-gray-500">Due Date</label>
                    <input
                       type="date"
                       id="dueDate"
                       value={dueDate}
                       onChange={(e) => {
                           setDueDate(e.target.value);
                           handleUpdate({ dueDate: e.target.value ? new Date(e.target.value) : null });
                       }}
                       className="w-full bg-transparent text-sm font-semibold text-gray-800 focus:outline-none border-none p-0"
                    />
                  </div>
                </div>
              </div>

              {/* Time Summary */}
              {task.timeTracked > 0 && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <ClockIcon className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">
                      Total time tracked: {Math.floor(task.timeTracked / 60)}h {task.timeTracked % 60}m
                    </span>
                  </div>
                  {task.estimatedTime && (
                    <div className="mt-2">
                      <div className="flex justify-between text-sm text-blue-700">
                        <span>Progress</span>
                        <span>{Math.round((task.timeTracked / task.estimatedTime) * 100)}%</span>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-2 mt-1">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${Math.min((task.timeTracked / task.estimatedTime) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Description */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Description</h3>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => handleUpdate({ description })}
                  className="w-full h-32 p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Add a more detailed description..."
                />
              </div>
            </div>
          )}

          {activeTab === 'time' && (
            <TimeTracking
              task={task}
              currentUser={currentUser}
              onTimeUpdate={(newTime) => handleUpdate({ timeTracked: newTime })}
            />
          )}

          {activeTab === 'comments' && (
            <div className="space-y-6">
              <div className="space-y-4">
                {comments.map(comment => (
                  <div key={comment.id} className="flex items-start space-x-3">
                    <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                      {getUserDisplayName(comment.userId).charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="bg-gray-50 p-3 rounded-lg rounded-tl-none">
                        <p className="font-semibold text-gray-700 text-sm">{getUserDisplayName(comment.userId)}</p>
                        <p className="text-gray-600 mt-1">{comment.text}</p>
                      </div>
                       <p className="text-xs text-gray-400 mt-1">{new Date(comment.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleCommentSubmit} className="flex items-start space-x-3">
                 <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {currentUser.displayName.charAt(0)}
                 </div>
                <div className="flex-1">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Add a comment..."
                    rows={2}
                  />
                  <button
                    type="submit"
                    disabled={!newComment.trim() || isCommenting}
                    className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {isCommenting ? 'Saving...' : 'Add Comment'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'approvals' && (
            <div className="space-y-6">
              {task.approval ? (
                /* Display existing approval request */
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">Approval Status</h4>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        task.approval.status === 'approved' ? 'bg-green-100 text-green-800' :
                        task.approval.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {task.approval.status.charAt(0).toUpperCase() + task.approval.status.slice(1)}
                      </span>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <p><strong>Requested by:</strong> {getUserDisplayName(task.approval.requestedBy)}</p>
                      <p><strong>Type:</strong> {task.approval.approvalType.replace('_', ' ')}</p>
                      <p><strong>Created:</strong> {new Date(task.approval.createdAt).toLocaleString()}</p>
                      {task.approval.dueDate && (
                        <p><strong>Due:</strong> {new Date(task.approval.dueDate).toLocaleString()}</p>
                      )}
                      {task.approval.description && (
                        <p><strong>Reason:</strong> {task.approval.description}</p>
                      )}
                      {task.approval.estimatedValue && (
                        <p><strong>Estimated Value:</strong> ${task.approval.estimatedValue.toLocaleString()}</p>
                      )}
                    </div>
                  </div>

                  {/* Approvers List */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Approvers ({task.approval.approvals.length}/{task.approval.approvers.length})</h4>
                    <div className="space-y-2">
                      {task.approval.approvers.map((approverId) => {
                        const approval = task.approval.approvals.find(a => a.userId === approverId);
                        const user = users.find(u => u.uid === approverId);
                        
                        return (
                          <div key={approverId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                {user ? user.displayName.slice(0, 2).toUpperCase() : '??'}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {user ? user.displayName : 'Unknown User'}
                                </p>
                                <p className="text-xs text-gray-500">{user?.role}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {approval ? (
                                <>
                                  {approval.status === 'approved' ? (
                                    <CheckCircleIcon className="w-5 h-5 text-green-500" />
                                  ) : (
                                    <XIcon className="w-5 h-5 text-red-500" />
                                  )}
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    approval.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                  }`}>
                                    {approval.status}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <ClockIcon className="w-4 h-4 text-gray-400" />
                                  <span className="text-xs text-gray-500">Pending</span>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Approval History */}
                  {task.approval.approvals.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Approval History</h4>
                      <div className="space-y-3">
                        {task.approval.approvals.map((approval, index) => (
                          <div key={index} className="border-l-4 border-blue-200 pl-4 pb-3">
                            <div className="flex items-center space-x-2 mb-1">
                              {approval.status === 'approved' ? (
                                <CheckCircleIcon className="w-4 h-4 text-green-500" />
                              ) : (
                                <XIcon className="w-4 h-4 text-red-500" />
                              )}
                              <span className="text-sm font-medium">{getUserDisplayName(approval.userId)}</span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                approval.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {approval.status}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(approval.timestamp).toLocaleString()}
                              </span>
                            </div>
                            {approval.comment && (
                              <p className="text-sm text-gray-600 ml-6">{approval.comment}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => setShowApprovalModal(true)}
                    className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Manage Approval
                  </button>
                </div>
              ) : (
                /* No approval request exists */
                <div className="text-center py-8">
                  <ClockIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">No Approval Request</h4>
                  <p className="text-gray-600 mb-4">This task does not have an approval request.</p>
                  <button
                    onClick={() => setShowApprovalModal(true)}
                    className="py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Request Approval
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800">
          <XIcon className="w-6 h-6" />
        </button>
      </div>

      {/* Approval Modal */}
      {showApprovalModal && (
        <ApprovalModal
          task={task}
          currentUser={currentUser}
          users={users}
          onClose={() => setShowApprovalModal(false)}
          onApprovalSubmitted={handleApprovalSubmitted}
        />
      )}
    </div>
  );
};

export default TaskModal;
