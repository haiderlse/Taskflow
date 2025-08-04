import React, { useState, useEffect } from 'react';
import { ApprovalRequest, User, Task } from '../types';
import { ApprovalService } from '../services/approvalService';
import { XIcon, ClockIcon, CheckCircleIcon } from './icons';

interface ApprovalModalProps {
  task: Task;
  currentUser: User;
  users: User[];
  onClose: () => void;
  onApprovalSubmitted: () => void;
}

const ApprovalModal: React.FC<ApprovalModalProps> = ({ 
  task, 
  currentUser, 
  users,
  onClose, 
  onApprovalSubmitted 
}) => {
  const [approvalRequest, setApprovalRequest] = useState<ApprovalRequest | null>(task.approval || null);
  const [isCreatingApproval, setIsCreatingApproval] = useState(false);
  const [approvalComment, setApprovalComment] = useState('');
  const [estimatedValue, setEstimatedValue] = useState<number>(0);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    setApprovalRequest(task.approval || null);
  }, [task.approval]);

  const handleCreateApproval = async () => {
    setIsCreatingApproval(true);
    setError('');
    
    try {
      const newApproval = await ApprovalService.createApprovalRequest(
        task.id,
        currentUser.uid,
        approvalComment,
        estimatedValue > 0 ? estimatedValue : undefined
      );
      
      if (newApproval) {
        setApprovalRequest(newApproval);
        onApprovalSubmitted();
      } else {
        // No approval required
        onClose();
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setIsCreatingApproval(false);
    }
  };

  const handleApprovalResponse = async (status: 'approved' | 'rejected') => {
    if (!approvalRequest) return;
    
    setIsSubmittingApproval(true);
    setError('');
    
    try {
      const updatedApproval = await ApprovalService.submitApproval(
        approvalRequest.id,
        currentUser.uid,
        status,
        approvalComment
      );
      
      setApprovalRequest(updatedApproval);
      onApprovalSubmitted();
      
      if (updatedApproval.status !== 'pending') {
        setTimeout(() => onClose(), 1500);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const canApprove = approvalRequest && 
    approvalRequest.status === 'pending' &&
    approvalRequest.approvers.includes(currentUser.uid) &&
    !approvalRequest.approvals.some(a => a.userId === currentUser.uid);

  const getUserName = (userId: string): string => {
    const user = users.find(u => u.uid === userId);
    return user ? user.displayName : 'Unknown User';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'rejected':
        return <XIcon className="w-5 h-5 text-red-500" />;
      case 'pending':
        return <ClockIcon className="w-5 h-5 text-yellow-500" />;
      default:
        return <ClockIcon className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'text-green-600 bg-green-50';
      case 'rejected':
        return 'text-red-600 bg-red-50';
      case 'pending':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {approvalRequest ? 'Approval Request' : 'Request Approval'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Task Information */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Task Details</h4>
            <p className="text-sm text-gray-600 mb-1"><strong>Title:</strong> {task.title}</p>
            <p className="text-sm text-gray-600 mb-1"><strong>Priority:</strong> 
              <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                task.priority === 'critical' ? 'bg-red-100 text-red-800' :
                task.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}>
                {task.priority}
              </span>
            </p>
            {task.description && (
              <p className="text-sm text-gray-600"><strong>Description:</strong> {task.description}</p>
            )}
          </div>

          {!approvalRequest ? (
            /* Create Approval Request */
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Approval Request
                </label>
                <textarea
                  value={approvalComment}
                  onChange={(e) => setApprovalComment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Explain why this task requires approval..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estimated Value (Optional)
                </label>
                <input
                  type="number"
                  value={estimatedValue}
                  onChange={(e) => setEstimatedValue(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                  min="0"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter monetary value if this approval involves financial decisions
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleCreateApproval}
                  disabled={isCreatingApproval}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400"
                >
                  {isCreatingApproval ? 'Creating Request...' : 'Request Approval'}
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* Display Approval Request */
            <div className="space-y-6">
              {/* Approval Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {getStatusIcon(approvalRequest.status)}
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(approvalRequest.status)}`}>
                    {approvalRequest.status.charAt(0).toUpperCase() + approvalRequest.status.slice(1)}
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  Requested by {getUserName(approvalRequest.requestedBy)}
                </div>
              </div>

              {/* Approval Details */}
              {approvalRequest.description && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Request Details</h4>
                  <p className="text-sm text-gray-600">{approvalRequest.description}</p>
                </div>
              )}

              {approvalRequest.estimatedValue && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Estimated Value</h4>
                  <p className="text-sm text-gray-600">${approvalRequest.estimatedValue.toLocaleString()}</p>
                </div>
              )}

              {/* Approval Type */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Approval Type</h4>
                <p className="text-sm text-gray-600 capitalize">{approvalRequest.approvalType.replace('_', ' ')}</p>
                <p className="text-xs text-gray-500">
                  {approvalRequest.requiredApprovals} approval(s) required
                </p>
              </div>

              {/* Approvers */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Approvers</h4>
                <div className="space-y-2">
                  {approvalRequest.approvers.map((approverId) => {
                    const approval = approvalRequest.approvals.find(a => a.userId === approverId);
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
                              {getStatusIcon(approval.status)}
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(approval.status)}`}>
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
              {approvalRequest.approvals.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Approval History</h4>
                  <div className="space-y-3">
                    {approvalRequest.approvals.map((approval, index) => (
                      <div key={index} className="border-l-4 border-blue-200 pl-4 pb-3">
                        <div className="flex items-center space-x-2 mb-1">
                          {getStatusIcon(approval.status)}
                          <span className="text-sm font-medium">{getUserName(approval.userId)}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(approval.status)}`}>
                            {approval.status}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(approval.timestamp).toLocaleString()}
                          </span>
                        </div>
                        {approval.comment && (
                          <p className="text-sm text-gray-600 ml-7">{approval.comment}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Approval Actions */}
              {canApprove && (
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
                        onClick={() => handleApprovalResponse('approved')}
                        disabled={isSubmittingApproval}
                        className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-400"
                      >
                        {isSubmittingApproval ? 'Submitting...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleApprovalResponse('rejected')}
                        disabled={isSubmittingApproval}
                        className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-400"
                      >
                        {isSubmittingApproval ? 'Submitting...' : 'Reject'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Due Date */}
              {approvalRequest.dueDate && (
                <div className="text-sm text-gray-500 border-t pt-4">
                  <strong>Due Date:</strong> {new Date(approvalRequest.dueDate).toLocaleString()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApprovalModal;