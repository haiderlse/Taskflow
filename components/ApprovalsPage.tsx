import React, { useState, useEffect } from 'react';
import { ApprovalRequest, User } from '../types';
import { ApprovalService } from '../services/approvalService';
import { enhancedApi } from '../services/enhancedApi';
import { ClockIcon, CheckCircleIcon, XIcon } from './icons';

interface ApprovalsPageProps {
  currentUser: User;
  users: User[];
}

const ApprovalsPage: React.FC<ApprovalsPageProps> = ({ currentUser, users }) => {
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [approvalComment, setApprovalComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadPendingApprovals();
  }, [currentUser]);

  const loadPendingApprovals = async () => {
    setLoading(true);
    try {
      const approvals = await ApprovalService.getApprovalRequestsForUser(currentUser.uid);
      setPendingApprovals(approvals);
    } catch (error) {
      console.error('Failed to load pending approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprovalResponse = async (
    approvalId: string, 
    status: 'approved' | 'rejected'
  ) => {
    setIsSubmitting(true);
    try {
      await ApprovalService.submitApproval(
        approvalId,
        currentUser.uid,
        status,
        approvalComment
      );
      
      // Refresh the list
      await loadPendingApprovals();
      setSelectedApproval(null);
      setApprovalComment('');
    } catch (error) {
      console.error('Failed to submit approval:', error);
      alert('Failed to submit approval: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUserName = (userId: string): string => {
    const user = users.find(u => u.uid === userId);
    return user ? user.displayName : 'Unknown User';
  };

  const getTaskInfo = async (taskId: string) => {
    try {
      const task = await enhancedApi.getTaskById(taskId);
      return task;
    } catch (error) {
      console.error('Failed to get task info:', error);
      return null;
    }
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ClockIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Loading pending approvals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Pending Approvals</h1>
          <p className="mt-2 text-gray-600">
            Review and respond to approval requests that require your attention.
          </p>
        </div>

        {pendingApprovals.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">All caught up!</h3>
            <p className="text-gray-600">You have no pending approval requests at this time.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pendingApprovals.map((approval) => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                currentUser={currentUser}
                users={users}
                getUserName={getUserName}
                getPriorityColor={getPriorityColor}
                formatDate={formatDate}
                onSelect={setSelectedApproval}
              />
            ))}
          </div>
        )}

        {/* Approval Detail Modal */}
        {selectedApproval && (
          <ApprovalDetailModal
            approval={selectedApproval}
            currentUser={currentUser}
            users={users}
            getUserName={getUserName}
            approvalComment={approvalComment}
            setApprovalComment={setApprovalComment}
            isSubmitting={isSubmitting}
            onApprovalResponse={handleApprovalResponse}
            onClose={() => {
              setSelectedApproval(null);
              setApprovalComment('');
            }}
          />
        )}
      </div>
    </div>
  );
};

// Approval Card Component
interface ApprovalCardProps {
  approval: ApprovalRequest;
  currentUser: User;
  users: User[];
  getUserName: (userId: string) => string;
  getPriorityColor: (priority: string) => string;
  formatDate: (date: Date) => string;
  onSelect: (approval: ApprovalRequest) => void;
}

