import React, { useState, useEffect } from 'react';
import { User, ApprovalHierarchy } from '../types';
import { enhancedApi } from '../services/enhancedApi';
import { ApprovalService } from '../services/approvalService';
import DeleteUserButton from './DeleteUserButton';
import { 
  UsersIcon, 
  PlusIcon, 
  XIcon, 
  CustomizeIcon,
  CheckCircleIcon 
} from './icons';

interface OrganizationManagementProps {
  currentUser: User;
  users: User[];
  onUserUpdate: (userId: string, updates: Partial<User>) => void;
}

const OrganizationManagement: React.FC<OrganizationManagementProps> = ({ 
  currentUser, 
  users, 
  onUserUpdate 
}) => {
  const [selectedTab, setSelectedTab] = useState<'users' | 'hierarchy' | 'approvals'>('users');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showApprovalHierarchyModal, setShowApprovalHierarchyModal] = useState(false);
  const [approvalHierarchies, setApprovalHierarchies] = useState<ApprovalHierarchy[]>([]);

  useEffect(() => {
    loadApprovalHierarchies();
  }, []);

  const loadApprovalHierarchies = () => {
    const hierarchies = ApprovalService.getApprovalHierarchies();
    setApprovalHierarchies(hierarchies);
  };

  const departments = [...new Set(users.filter(u => u.department).map(u => u.department))];

  const renderUsersTab = () => (
    <div className="space-y-6">
      {/* Add User Button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">User Management</h3>
        <button
          onClick={() => setShowAddUserModal(true)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Add User</span>
        </button>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Department
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Manager
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Approval Limit
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => {
              const manager = users.find(u => u.uid === user.managerId);
              return (
                <tr key={user.uid} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                        {user.displayName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{user.displayName}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={user.role}
                      onChange={(e) => onUserUpdate(user.uid, { role: e.target.value as any })}
                      className="text-sm border border-gray-300 rounded px-2 py-1"
                      disabled={currentUser.role !== 'admin'}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="member">Member</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={user.department || ''}
                      onChange={(e) => onUserUpdate(user.uid, { department: e.target.value || undefined })}
                      className="text-sm border border-gray-300 rounded px-2 py-1"
                    >
                      <option value="">Unassigned</option>
                      <option value="Engineering">Engineering</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Finance">Finance</option>
                      <option value="Operations">Operations</option>
                      <option value="HR">HR</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={user.managerId || ''}
                      onChange={(e) => onUserUpdate(user.uid, { managerId: e.target.value || undefined })}
                      className="text-sm border border-gray-300 rounded px-2 py-1"
                    >
                      <option value="">No Manager</option>
                      {users.filter(u => u.uid !== user.uid && (u.role === 'manager' || u.role === 'admin')).map(mgr => (
                        <option key={mgr.uid} value={mgr.uid}>{mgr.displayName}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="number"
                      value={user.approvalLimit || 0}
                      onChange={(e) => onUserUpdate(user.uid, { approvalLimit: Number(e.target.value) })}
                      className="text-sm border border-gray-300 rounded px-2 py-1 w-20"
                      min="0"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => onUserUpdate(user.uid, { isActive: !user.isActive })}
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {user.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center space-x-2">
                      <button className="text-blue-600 hover:text-blue-900">Edit</button>
                      <DeleteUserButton 
                        user={user}
                        currentUser={currentUser}
                        onUserDeleted={(deletedUserId) => {
                          // Remove user from local state
                          const updatedUsers = users.filter(u => u.uid !== deletedUserId);
                          // In a real app, this would be handled by the parent component
                          // For now, we'll trigger a page refresh to see the updated list
                          window.location.reload();
                        }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderHierarchyTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Organizational Hierarchy</h3>
        <button
          onClick={() => setShowAddUserModal(true)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          <CustomizeIcon className="w-4 h-4" />
          <span>Reorganize</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="space-y-6">
          {/* Company Level */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-500 text-white rounded-full text-lg font-bold mb-2">
              TC
            </div>
            <h4 className="font-medium text-gray-900">TaskFlow Corporation</h4>
            <p className="text-sm text-gray-500">Enterprise Organization</p>
          </div>

          {/* Admins */}
          <div className="flex justify-center">
            <div className="space-y-4">
              {users.filter(u => u.role === 'admin').map(admin => (
                <div key={admin.uid} className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-400 text-white rounded-full font-medium mb-2">
                    {admin.displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <p className="text-sm font-medium text-gray-900">{admin.displayName}</p>
                  <p className="text-xs text-gray-500">Administrator</p>

                  {/* Managers under this admin */}
                  <div className="mt-4 flex justify-center space-x-8">
                    {users.filter(u => u.role === 'manager' && u.managerId === admin.uid).map(manager => (
                      <div key={manager.uid} className="text-center">
                        <div className="w-px h-8 bg-gray-300 mx-auto"></div>
                        <div className="inline-flex items-center justify-center w-10 h-10 bg-blue-400 text-white rounded-full font-medium mb-2">
                          {manager.displayName.slice(0, 2).toUpperCase()}
                        </div>
                        <p className="text-sm font-medium text-gray-900">{manager.displayName}</p>
                        <p className="text-xs text-gray-500">{manager.department}</p>

                        {/* Members under this manager */}
                        <div className="mt-4 space-y-2">
                          {users.filter(u => u.role === 'member' && u.managerId === manager.uid).map(member => (
                            <div key={member.uid} className="text-center">
                              <div className="w-px h-4 bg-gray-300 mx-auto"></div>
                              <div className="inline-flex items-center justify-center w-8 h-8 bg-green-400 text-white rounded-full text-xs font-medium mb-1">
                                {member.displayName.slice(0, 2).toUpperCase()}
                              </div>
                              <p className="text-xs font-medium text-gray-700">{member.displayName}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Department Summary */}
          <div className="border-t pt-6">
            <h4 className="font-medium text-gray-900 mb-4">Department Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {departments.map(dept => {
                const deptUsers = users.filter(u => u.department === dept);
                const deptManagers = deptUsers.filter(u => u.role === 'manager');
                const deptMembers = deptUsers.filter(u => u.role === 'member');
                
                return (
                  <div key={dept} className="text-center p-4 border border-gray-200 rounded-lg">
                    <h5 className="font-medium text-gray-900 mb-2">{dept}</h5>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p>{deptManagers.length} Managers</p>
                      <p>{deptMembers.length} Members</p>
                      <p>{deptUsers.length} Total</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderApprovalHierarchiesTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Approval Hierarchies</h3>
        <button
          onClick={() => setShowApprovalHierarchyModal(true)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Create Hierarchy</span>
        </button>
      </div>

      <div className="space-y-4">
        {approvalHierarchies.map(hierarchy => (
          <div key={hierarchy.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-medium text-gray-900">{hierarchy.name}</h4>
                <p className="text-sm text-gray-600">{hierarchy.description}</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  hierarchy.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {hierarchy.isActive ? 'Active' : 'Inactive'}
                </span>
                <button className="text-blue-600 hover:text-blue-900 text-sm">Edit</button>
              </div>
            </div>

            <div className="space-y-3">
              <h5 className="text-sm font-medium text-gray-700">Rules ({hierarchy.rules.length})</h5>
              {hierarchy.rules.map((rule, index) => (
                <div key={rule.id} className="border border-gray-200 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">Rule {index + 1}</span>
                    <span className="text-xs text-gray-500">
                      {rule.escalationTimeHours && `${rule.escalationTimeHours}h escalation`}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>
                      <strong>Condition:</strong> {rule.condition.field} {rule.condition.operator} {rule.condition.value}
                    </p>
                    <p>
                      <strong>Approvers:</strong> {rule.approvers.length} required
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {rule.approvers.map((approver, i) => (
                        <span key={i} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                          {approver.type}: {approver.identifier}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Organization Management</h1>
          <p className="mt-2 text-gray-600">
            Manage your organization structure, users, and approval workflows.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            {[
              { key: 'users', label: 'Users', icon: UsersIcon },
              { key: 'hierarchy', label: 'Hierarchy', icon: CustomizeIcon },
              { key: 'approvals', label: 'Approval Rules', icon: CheckCircleIcon }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setSelectedTab(key as any)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedTab === key
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {selectedTab === 'users' && renderUsersTab()}
        {selectedTab === 'hierarchy' && renderHierarchyTab()}
        {selectedTab === 'approvals' && renderApprovalHierarchiesTab()}
      </div>
    </div>
  );
};

export default OrganizationManagement;