import React, { useState, useEffect } from 'react';
import { User, ApprovalHierarchy, ApprovalRule } from '../types';
import { enhancedApi } from '../services/enhancedApi';
import { ApprovalService } from '../services/approvalService';
import DeleteUserButton from './DeleteUserButton';
import { 
  UsersIcon, 
  PlusIcon, 
  XIcon, 
  CustomizeIcon,
  CheckCircleIcon,
  ClockIcon
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
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // New User Form State
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<User['role']>('member');
  const [newUserDept, setNewUserDept] = useState('Engineering');
  const [newUserManagerId, setNewUserManagerId] = useState('');
  const [newUserLimit, setNewUserLimit] = useState(5000);

  // Hierarchy Form State
  const [hierarchyName, setHierarchyName] = useState('');
  const [hierarchyDesc, setHierarchyDesc] = useState('');
  const [hierarchyThreshold, setHierarchyThreshold] = useState(10000);

  useEffect(() => {
    loadApprovalHierarchies();
  }, []);

  const loadApprovalHierarchies = () => {
    const hierarchies = ApprovalService.getApprovalHierarchies();
    setApprovalHierarchies(hierarchies);
  };

  const departments = [...new Set(users.filter(u => u.department).map(u => u.department))];

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) return;

    try {
      const createdUser = await enhancedApi.createUser({
        displayName: newUserName.trim(),
        email: newUserEmail.trim(),
        role: newUserRole,
        department: newUserDept,
        managerId: newUserManagerId || undefined,
        approvalLimit: newUserLimit,
        workload: 40,
        isActive: true
      });

      // Update parent list via callback
      onUserUpdate(createdUser.uid, createdUser);

      // Reset form
      setNewUserName('');
      setNewUserEmail('');
      setNewUserRole('member');
      setNewUserDept('Engineering');
      setNewUserManagerId('');
      setNewUserLimit(5000);
      setShowAddUserModal(false);
    } catch (err) {
      console.error('Failed to create user', err);
    }
  };

  const handleCreateHierarchy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hierarchyName.trim()) return;

    const newHierarchy = ApprovalService.createApprovalHierarchy({
      name: hierarchyName.trim(),
      description: hierarchyDesc.trim() || 'Custom Organization Approval Rule',
      rules: [
        {
          id: `rule-${Date.now()}`,
          condition: {
            field: 'estimatedValue',
            operator: 'greater_than',
            value: hierarchyThreshold
          },
          approvers: [
            { type: 'role', identifier: 'manager', isRequired: true, order: 1 },
            { type: 'role', identifier: 'admin', isRequired: true, order: 2 }
          ],
          escalationTimeHours: 24
        }
      ],
      isActive: true
    });

    loadApprovalHierarchies();
    setHierarchyName('');
    setHierarchyDesc('');
    setShowApprovalHierarchyModal(false);
  };

  const renderUsersTab = () => (
    <div className="space-y-6">
      {/* Add User Button */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-gray-900">User Management</h3>
          <p className="text-xs text-gray-500">Configure roles, managers, and permissions.</p>
        </div>
        <button
          onClick={() => setShowAddUserModal(true)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 shadow-xs transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Add User</span>
        </button>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase tracking-wider">
                Department
              </th>
              <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase tracking-wider">
                Manager
              </th>
              <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase tracking-wider">
                Approval Limit
              </th>
              <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right font-bold text-gray-500 uppercase tracking-wider pr-6">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {users.map((user) => {
              const manager = users.find(u => u.uid === user.managerId);
              return (
                <tr key={user.uid} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                        {user.displayName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="ml-3">
                        <div className="font-bold text-gray-900">{user.displayName}</div>
                        <div className="text-[11px] text-gray-400">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    <select
                      value={user.role}
                      onChange={(e) => onUserUpdate(user.uid, { role: e.target.value as any })}
                      className="text-xs border border-gray-300 rounded-lg px-2.5 py-1 font-medium bg-white"
                      disabled={currentUser.role !== 'admin'}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="member">Member</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    <select
                      value={user.department || ''}
                      onChange={(e) => onUserUpdate(user.uid, { department: e.target.value || undefined })}
                      className="text-xs border border-gray-300 rounded-lg px-2.5 py-1 font-medium bg-white"
                    >
                      <option value="">Unassigned</option>
                      <option value="Engineering">Engineering</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Finance">Finance</option>
                      <option value="Operations">Operations</option>
                      <option value="HR">HR</option>
                    </select>
                  </td>
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    <select
                      value={user.managerId || ''}
                      onChange={(e) => onUserUpdate(user.uid, { managerId: e.target.value || undefined })}
                      className="text-xs border border-gray-300 rounded-lg px-2.5 py-1 font-medium bg-white"
                    >
                      <option value="">No Manager</option>
                      {users.filter(u => u.uid !== user.uid && (u.role === 'manager' || u.role === 'admin')).map(mgr => (
                        <option key={mgr.uid} value={mgr.uid}>{mgr.displayName}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    <div className="flex items-center space-x-1">
                      <span className="text-gray-400 font-bold">$</span>
                      <input
                        type="number"
                        value={user.approvalLimit || 0}
                        onChange={(e) => onUserUpdate(user.uid, { approvalLimit: Number(e.target.value) })}
                        className="text-xs border border-gray-300 rounded-lg px-2 py-1 w-24 font-medium"
                        min="0"
                        placeholder="0"
                      />
                    </div>
                  </td>
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    <button
                      onClick={() => onUserUpdate(user.uid, { isActive: !user.isActive })}
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        user.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {user.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-6 py-3.5 whitespace-nowrap text-right pr-6">
                    <div className="flex items-center justify-end space-x-2">
                      <button 
                        onClick={() => setEditingUser(user)}
                        className="text-blue-600 hover:text-blue-900 font-bold px-2 py-1 rounded hover:bg-blue-50"
                      >
                        Edit
                      </button>
                      <DeleteUserButton 
                        user={user}
                        currentUser={currentUser}
                        onUserDeleted={(deletedUserId) => {
                          onUserUpdate(deletedUserId, { isActive: false });
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
        <div>
          <h3 className="text-lg font-bold text-gray-900">Organizational Hierarchy</h3>
          <p className="text-xs text-gray-500">Visual corporate structure from Executive Admin to team members.</p>
        </div>
        <button
          onClick={() => setShowAddUserModal(true)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 shadow-xs"
        >
          <CustomizeIcon className="w-4 h-4" />
          <span>Add Teammate</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-xs border border-gray-200 p-6">
        <div className="space-y-8">
          {/* Company Level */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-purple-600 text-white rounded-2xl text-lg font-black mb-2 shadow-xs">
              FE
            </div>
            <h4 className="font-bold text-gray-900">FlowEnterprise Workspace</h4>
            <p className="text-xs text-gray-500">Enterprise Organization</p>
          </div>

          {/* Admins */}
          <div className="flex justify-center">
            <div className="space-y-6 w-full max-w-4xl">
              {users.filter(u => u.role === 'admin').map(admin => (
                <div key={admin.uid} className="text-center bg-purple-50/50 border border-purple-100 rounded-2xl p-6">
                  <div className="inline-flex items-center justify-center w-10 h-10 bg-purple-600 text-white rounded-xl font-bold text-sm mb-2">
                    {admin.displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <p className="text-sm font-bold text-gray-900">{admin.displayName}</p>
                  <p className="text-xs text-purple-700 font-medium">Executive Administrator</p>

                  {/* Managers under this admin */}
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {users.filter(u => u.role === 'manager' && (u.managerId === admin.uid || !u.managerId)).map(manager => (
                      <div key={manager.uid} className="bg-white border border-blue-100 rounded-xl p-4 shadow-2xs text-center">
                        <div className="inline-flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-lg font-bold text-xs mb-1.5">
                          {manager.displayName.slice(0, 2).toUpperCase()}
                        </div>
                        <p className="text-xs font-bold text-gray-900">{manager.displayName}</p>
                        <p className="text-[10px] text-blue-600 font-bold mb-3">{manager.department || 'Management'}</p>

                        {/* Members under this manager */}
                        <div className="space-y-1 pt-2 border-t border-gray-100">
                          {users.filter(u => u.role === 'member' && u.managerId === manager.uid).map(member => (
                            <div key={member.uid} className="flex items-center justify-between p-1.5 rounded-lg bg-gray-50 text-[11px]">
                              <span className="font-semibold text-gray-800">{member.displayName}</span>
                              <span className="text-[10px] text-gray-400">{member.department}</span>
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
            <h4 className="font-bold text-gray-900 text-sm mb-4">Department Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {departments.map(dept => {
                const deptUsers = users.filter(u => u.department === dept);
                const deptManagers = deptUsers.filter(u => u.role === 'manager');
                const deptMembers = deptUsers.filter(u => u.role === 'member');
                
                return (
                  <div key={dept} className="text-center p-4 border border-gray-200 rounded-xl bg-slate-50/50">
                    <h5 className="font-bold text-gray-900 mb-2 text-xs">{dept}</h5>
                    <div className="space-y-1 text-xs text-gray-600 font-medium">
                      <p>{deptManagers.length} Managers</p>
                      <p>{deptMembers.length} Members</p>
                      <p className="font-bold text-blue-600">{deptUsers.length} Total</p>
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
        <div>
          <h3 className="text-lg font-bold text-gray-900">Approval Hierarchies</h3>
          <p className="text-xs text-gray-500">Automated sign-off workflows and threshold triggers.</p>
        </div>
        <button
          onClick={() => setShowApprovalHierarchyModal(true)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 shadow-xs"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Create Hierarchy</span>
        </button>
      </div>

      <div className="space-y-4">
        {approvalHierarchies.map(hierarchy => (
          <div key={hierarchy.id} className="bg-white rounded-2xl shadow-xs border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-bold text-gray-900 text-sm">{hierarchy.name}</h4>
                <p className="text-xs text-gray-500">{hierarchy.description}</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  hierarchy.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {hierarchy.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Rules ({hierarchy.rules.length})</h5>
              {hierarchy.rules.map((rule, index) => (
                <div key={rule.id} className="border border-gray-200 rounded-xl p-3 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-900">Rule {index + 1}</span>
                    <span className="text-[11px] text-gray-500 font-medium">
                      {rule.escalationTimeHours && `${rule.escalationTimeHours}h escalation window`}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 space-y-1">
                    <p>
                      <strong>Trigger Condition:</strong> {rule.condition.field} {rule.condition.operator.replace('_', ' ')} ${rule.condition.value}
                    </p>
                    <p>
                      <strong>Required Approvers:</strong> {rule.requiredApprovals} of {rule.approvers.length} required
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {rule.approvers.map((approver, i) => (
                        <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[11px] font-bold rounded-md">
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-black text-gray-900">Organization & Directory</h1>
          <p className="mt-1 text-xs text-gray-600">
            Manage your workspace structure, user permissions, and corporate approval matrices.
          </p>
        </div>

        {/* Tabs */}
        <div>
          <div className="flex space-x-1 bg-gray-200/70 rounded-xl p-1 max-w-md">
            {[
              { key: 'users', label: 'Users', icon: UsersIcon },
              { key: 'hierarchy', label: 'Hierarchy', icon: CustomizeIcon },
              { key: 'approvals', label: 'Approval Rules', icon: CheckCircleIcon }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setSelectedTab(key as any)}
                className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  selectedTab === key
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
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

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-black text-gray-900">Add New Team Member</h3>
              <button onClick={() => setShowAddUserModal(false)} className="text-gray-400 hover:text-gray-600">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Rivera"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Work Email</label>
                <input
                  type="email"
                  required
                  placeholder="alex@company.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl p-2.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Role</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as any)}
                    className="w-full border border-gray-300 rounded-xl p-2.5 bg-white"
                  >
                    <option value="member">Member</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Administrator</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Department</label>
                  <select
                    value={newUserDept}
                    onChange={(e) => setNewUserDept(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl p-2.5 bg-white"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Finance">Finance</option>
                    <option value="Operations">Operations</option>
                    <option value="HR">HR</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Reports To (Manager)</label>
                  <select
                    value={newUserManagerId}
                    onChange={(e) => setNewUserManagerId(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl p-2.5 bg-white"
                  >
                    <option value="">No Manager</option>
                    {users.filter(u => u.role === 'manager' || u.role === 'admin').map(mgr => (
                      <option key={mgr.uid} value={mgr.uid}>{mgr.displayName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Approval Limit ($)</label>
                  <input
                    type="number"
                    value={newUserLimit}
                    onChange={(e) => setNewUserLimit(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-xl p-2.5"
                    min="0"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white font-bold hover:bg-blue-700 rounded-xl shadow-xs"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-black text-gray-900">Edit User Details</h3>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editingUser.displayName}
                  onChange={(e) => setEditingUser({ ...editingUser, displayName: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Role</label>
                <select
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                  className="w-full border border-gray-300 rounded-xl p-2.5 bg-white"
                >
                  <option value="viewer">Viewer</option>
                  <option value="member">Member</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Department</label>
                <input
                  type="text"
                  value={editingUser.department || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, department: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl p-2.5"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUserUpdate(editingUser.uid, editingUser);
                    setEditingUser(null);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white font-bold hover:bg-blue-700 rounded-xl shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Approval Hierarchy Modal */}
      {showApprovalHierarchyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-black text-gray-900">Create Approval Workflow Rule</h3>
              <button onClick={() => setShowApprovalHierarchyModal(false)} className="text-gray-400 hover:text-gray-600">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateHierarchy} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Workflow Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. High Value Purchase Approvals"
                  value={hierarchyName}
                  onChange={(e) => setHierarchyName(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Explain when this workflow triggers..."
                  value={hierarchyDesc}
                  onChange={(e) => setHierarchyDesc(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Amount Threshold ($)</label>
                <input
                  type="number"
                  value={hierarchyThreshold}
                  onChange={(e) => setHierarchyThreshold(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-xl p-2.5"
                  min="0"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowApprovalHierarchyModal(false)}
                  className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white font-bold hover:bg-blue-700 rounded-xl shadow-xs"
                >
                  Save Hierarchy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizationManagement;
