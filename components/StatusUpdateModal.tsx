import React, { useState } from 'react';
import { Project, ProjectHealthStatus, ProjectStatusUpdate, User } from '../types';
import { enhancedApi } from '../services/enhancedApi';
import { XIcon, CheckCircleIcon, AlertTriangleIcon, ClockIcon } from './icons';

interface StatusUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  currentUser: User;
  onUpdateAdded: (newUpdate: ProjectStatusUpdate) => void;
}

export const StatusUpdateModal: React.FC<StatusUpdateModalProps> = ({
  isOpen,
  onClose,
  project,
  currentUser,
  onUpdateAdded
}) => {
  const [status, setStatus] = useState<ProjectHealthStatus>(project.healthStatus || 'on_track');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [blockers, setBlockers] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !summary.trim()) return;

    setIsSubmitting(true);
    try {
      const created = await enhancedApi.addStatusUpdate(project.id, {
        authorId: currentUser.uid,
        status,
        title: title.trim(),
        summary: summary.trim(),
        blockers: blockers.trim() || undefined,
        nextSteps: nextSteps.trim() || undefined
      });
      onUpdateAdded(created);
      onClose();
    } catch (err) {
      console.error('Failed to post status update:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusOptions: { value: ProjectHealthStatus; label: string; bg: string; text: string; icon: string }[] = [
    { value: 'on_track', label: 'On Track', bg: 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700', text: 'text-emerald-700 dark:text-emerald-300', icon: '🟢' },
    { value: 'at_risk', label: 'At Risk', bg: 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700', text: 'text-amber-700 dark:text-amber-300', icon: '🟡' },
    { value: 'off_track', label: 'Off Track', bg: 'bg-rose-100 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700', text: 'text-rose-700 dark:text-rose-300', icon: '🔴' },
    { value: 'on_hold', label: 'On Hold', bg: 'bg-blue-100 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700', text: 'text-blue-700 dark:text-blue-300', icon: '🔵' },
    { value: 'completed', label: 'Complete', bg: 'bg-purple-100 dark:bg-purple-950/60 border-purple-300 dark:border-purple-700', text: 'text-purple-700 dark:text-purple-300', icon: '🟣' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full border border-gray-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Post Project Status Update</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">Keep stakeholders informed on health, milestones, and blockers.</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Health Status Selector */}
          <div>
            <label className="block font-bold text-gray-700 dark:text-slate-300 mb-2">Project Health Status</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {statusOptions.map(opt => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setStatus(opt.value)}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all ${
                    status === opt.value
                      ? `${opt.bg} ring-2 ring-blue-500 font-bold ${opt.text}`
                      : 'border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-400'
                  }`}
                >
                  <span className="text-sm mb-1">{opt.icon}</span>
                  <span className="text-[11px] whitespace-nowrap">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Update Title */}
          <div>
            <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">
              Headline / Summary Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Sprint 24 Delivered on Schedule - Stage 1 Specs Approved"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Main Progress Summary */}
          <div>
            <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">
              What Went Well & Accomplishments <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              placeholder="Key achievements, shipped milestones, or progress highlights..."
              value={summary}
              onChange={e => setSummary(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Blockers & Risks */}
          <div>
            <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">
              Blockers, Dependencies & Risks (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Any roadblocks, delayed third-party dependencies, or budget risks..."
              value={blockers}
              onChange={e => setBlockers(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Next Steps */}
          <div>
            <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">
              Next Steps & Target Milestones (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Conduct staging smoke test, finalize board presentation"
              value={nextSteps}
              onChange={e => setNextSteps(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-gray-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 font-semibold hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || !summary.trim()}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50 transition-colors shadow-xs"
            >
              {isSubmitting ? 'Publishing...' : 'Post Status Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StatusUpdateModal;
