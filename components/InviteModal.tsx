import React, { useState } from 'react';
import { User, Project, UserRole } from '../types';
import { XIcon, UsersIcon, CheckCircleIcon } from './icons';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  onInviteSent?: (email: string, role: UserRole) => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({
  isOpen,
  onClose,
  projects,
  onInviteSent,
}) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('member');
  const [selectedProjects, setSelectedProjects] = useState<string[]>(projects.map(p => p.id));
  const [isSent, setIsSent] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    if (onInviteSent) onInviteSent(email, role);
    setIsSent(true);
    setTimeout(() => {
      setIsSent(false);
      setEmail('');
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center space-x-2">
            <span className="p-1 bg-blue-100 text-blue-700 rounded-lg">
              <UsersIcon className="w-4 h-4" />
            </span>
            <h3 className="font-bold text-gray-900 text-base">Invite Teammates</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {isSent ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircleIcon className="w-12 h-12 text-emerald-500 mx-auto" />
            <h4 className="font-bold text-gray-900 text-sm">Invitation Sent!</h4>
            <p className="text-xs text-gray-500">An invitation email has been sent to <strong>{email}</strong>.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Email Address</label>
              <input
                type="email"
                required
                placeholder="colleague@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full text-xs px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Role & Permissions</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as UserRole)}
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-xl bg-white focus:outline-none"
              >
                <option value="member">Member - Can create and manage tasks</option>
                <option value="manager">Manager - Project lead and approvals</option>
                <option value="admin">Admin - Full company administration</option>
                <option value="viewer">Viewer - Read-only access</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Grant Project Access</label>
              <div className="space-y-1.5 max-h-32 overflow-y-auto border border-gray-200 rounded-xl p-2.5">
                {projects.map(proj => {
                  const isChecked = selectedProjects.includes(proj.id);
                  return (
                    <label key={proj.id} className="flex items-center space-x-2 text-xs text-gray-700 cursor-pointer p-1 hover:bg-slate-50 rounded">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedProjects(selectedProjects.filter(id => id !== proj.id));
                          } else {
                            setSelectedProjects([...selectedProjects, proj.id]);
                          }
                        }}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className={`w-2 h-2 rounded-full ${proj.color}`} />
                      <span className="font-medium truncate">{proj.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm"
              >
                Send Invite
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default InviteModal;