const ApprovalCard: React.FC<ApprovalCardProps> = ({
  approval,
  currentUser,
  users,
  getUserName,
  getPriorityColor,
  formatDate,
  onSelect
}) => {
  const [taskInfo, setTaskInfo] = useState<any>(null);

  useEffect(() => {
    const loadTaskInfo = async () => {
      try {
        const task = await enhancedApi.getTaskById(approval.taskId);
        setTaskInfo(task);
      } catch (error) {
        console.error('Failed to load task info:', error);
      }
    };
    loadTaskInfo();
  }, [approval.taskId]);

  const isUrgent = approval.dueDate && new Date(approval.dueDate).getTime() - Date.now() < 24 * 60 * 60 * 1000;

  return (
    <div 
      className={`bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow ${
        isUrgent ? 'border-l-4 border-red-500' : ''
      }`}
      onClick={() => onSelect(approval)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-2">
          <ClockIcon className="w-5 h-5 text-yellow-500" />
          <span className="text-sm font-medium text-yellow-600">Pending Approval</span>
        </div>
        {isUrgent && (
          <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
            Urgent
          </span>
        )}
      </div>

      <div className="mb-4">
        <h3 className="font-semibold text-gray-900 mb-2">
          {taskInfo ? taskInfo.title : 'Loading...'}
        </h3>
        {approval.description && (
          <p className="text-sm text-gray-600 line-clamp-2">{approval.description}</p>
        )}
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Requested by:</span>
          <span className="font-medium">{getUserName(approval.requestedBy)}</span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Priority:</span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(approval.priority)}`}>
            {approval.priority}
          </span>
        </div>

        {approval.estimatedValue && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Value:</span>
            <span className="font-medium">${approval.estimatedValue.toLocaleString()}</span>
          </div>
        )}

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Type:</span>
          <span className="font-medium capitalize">{approval.approvalType.replace('_', ' ')}</span>
        </div>
      </div>

      <div className="text-xs text-gray-500">
        Created: {formatDate(approval.createdAt)}
        {approval.dueDate && (
          <span className={`block mt-1 ${isUrgent ? 'text-red-600 font-medium' : ''}`}>
            Due: {formatDate(approval.dueDate)}
          </span>
        )}
      </div>
    </div>
  );
};

// Approval Detail Modal Component
interface ApprovalDetailModalProps {
  approval: ApprovalRequest;
  currentUser: User;
  users: User[];
  getUserName: (userId: string) => string;
  approvalComment: string;
  setApprovalComment: (comment: string) => void;
  isSubmitting: boolean;
  onApprovalResponse: (approvalId: string, status: 'approved' | 'rejected') => void;
  onClose: () => void;
}

const ApprovalDetailModal: React.FC<ApprovalDetailModalProps> = ({
  approval,
  currentUser,
  users,
  getUserName,
  approvalComment,
  setApprovalComment,
  isSubmitting,
  onApprovalResponse,
  onClose
}) => {
  const [taskInfo, setTaskInfo] = useState<any>(null);

  useEffect(() => {
    const loadTaskInfo = async () => {
      try {
        const task = await enhancedApi.getTaskById(approval.taskId);
        setTaskInfo(task);
      } catch (error) {
        console.error('Failed to load task info:', error);
      }
    };
    loadTaskInfo();
  }, [approval.taskId]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Approval Request Details</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Task Information */}
          {taskInfo && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Task Details</h4>
              <p className="text-sm text-gray-600 mb-1"><strong>Title:</strong> {taskInfo.title}</p>
              {taskInfo.description && (
                <p className="text-sm text-gray-600 mb-1"><strong>Description:</strong> {taskInfo.description}</p>
              )}
              <p className="text-sm text-gray-600">
                <strong>Priority:</strong> 
                <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                  taskInfo.priority === 'critical' ? 'bg-red-100 text-red-800' :
                  taskInfo.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                  taskInfo.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {taskInfo.priority}
                </span>
              </p>
            </div>
          )}

          {/* Approval Request Information */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Request Information</h4>
            <div className="space-y-2 text-sm">
              <p><strong>Requested by:</strong> {getUserName(approval.requestedBy)}</p>
              <p><strong>Type:</strong> {approval.approvalType.replace('_', ' ')}</p>
              <p><strong>Required approvals:</strong> {approval.requiredApprovals}</p>
              {approval.estimatedValue && (
                <p><strong>Estimated value:</strong> ${approval.estimatedValue.toLocaleString()}</p>
              )}
              {approval.description && (
                <p><strong>Reason:</strong> {approval.description}</p>
              )}
            </div>
          </div>

          {/* Your Response */}
          <div className="border-t pt-6">
            <h4 className="font-medium text-gray-900 mb-3">Your Response</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comment (Optional)
                </label>
                <textarea
                  value={approvalComment}
                  onChange={(e) => setApprovalComment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Add a comment about your decision..."
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => onApprovalResponse(approval.id, 'approved')}
                  disabled={isSubmitting}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-400"
                >
                  {isSubmitting ? 'Submitting...' : 'Approve'}
                </button>
                <button
                  onClick={() => onApprovalResponse(approval.id, 'rejected')}
                  disabled={isSubmitting}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-400"
                >
                  {isSubmitting ? 'Submitting...' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApprovalsPage;