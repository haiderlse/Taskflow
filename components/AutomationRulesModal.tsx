import React, { useState } from 'react';
import { Project, User, AutomationRule } from '../types';
import { 
  XIcon, 
  BoltIcon, 
  PlusIcon, 
  CheckIcon, 
  TrashIcon, 
  AlertTriangleIcon 
} from './icons';

interface AutomationRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  users: User[];
  currentUser: User;
  onRuleTriggered?: (ruleName: string) => void;
}

export const AutomationRulesModal: React.FC<AutomationRulesModalProps> = ({
  isOpen,
  onClose,
  project,
  users,
  currentUser,
  onRuleTriggered
}) => {
  const [rules, setRules] = useState<AutomationRule[]>([
    {
      id: 'rule-1',
      name: 'Auto-Complete Workflow',
      description: 'When task is moved to Done, record completion timestamp and clear blockers.',
      trigger: { type: 'task_updated', config: { targetStatus: 'Done' } },
      conditions: [{ field: 'status', operator: 'equals', value: 'Done' }],
      actions: [{ type: 'change_status', config: { autoArchive: false } }],
      isActive: true,
      projectId: project.id,
      createdBy: currentUser.uid,
      createdAt: new Date()
    },
    {
      id: 'rule-2',
      name: 'Critical Priority Escalation',
      description: 'When priority is set to Critical, auto-assign project manager and set high urgency.',
      trigger: { type: 'task_updated', config: { priority: 'critical' } },
      conditions: [{ field: 'priority', operator: 'equals', value: 'critical' }],
      actions: [{ type: 'assign_user', config: { userId: project.ownerId } }],
      isActive: true,
      projectId: project.id,
      createdBy: currentUser.uid,
      createdAt: new Date()
    },
    {
      id: 'rule-3',
      name: '24-Hour Due Date Alert',
      description: 'When a task due date is within 24 hours, add urgency badge and notify assignee.',
      trigger: { type: 'due_date_approaching', config: { hoursBefore: 24 } },
      conditions: [{ field: 'status', operator: 'not_equals', value: 'Done' }],
      actions: [{ type: 'send_notification', config: { channel: 'inbox' } }],
      isActive: true,
      projectId: project.id,
      createdBy: currentUser.uid,
      createdAt: new Date()
    }
  ]);

  const [showCreateRule, setShowCreateRule] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleDescription, setRuleDescription] = useState('');
  const [triggerType, setTriggerType] = useState<AutomationRule['trigger']['type']>('task_created');
  const [actionType, setActionType] = useState<AutomationRule['actions'][0]['type']>('change_status');
  const [actionTargetUser, setActionTargetUser] = useState(users[0]?.uid || '');
  const [actionTargetStatus, setActionTargetStatus] = useState('In Progress');
  const [simulationMessage, setSimulationMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleToggleRule = (ruleId: string) => {
    setRules(prev => prev.map(r => r.id === ruleId ? { ...r, isActive: !r.isActive } : r));
  };

  const handleDeleteRule = (ruleId: string) => {
    setRules(prev => prev.filter(r => r.id !== ruleId));
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return;

    const newRule: AutomationRule = {
      id: `rule-${Date.now()}`,
      name: ruleName.trim(),
      description: ruleDescription.trim() || `Auto-execute action when ${triggerType.replace('_', ' ')} happens.`,
      trigger: { type: triggerType },
      conditions: [],
      actions: [{
        type: actionType,
        config: actionType === 'assign_user' ? { userId: actionTargetUser } : { status: actionTargetStatus }
      }],
      isActive: true,
      projectId: project.id,
      createdBy: currentUser.uid,
      createdAt: new Date()
    };

    setRules(prev => [newRule, ...prev]);
    setShowCreateRule(false);
    setRuleName('');
    setRuleDescription('');
  };

  const handleSimulateRule = (rule: AutomationRule) => {
    setSimulationMessage(`⚡ Rule "${rule.name}" successfully executed! Actions applied to active project tasks.`);
    if (onRuleTriggered) onRuleTriggered(rule.name);
    setTimeout(() => setSimulationMessage(null), 4000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-gray-200 dark:border-slate-800 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <BoltIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Project Workflow Automations & Rules
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Automate repetitive task routing, status transitions, and team escalations for {project.name}.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowCreateRule(true)}
              className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              <span>Create Rule</span>
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800">
              <XIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Simulation Feedback Alert */}
        {simulationMessage && (
          <div className="bg-emerald-50 dark:bg-emerald-950/80 border-b border-emerald-200 dark:border-emerald-800 px-6 py-2.5 text-xs text-emerald-800 dark:text-emerald-300 font-semibold flex items-center justify-between">
            <span>{simulationMessage}</span>
            <button onClick={() => setSimulationMessage(null)} className="text-emerald-600 hover:text-emerald-800">
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Rule List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {rules.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <BoltIcon className="w-10 h-10 mx-auto text-gray-300 dark:text-slate-600 mb-2" />
              <p className="font-semibold text-gray-700 dark:text-slate-300">No automation rules configured</p>
              <p className="text-xs">Create your first rule to automate task movements and assignments.</p>
            </div>
          ) : (
            rules.map(rule => (
              <div 
                key={rule.id}
                className={`p-4 rounded-xl border transition-all ${
                  rule.isActive 
                    ? 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 shadow-xs' 
                    : 'bg-gray-50/70 dark:bg-slate-900/60 border-gray-200/60 dark:border-slate-800 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                      rule.isActive ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300' : 'bg-gray-200 dark:bg-slate-700 text-gray-500'
                    }`}>
                      ⚡
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center space-x-2">
                        <span>{rule.name}</span>
                        {rule.isActive && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                            Active
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                        {rule.description}
                      </p>

                      <div className="flex items-center space-x-2 mt-2 text-[11px] font-medium text-gray-600 dark:text-slate-300">
                        <span className="bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                          When: <strong className="text-blue-600 dark:text-blue-400">{rule.trigger.type.replace(/_/g, ' ')}</strong>
                        </span>
                        <span>→</span>
                        <span className="bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                          Then: <strong className="text-purple-600 dark:text-purple-400">{rule.actions[0]?.type.replace(/_/g, ' ')}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={() => handleSimulateRule(rule)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-blue-50 dark:hover:bg-blue-950/60 text-gray-700 dark:text-slate-200 hover:text-blue-600 transition-colors"
                      title="Test run this rule now"
                    >
                      Run Now
                    </button>

                    <button
                      onClick={() => handleToggleRule(rule.id)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        rule.isActive ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          rule.isActive ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>

                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-1 rounded text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete rule"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Create Rule Modal Popup */}
        {showCreateRule && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center z-60 p-4" onClick={() => setShowCreateRule(false)}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 border border-gray-200 dark:border-slate-700 text-xs" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-700 mb-4">
                <h3 className="font-bold text-base text-gray-900 dark:text-white">Build Custom Automation Rule</h3>
                <button onClick={() => setShowCreateRule(false)} className="text-gray-400 hover:text-gray-600">
                  <XIcon className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateRule} className="space-y-4">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Rule Name</label>
                  <input
                    type="text"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    placeholder="e.g., Auto-assign QA when task is In Progress"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-medium focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">When this happens (Trigger):</label>
                  <select
                    value={triggerType}
                    onChange={(e) => setTriggerType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-medium focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="task_created">Task is created</option>
                    <option value="task_updated">Task status or fields update</option>
                    <option value="task_completed">Task is marked complete (Done)</option>
                    <option value="due_date_approaching">Due date is approaching (within 24h)</option>
                    <option value="assignee_changed">Assignee is modified</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Do this automatically (Action):</label>
                  <select
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-medium focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="assign_user">Automatically assign to team member</option>
                    <option value="change_status">Change task status</option>
                    <option value="send_notification">Send notification to inbox</option>
                    <option value="create_task">Create follow-up task</option>
                  </select>
                </div>

                {actionType === 'assign_user' && (
                  <div>
                    <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Select Assignee</label>
                    <select
                      value={actionTargetUser}
                      onChange={(e) => setActionTargetUser(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-medium"
                    >
                      {users.map(u => (
                        <option key={u.uid} value={u.uid}>{u.displayName} ({u.role})</option>
                      ))}
                    </select>
                  </div>
                )}

                {actionType === 'change_status' && (
                  <div>
                    <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Select Target Status</label>
                    <select
                      value={actionTargetStatus}
                      onChange={(e) => setActionTargetStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-medium"
                    >
                      <option value="To Do">To Do</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Done">Done</option>
                    </select>
                  </div>
                )}

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateRule(false)}
                    className="px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-100 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs"
                  >
                    Save & Activate Rule
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AutomationRulesModal;
